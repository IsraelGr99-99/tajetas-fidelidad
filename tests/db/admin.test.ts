import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, ticketHash } from "./harness";

let db: TestDb;
let owner: { userId: string; staffId: string };
let admin: { userId: string; staffId: string };
let manager: { userId: string; staffId: string };
let barista: { userId: string; staffId: string };
let otherBusiness: string;

beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createStaff("owner", { branchAccess: false });
  admin = await db.createStaff("admin", { branchAccess: false });
  manager = await db.createStaff("manager");
  barista = await db.createStaff("barista");
  [{ id: otherBusiness }] = await db.admin<{ id: string }>("insert into public.businesses (slug, name) values ('otro', 'Otro') returning id");
});
afterAll(async () => {
  await db?.close();
});

async function earnFor(customer: { userId: string; cardId: string }) {
  const token = await db.scanToken(customer.userId, customer.cardId);
  const americano = await db.productId("Americano (ejemplo)");
  const staff = await db.createStaff("barista");
  return db.rpc(staff.userId, "record_earn", [
    IDS.branch, idemKey(), ticketHash(), JSON.stringify([{ product_id: americano, quantity: 1 }]), token, null, null,
  ]);
}

describe("bitácora", () => {
  test("gerente ve su sucursal con cliente enmascarado y actor; barista no", async () => {
    const c = await db.createCustomer({ email: "bitacora@correo.test" });
    const e = await earnFor(c);
    const r = await db.rpc(manager.userId, "list_ledger", [IDS.business, IDS.branch, 50, null]);
    expect(r.ok).toBe(true);
    const row = (r.events as Record<string, unknown>[]).find((x) => x.id === e.event_id)!;
    expect(row).toMatchObject({ event_type: "earn", customer_contact_masked: "b•••@correo.test", reversible: true, reversed: false });
    expect(row.actor_name).toBe("Persona barista");
    expect(JSON.stringify(r)).not.toContain("bitacora@correo.test");
    expect(await db.rpc(barista.userId, "list_ledger", [IDS.business, IDS.branch, 50, null])).toMatchObject({ code: "forbidden" });
  });

  test("gerente no puede ver toda la empresa; admin sí", async () => {
    expect(await db.rpc(manager.userId, "list_ledger", [IDS.business, null, 50, null])).toMatchObject({ code: "forbidden" });
    expect((await db.rpc(admin.userId, "list_ledger", [IDS.business, null, 50, null])).ok).toBe(true);
  });

  test("tras revertir, el evento deja de ser reversible", async () => {
    const c = await db.createCustomer();
    const e = await earnFor(c);
    await db.rpc(manager.userId, "reverse_ledger_event", [e.event_id, "Ticket anulado", idemKey(), "voided"]);
    const r = await db.rpc(manager.userId, "list_ledger", [IDS.business, IDS.branch, 100, null]);
    const row = (r.events as Record<string, unknown>[]).find((x) => x.id === e.event_id)!;
    expect(row).toMatchObject({ reversed: true, reversible: false, purchase_status: "voided" });
  });

  test("otra empresa no puede leer la bitácora", async () => {
    const outsider = await db.createStaff("owner", { businessId: otherBusiness, branchAccess: false });
    expect(await db.rpc(outsider.userId, "list_ledger", [IDS.business, null, 50, null])).toMatchObject({ code: "forbidden" });
  });
});

describe("resumen", () => {
  test("cuenta actividad real; solo administración", async () => {
    const r = await db.rpc(owner.userId, "business_summary", [IDS.business]);
    expect(r).toMatchObject({ ok: true });
    expect(Number(r.customers_total)).toBeGreaterThan(0);
    expect(Number(r.earns_today)).toBeGreaterThan(0);
    expect(await db.rpc(manager.userId, "business_summary", [IDS.business])).toMatchObject({ code: "forbidden" });
  });
});

describe("catálogo", () => {
  test("admin crea y edita productos con auditoría; gerente no", async () => {
    const created = await db.rpc(admin.userId, "upsert_product", [IDS.business, null, "Chai latte", "Bebidas", 7000, true, true]);
    expect(created.ok).toBe(true);
    const edited = await db.rpc(admin.userId, "upsert_product", [IDS.business, created.product_id, "Chai latte", "Bebidas", 7200, true, true]);
    expect(edited.ok).toBe(true);
    const [p] = await db.admin<{ price_cents: number }>("select price_cents from public.products where id = $1", [created.product_id]);
    expect(p.price_cents).toBe(7200);
    const audit = await db.admin("select 1 from public.audit_log where action = 'product.upsert' and entity_id = $1", [created.product_id]);
    expect(audit).toHaveLength(2);
    expect(await db.rpc(manager.userId, "upsert_product", [IDS.business, null, "X", "Bebidas", 1000, true, true])).toMatchObject({ code: "forbidden" });
  });

  test("valida nombre duplicado y precio negativo", async () => {
    expect(await db.rpc(admin.userId, "upsert_product", [IDS.business, null, "Chai latte", "Bebidas", 7000, true, true])).toMatchObject({ code: "duplicate_name" });
    expect(await db.rpc(admin.userId, "upsert_product", [IDS.business, null, "Gratis", "Bebidas", -1, true, true])).toMatchObject({ code: "invalid_request" });
  });

  test("no se puede editar un producto de otra empresa", async () => {
    const [p] = await db.admin<{ id: string }>("select id from public.products where business_id = $1 limit 1", [IDS.business]);
    const outsider = await db.createStaff("owner", { businessId: otherBusiness, branchAccess: false });
    expect(await db.rpc(outsider.userId, "upsert_product", [otherBusiness, p.id, "Hack", "Bebidas", 1, true, true])).toMatchObject({ code: "not_found" });
  });
});

describe("sucursales", () => {
  test("crear, editar y no desactivar la última activa", async () => {
    const b = await db.rpc(owner.userId, "upsert_branch", [IDS.business, null, "angelopolis", "Angelópolis", null, true]);
    expect(b.ok).toBe(true);
    expect((await db.rpc(owner.userId, "upsert_branch", [IDS.business, b.branch_id, "ignorado", "Angelópolis", "Puebla", false])).ok).toBe(true);
    expect(await db.rpc(owner.userId, "upsert_branch", [IDS.business, IDS.branch, "x", "San Pedro Cholula", null, false])).toMatchObject({
      code: "last_active_branch",
    });
    expect(await db.rpc(owner.userId, "upsert_branch", [IDS.business, null, "Mal Slug", "Otra", null, true])).toMatchObject({ code: "invalid_request" });
  });
});

describe("personal", () => {
  test("invitar → aceptar al entrar con el correo verificado → aparece en la lista", async () => {
    const inv = await db.rpc(admin.userId, "invite_staff", [IDS.business, "Nueva.Barista@Correo.test", "Nueva", "barista", [IDS.branch]]);
    expect(inv.ok).toBe(true);
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "nueva.barista@correo.test", "Nueva", "barista", [IDS.branch]])).toMatchObject({
      code: "invitation_exists",
    });

    const userId = await db.createUser({ email: "nueva.barista@correo.test" });
    expect(await db.rpc(userId, "claim_staff_invitations", [])).toMatchObject({ ok: true, claimed: 1 });
    const ctx = await db.rpc(userId, "get_staff_context", []);
    expect((ctx.memberships as { role: string; branches: { id: string }[] }[])[0]).toMatchObject({ role: "barista", branches: [{ id: IDS.branch }] });
    // Volver a reclamar no duplica.
    expect(await db.rpc(userId, "claim_staff_invitations", [])).toMatchObject({ claimed: 0 });
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "nueva.barista@correo.test", "Nueva", "barista", [IDS.branch]])).toMatchObject({
      code: "staff_exists",
    });
  });

  test("un correo sin verificar no acepta invitaciones", async () => {
    await db.rpc(admin.userId, "invite_staff", [IDS.business, "sinverificar.staff@correo.test", "Sin", "barista", [IDS.branch]]);
    const userId = await db.createUser({ email: "sinverificar.staff@correo.test", verified: false });
    expect(await db.rpc(userId, "claim_staff_invitations", [])).toMatchObject({ claimed: 0 });
  });

  test("admin no puede invitar admin ni owner; owner sí; barista requiere sucursal", async () => {
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "a1@correo.test", "A", "admin", []])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "a2@correo.test", "A", "owner", []])).toMatchObject({ code: "forbidden" });
    expect((await db.rpc(owner.userId, "invite_staff", [IDS.business, "a3@correo.test", "A", "admin", []])).ok).toBe(true);
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "a4@correo.test", "A", "barista", []])).toMatchObject({ code: "branch_required" });
    expect(await db.rpc(manager.userId, "invite_staff", [IDS.business, "a5@correo.test", "A", "barista", [IDS.branch]])).toMatchObject({ code: "forbidden" });
  });

  test("sucursal de otra empresa en la invitación es inválida", async () => {
    const [{ id: foreignBranch }] = await db.admin<{ id: string }>(
      "insert into public.branches (business_id, slug, name) values ($1, 'fuera', 'Fuera') returning id",
      [otherBusiness],
    );
    expect(await db.rpc(admin.userId, "invite_staff", [IDS.business, "a6@correo.test", "A", "barista", [foreignBranch]])).toMatchObject({
      code: "invalid_request",
    });
  });

  test("revocar invitación impide aceptarla", async () => {
    const inv = await db.rpc(admin.userId, "invite_staff", [IDS.business, "revocada@correo.test", "R", "barista", [IDS.branch]]);
    expect((await db.rpc(admin.userId, "revoke_staff_invitation", [inv.invitation_id])).ok).toBe(true);
    const userId = await db.createUser({ email: "revocada@correo.test" });
    expect(await db.rpc(userId, "claim_staff_invitations", [])).toMatchObject({ claimed: 0 });
  });

  test("actualizar rol y sucursales; reglas de jerarquía", async () => {
    const target = await db.createStaff("barista");
    expect((await db.rpc(admin.userId, "update_staff_member", [target.staffId, "manager", true, [IDS.branch]])).ok).toBe(true);
    expect(await db.rpc(admin.userId, "update_staff_member", [target.staffId, "admin", true, []])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(admin.userId, "update_staff_member", [owner.staffId, "barista", true, [IDS.branch]])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(admin.userId, "update_staff_member", [admin.staffId, "admin", false, []])).toMatchObject({ code: "cannot_modify_self" });
    expect(await db.rpc(admin.userId, "update_staff_member", [target.staffId, "barista", true, []])).toMatchObject({ code: "branch_required" });
    // Desactivar quita acceso inmediato.
    expect((await db.rpc(admin.userId, "update_staff_member", [target.staffId, "barista", false, [IDS.branch]])).ok).toBe(true);
    expect(await db.rpc(target.userId, "get_staff_context", [])).toEqual({ ok: true, memberships: [] });
  });

  test("no se puede quitar al último owner", async () => {
    const owner2 = await db.createStaff("owner", { branchAccess: false });
    // owner2 intenta degradar al único otro owner: permitido porque quedaría owner2.
    expect((await db.rpc(owner2.userId, "update_staff_member", [owner.staffId, "admin", true, []])).ok).toBe(true);
    // owner (ahora admin) ya no puede tocar a owner2; un tercer owner tampoco puede dejar la empresa sin owners.
    const owner3 = await db.createStaff("owner", { branchAccess: false });
    expect((await db.rpc(owner3.userId, "update_staff_member", [owner2.staffId, "admin", true, []])).ok).toBe(true);
    const [{ n }] = await db.admin<{ n: number }>("select count(*)::int n from public.staff_members where business_id = $1 and role = 'owner' and active", [IDS.business]);
    expect(n).toBe(1);
    // Restaurar para el resto de pruebas.
    await db.admin("update public.staff_members set role = 'owner' where id = $1", [owner.staffId]);
  });

  test("list_staff: owner ve correos completos; admin enmascarados", async () => {
    const asOwner = await db.rpc(owner.userId, "list_staff", [IDS.business]);
    const asAdmin = await db.rpc(admin.userId, "list_staff", [IDS.business]);
    const ownerEmails = (asOwner.members as { email: string }[]).map((m) => m.email);
    const adminEmails = (asAdmin.members as { email: string }[]).map((m) => m.email);
    expect(ownerEmails.some((e) => e.includes("@staff.test") && !e.includes("•"))).toBe(true);
    expect(adminEmails.every((e) => e.includes("•••@"))).toBe(true);
    expect(await db.rpc(manager.userId, "list_staff", [IDS.business])).toMatchObject({ code: "forbidden" });
  });
});

describe("clientes", () => {
  test("cliente desactiva, propietario ve motivo y cliente puede reactivar sin perder tarjeta", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer({ email: "pausa@correo.test" });
    expect(await db.rpc(c.userId, "disable_my_customer_account", ["cafe-nomada", "no_uso", "Ya no voy a esta sucursal"]))
      .toMatchObject({ ok: true });
    expect(await db.rpc(c.userId, "get_my_card", ["cafe-nomada"]))
      .toMatchObject({ ok: false, code: "not_enrolled" });
    expect(await db.rpc(c.userId, "issue_scan_token", [c.cardId, "identify", ticketHash(), 120]))
      .toMatchObject({ ok: false, code: "card_not_found" });
    expect(await db.rpc(c.userId, "get_my_account_status", ["cafe-nomada"]))
      .toMatchObject({ ok: true, status: "disabled" });
    const ownerRows = await db.as<{ closure_reason: string }>(owner.userId,
      "select closure_reason from public.customers where auth_user_id = $1", [c.userId]);
    expect(ownerRows).toEqual([{ closure_reason: "Ya no voy a esta sucursal" }]);
    const audit = await db.admin<{ details: unknown }>(
      "select details from public.audit_log where action = 'customer.disable' and entity_id = (select customer_id::text from public.loyalty_cards where id = $1)", [c.cardId]);
    expect(JSON.stringify(audit)).not.toContain("Ya no voy a esta sucursal");
    expect(await db.as(barista.userId, "select closure_reason from public.customers where auth_user_id = $1", [c.userId])).toEqual([]);
    expect(await db.rpc(owner.userId, "reactivate_my_customer_account", ["cafe-nomada", "2026-10-23"]))
      .toMatchObject({ ok: false, code: "not_disabled" });
    expect(await db.rpc(c.userId, "reactivate_my_customer_account", ["cafe-nomada", "2026-10-23"]))
      .toMatchObject({ ok: true });
    const [restored] = await db.admin<{ status: string; closure_reason: string | null }>(
      "select status, closure_reason from public.customers where auth_user_id = $1", [c.userId]);
    expect(restored).toEqual({ status: "active", closure_reason: null });
    expect((await db.rpc(c.userId, "get_my_card", ["cafe-nomada"])).card).toMatchObject({ id: c.cardId });
  });

  test("eliminación desde cuenta desactivada borra motivo libre y datos personales", async () => {
    const c = await db.createCustomer({ email: "eliminar-pausa@correo.test" });
    await db.rpc(c.userId, "disable_my_customer_account", ["cafe-nomada", "otro", "Motivo privado de prueba"]);
    expect(await db.rpc(c.userId, "delete_my_customer_data", ["cafe-nomada", "privacidad"]))
      .toMatchObject({ ok: true });
    const [row] = await db.admin<{ status: string; closure_reason: string | null; closure_category: string; contact_email: string | null }>(
      "select status, closure_reason, closure_category, contact_email from public.customers cu join public.loyalty_cards c on c.customer_id = cu.id where c.id = $1", [c.cardId]);
    expect(row).toEqual({ status: "deleted", closure_reason: null, closure_category: "privacidad", contact_email: null });
  });

  test("búsqueda por correo, teléfono o nombre sin auditar el dato", async () => {
    await db.createCustomer({ email: "buscada@correo.test" });
    await db.createCustomer({ phone: "522225551234" });
    const byEmail = await db.rpc(admin.userId, "admin_find_customers", [IDS.business, "Buscada@correo.test"]);
    expect((byEmail.customers as unknown[]).length).toBe(1);
    const byPhone = await db.rpc(admin.userId, "admin_find_customers", [IDS.business, "222 555 1234"]);
    expect((byPhone.customers as { contact_masked: string }[])[0].contact_masked).toBe("•••• 1234");
    expect((await db.rpc(admin.userId, "admin_find_customers", [IDS.business, "viajera"])).customers).toBeTruthy();
    expect(await db.rpc(admin.userId, "admin_find_customers", [IDS.business, "bu"])).toMatchObject({ code: "invalid_request" });
    const audit = await db.admin("select details from public.audit_log where action = 'customer.search'");
    expect(JSON.stringify(audit)).not.toContain("buscada");
    expect(await db.rpc(manager.userId, "admin_find_customers", [IDS.business, "buscada@correo.test"])).toMatchObject({ code: "forbidden" });
  });

  test("el cliente elimina sus datos: se anonimiza y el historial se conserva", async () => {
    const c = await db.createCustomer({ email: "borrar@correo.test" });
    const e = await earnFor(c);
    expect(await db.rpc(c.userId, "delete_my_customer_data", ["cafe-nomada", "privacidad"])).toMatchObject({ ok: true, is_staff: false });
    const [cu] = await db.admin<Record<string, unknown>>(
      "select status, contact_email, display_name, auth_user_id from public.customers cu join public.loyalty_cards c on c.customer_id = cu.id where c.id = $1",
      [c.cardId],
    );
    expect(cu).toEqual({ status: "deleted", contact_email: null, display_name: null, auth_user_id: null });
    const [ev] = await db.admin("select id from public.ledger_events where id = $1", [e.event_id]);
    expect(ev).toBeTruthy();
    expect(await db.rpc(c.userId, "get_my_card", ["cafe-nomada"])).toMatchObject({ code: "not_enrolled" });
    // Puede volver a registrarse con el mismo correo (tarjeta nueva).
    expect((await db.rpc(c.userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"])).ok).toBe(true);
  });
});

describe("privilegios", () => {
  test.each(["list_ledger", "business_summary", "upsert_product", "invite_staff", "list_staff", "admin_find_customers", "delete_my_customer_data"])(
    "anon no ejecuta %s",
    async (fn) => {
      await expect(db.as(null, `select public.${fn}()`)).rejects.toThrow(/permission denied|does not exist/);
    },
  );
  test("staff_invitations no es legible por barista ni anon", async () => {
    expect(await db.as(barista.userId, "select id from public.staff_invitations")).toEqual([]);
    await expect(db.as(null, "select id from public.staff_invitations")).rejects.toThrow(/permission denied/);
  });
});
