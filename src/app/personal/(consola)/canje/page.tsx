import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/domain/staff/permissions";
import { NO_ACCESS_PATH } from "@/domain/staff/routes";
import { requireStaffWithBranch } from "@/lib/staff/session";
import { RedeemFlow } from "./RedeemFlow";

export const metadata: Metadata = { title: "Canjear recompensa" };

export default async function RedeemPage() {
  const { membership, activeBranch } = await requireStaffWithBranch();
  if (!can(membership.role, "redeem")) redirect(NO_ACCESS_PATH);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="bitacora text-arcilla-texto">{activeBranch.name}</p>
      <h1 className="mt-2 text-4xl text-tabaco">Canjear recompensa</h1>
      <p className="mt-3 leading-7 text-tabaco/75">
        El cliente abre su tarjeta, toca “Canjear mi recompensa” y confirma. Escanea el código de canje que aparece en su teléfono.
      </p>
      <RedeemFlow />
    </div>
  );
}
