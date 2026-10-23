import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/domain/staff/permissions";
import { NO_ACCESS_PATH } from "@/domain/staff/routes";
import { getActiveCatalog } from "@/lib/staff/catalog";
import { requireStaffWithBranch } from "@/lib/staff/session";
import { VisitFlow } from "./VisitFlow";

export const metadata: Metadata = { title: "Registrar visita" };

export default async function VisitPage() {
  const { membership, activeBranch } = await requireStaffWithBranch();
  if (!can(membership.role, "earn_with_qr")) redirect(NO_ACCESS_PATH);
  const catalog = await getActiveCatalog(membership.business_id);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="bitacora text-arcilla-texto">{activeBranch.name}</p>
      <h1 className="mt-2 text-4xl text-tabaco">Registrar visita</h1>
      <VisitFlow catalog={catalog} />
    </div>
  );
}
