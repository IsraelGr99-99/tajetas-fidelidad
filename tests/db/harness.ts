import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Arnés de pruebas de base de datos sobre PGlite (PostgreSQL real en WASM).
 * Reproduce lo mínimo de Supabase que usan las migraciones: esquema `auth`,
 * `auth.uid()` leyendo los claims del JWT, roles `anon`/`authenticated` y los
 * privilegios por defecto que Supabase concede (que las migraciones deben revocar).
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  phone text,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create table auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  factor_type text not null default 'totp',
  status text not null default 'unverified'
);
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const STORAGE_STUB = `
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit integer, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text not null,
  name text not null
);
create function storage.foldername(p_name text) returns text[] language sql immutable as $$
  select string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/')
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant execute on function storage.foldername(text) to authenticated;
`;

export const IDS = {
  business: "00000000-0000-4000-8000-000000000001",
  branch: "00000000-0000-4000-8000-0000000000b1",
  campaign: "00000000-0000-4000-8000-0000000000c1",
} as const;

export type Json = Record<string, unknown>;

export class TestDb {
  private constructor(readonly pg: PGlite) {}

  static async create(options: { storage?: boolean; seed?: boolean } = {}): Promise<TestDb> {
    const pg = new PGlite();
    await pg.exec(SUPABASE_STUB);
    if (options.storage) await pg.exec(STORAGE_STUB);
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
    if (options.seed !== false) await pg.exec(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
    return new TestDb(pg);
  }

  /** Ejecuta como superusuario (equivale a migraciones/seed; omite RLS). */
  async admin<T = Json>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role; select set_config('request.jwt.claims', '', false);");
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Ejecuta como un usuario de Supabase (rol `authenticated` + claims) o como `anon`. */
  async as<T = Json>(userId: string | null, sql: string, params: unknown[] = [], aal: "aal1" | "aal2" = "aal1"): Promise<T[]> {
    const claims = userId ? JSON.stringify({ sub: userId, role: "authenticated", aal }) : "";
    await this.pg.query("select set_config('request.jwt.claims', $1, false)", [claims]);
    await this.pg.exec(`set role ${userId ? "authenticated" : "anon"}`);
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role");
    }
  }

  /** Ejecuta como el servidor con la llave secreta (rol `service_role`). */
  async service<T = Json>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.query("select set_config('request.jwt.claims', '', false)");
    await this.pg.exec("set role service_role");
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role");
    }
  }

  /** Llama a una RPC y devuelve su jsonb. */
  async rpc(userId: string | null, fn: string, args: unknown[], aal: "aal1" | "aal2" = "aal1"): Promise<Json> {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await this.as<{ r: Json }>(userId, `select public.${fn}(${placeholders}) as r`, args, aal);
    return rows[0].r;
  }

  async createUser(opts: { email?: string; phone?: string; verified?: boolean } = {}): Promise<string> {
    const id = randomUUID();
    const verified = opts.verified ?? true;
    await this.admin(
      "insert into auth.users (id, email, phone, email_confirmed_at, phone_confirmed_at) values ($1, $2, $3, $4, $5)",
      [id, opts.email ?? null, opts.phone ?? null, verified && opts.email ? new Date() : null, verified && opts.phone ? new Date() : null],
    );
    return id;
  }

  async createStaff(role: "owner" | "admin" | "manager" | "barista", opts: { branchAccess?: boolean; businessId?: string } = {}) {
    const userId = await this.createUser({ email: `${role}-${randomUUID().slice(0, 8)}@staff.test` });
    const businessId = opts.businessId ?? IDS.business;
    const [staff] = await this.admin<{ id: string }>(
      "insert into public.staff_members (business_id, user_id, role, display_name) values ($1, $2, $3, $4) returning id",
      [businessId, userId, role, `Persona ${role}`],
    );
    if (opts.branchAccess ?? true) {
      // La sucursal del seed si es Café Nómada; si no, la más antigua de esa empresa.
      const [branch] = await this.admin<{ id: string }>(
        "select id from public.branches where business_id = $1 order by (id = $2) desc, created_at, id limit 1",
        [businessId, IDS.branch],
      );
      await this.admin("insert into public.staff_branch_access (staff_member_id, branch_id, business_id) values ($1, $2, $3)", [
        staff.id,
        branch.id,
        businessId,
      ]);
    }
    return { userId, staffId: staff.id };
  }

  /** Cliente inscrito con tarjeta. */
  async createCustomer(opts: { email?: string; phone?: string } = {}) {
    const userId = await this.createUser(opts.email || opts.phone ? opts : { email: `cliente-${randomUUID().slice(0, 8)}@correo.test` });
    const r = await this.rpc(userId, "enroll_customer", ["cafe-nomada", "Viajera", "2026-10-23"]);
    if (!r.ok) throw new Error(`enroll falló: ${JSON.stringify(r)}`);
    return { userId, cardId: r.card_id as string };
  }

  async productId(name: string): Promise<string> {
    const [p] = await this.admin<{ id: string }>("select id from public.products where name = $1", [name]);
    return p.id;
  }

  /** Emite un token QR como lo haría la app: token aleatorio, se registra solo su hash. */
  async scanToken(customerUserId: string, cardId: string, purpose: "identify" | "redeem" = "identify") {
    const token = randomUUID() + randomUUID();
    const hash = sha256(token);
    const r = await this.rpc(customerUserId, "issue_scan_token", [cardId, purpose, hash, 120]);
    if (!r.ok) throw new Error(`issue_scan_token falló: ${JSON.stringify(r)}`);
    return hash;
  }

  /** Mueve el último crédito hacia atrás para saltar la espera mínima entre sellos. */
  async rewindLastEarn(cardId: string, seconds = 3600) {
    await this.admin("update public.loyalty_cards set last_earn_at = last_earn_at - make_interval(secs => $2) where id = $1", [
      cardId,
      seconds,
    ]);
  }

  async card(cardId: string) {
    const [c] = await this.admin<{ stamps_balance: number; rewards_balance: number; consistent: boolean }>(
      "select stamps_balance, rewards_balance, private.verify_card_projection(id) as consistent from public.loyalty_cards where id = $1",
      [cardId],
    );
    return c;
  }

  async close() {
    await this.pg.close();
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function ticketHash(): string {
  return sha256(`ticket-${randomUUID()}`);
}

export function idemKey(): string {
  return `t-${randomUUID()}`;
}
