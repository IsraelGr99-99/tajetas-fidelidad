import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;
let productId: string;
beforeAll(async () => {
  db = await TestDb.create({ storage: true });
  productId = await db.productId("Espresso (ejemplo)");
});
afterAll(async () => { await db?.close(); });

describe("fotos de productos en Storage", () => {
  test("owner autenticado puede subir; barista y owner con MFA pendiente no", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
    const path = `${IDS.business}/${productId}/${randomUUID()}.webp`;
    const insert = "insert into storage.objects (bucket_id, name) values ('product-photos', $1)";
    expect(await db.as(owner.userId, "select private.has_role($1, array['owner','admin']::public.staff_role[]) as allowed", [IDS.business], "aal2"))
      .toEqual([{ allowed: true }]);
    expect(await db.as(owner.userId, "select id from public.products where id = $1", [productId], "aal2"))
      .toEqual([{ id: productId }]);
    expect(await db.as(owner.userId, "select storage.foldername($1) as folders", [path], "aal2"))
      .toEqual([{ folders: [IDS.business, productId] }]);
    expect(await db.as(owner.userId, `select exists (select 1 from public.products p
      where p.business_id::text = (storage.foldername($1))[1]
        and p.id::text = (storage.foldername($1))[2]
        and private.has_role(p.business_id, array['owner','admin']::public.staff_role[])) as allowed`, [path], "aal2"))
      .toEqual([{ allowed: true }]);
    expect((await db.admin<{ policyname: string }>("select policyname from pg_policies where schemaname='storage' and tablename='objects' and cmd='INSERT'")).map((row) => row.policyname).sort())
      .toEqual(["business_logos_admin_insert", "product_photos_admin_insert"]);
    await expect(db.as(owner.userId, insert, [path])).rejects.toThrow(/row-level security/);
    await expect(db.as(barista.userId, insert, [path])).rejects.toThrow(/row-level security/);
    await expect(db.as(owner.userId, insert, [`${randomUUID()}/${productId}/${randomUUID()}.webp`], "aal2"))
      .rejects.toThrow(/row-level security/);
    await expect(db.as(owner.userId, insert, [path], "aal2")).resolves.toEqual([]);
  });
  test("el logo del negocio también usa la ruta del objeto y no businesses.name", async () => {
    const owner = await db.createStaff("owner");
    const path = `${IDS.business}/${randomUUID()}.png`;
    const insert = "insert into storage.objects (bucket_id, name) values ('business-logos', $1)";
    await expect(db.as(owner.userId, insert, [path])).resolves.toEqual([]);
    await expect(db.as(owner.userId, insert, [`${randomUUID()}/${randomUUID()}.png`]))
      .rejects.toThrow(/row-level security/);
  });
});
