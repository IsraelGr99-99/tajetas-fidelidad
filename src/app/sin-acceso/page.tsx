import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { LOGIN_PATH } from "@/domain/staff/routes";
import { getStaffSession } from "@/lib/staff/session";

export const metadata: Metadata = { title: "Sin acceso" };

export default async function NoAccessPage() {
  const session = await getStaffSession();
  if (session.status === "anonymous" || session.status === "not_configured") redirect(LOGIN_PATH);

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center text-tabaco">
      <LogoMark className="h-16 w-16" />
      <p className="bitacora mt-8 text-arcilla-texto">Acceso restringido</p>
      <h1 className="mt-3 text-4xl">Esta sección no está disponible para tu cuenta.</h1>
      <p className="mt-4 leading-7 text-tabaco/75">
        {session.status === "no_access"
          ? "Tu cuenta no está registrada como personal activo de ninguna cafetería. Si crees que es un error, pide a administración que revise tu alta."
          : "Tu rol no incluye este permiso. Si lo necesitas, pídelo a administración."}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {session.status === "staff" ? (
          <Link href="/barra" className="btn btn-oscuro">
            Volver a la consola
          </Link>
        ) : null}
        <SignOutButton className="btn min-h-12 border border-tabaco/30 px-6 text-tabaco hover:border-tabaco" />
      </div>
    </main>
  );
}
