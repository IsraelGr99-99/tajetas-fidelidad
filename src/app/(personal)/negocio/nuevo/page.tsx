import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff/session";
import { CreateBusinessForm } from "./CreateBusinessForm";

export const metadata: Metadata = { title: "Nuevo negocio de prueba", robots: { index: false } };

export default async function NewBusinessPage() {
  const { membership } = await requireStaff();
  if (membership.role !== "owner") redirect("/cuenta");
  return <div className="mx-auto max-w-2xl space-y-6">
    <div><Link href="/cuenta" className="text-sm font-semibold text-blue-700 hover:underline">← Volver a Mi cuenta</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-700">Espacios de trabajo</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Agregar negocio de prueba</h1>
      <p className="mt-3 leading-7 text-slate-600">Crea otro espacio separado para comprobar el flujo multiempresa. Solo se permiten tres espacios DEMO por propietario; el alta comercial y la facturación aún no están disponibles.</p>
    </div>
    {membership.mfa_pending ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Para continuar, <Link href="/cuenta/verificacion" className="font-bold underline">confirma la verificación en dos pasos</Link>.</p> : null}
    <CreateBusinessForm />
  </div>;
}
