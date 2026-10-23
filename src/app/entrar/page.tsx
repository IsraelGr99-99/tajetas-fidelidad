import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { safeNextPath } from "@/domain/staff/routes";
import { getStaffSession } from "@/lib/staff/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Acceso del personal" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ siguiente?: string; salida?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.siguiente);
  const session = await getStaffSession();
  if (session.status === "staff") redirect(next);

  return (
    <main id="contenido" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="grain relative hidden overflow-hidden bg-tabaco p-12 text-crema lg:flex lg:flex-col lg:justify-between">
        <Wordmark />
        <div>
          <p className="bitacora text-mostaza">Consola de barra</p>
          <p className="mt-4 max-w-md font-display text-5xl leading-tight">Cada taza cuenta. Cada sello, también.</p>
          <p className="mt-6 max-w-md leading-7 text-crema/80">
            Registra visitas y canjes con el código del cliente. Cada movimiento queda en la bitácora con tu nombre.
          </p>
        </div>
        <p className="text-sm text-crema/70">Acceso exclusivo para el personal autorizado.</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-tabaco lg:hidden">
            <Wordmark />
          </div>
          <p className="bitacora mt-10 text-arcilla-texto lg:mt-0">Personal</p>
          <h1 className="mt-2 text-4xl text-tabaco">Inicia tu turno</h1>
          <p className="mt-3 leading-7 text-tabaco/75">Entra con tu contraseña o, si te invitaron, con un código enviado a tu correo.</p>

          {params.salida ? (
            <p role="status" className="mt-6 rounded-xl border border-exito/30 bg-exito/5 px-4 py-3 text-sm text-exito">
              Cerraste sesión correctamente.
            </p>
          ) : null}

          <div className="mt-8">
            {session.status === "not_configured" ? (
              <p role="alert" className="rounded-xl border border-tabaco/20 bg-papel px-4 py-4 leading-6 text-tabaco">
                <strong>Integración no configurada.</strong> Este entorno no tiene conexión con Supabase, así que el acceso del personal no
                está disponible.
              </p>
            ) : (
              <LoginForm next={next} />
            )}
          </div>

          <p className="mt-10 text-sm text-tabaco/75">
            ¿Eres cliente?{" "}
            <Link href="/" className="font-semibold underline underline-offset-4">
              Ve a la tarjeta de Café Nómada
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
