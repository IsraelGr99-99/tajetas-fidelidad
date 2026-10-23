import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff/session";
import { MfaGate } from "./MfaGate";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function MfaPage() {
  await requireStaff();
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl bg-papel p-6">
      <h1 className="text-3xl text-tabaco">Confirma que eres tú</h1>
      <MfaGate />
    </div>
  );
}
