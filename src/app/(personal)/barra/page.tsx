import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/domain/staff/permissions";
import { NO_ACCESS_PATH } from "@/domain/staff/routes";
import { getActiveCatalog } from "@/lib/staff/catalog";
import { requireStaffWithBranch } from "@/lib/staff/session";
import { BarFlow } from "./BarFlow";

export const metadata: Metadata = { title: "Fidelidad" };

export default async function BarPage() {
  const { membership, activeBranch } = await requireStaffWithBranch();
  if (!can(membership.role, "earn_with_qr") && !can(membership.role, "redeem")) redirect(NO_ACCESS_PATH);
  const catalog = await getActiveCatalog(membership.business_id);
  return <BarFlow catalog={catalog} branchId={activeBranch.id} branchName={activeBranch.name} />;
}
