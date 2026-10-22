import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { PHONE_AUTH_ENABLED } from "@/lib/business";
import { getCustomerSession } from "@/lib/customer/session";
import { customerSignOutAction } from "../actions";
import { AccessFlow } from "./AccessFlow";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Tu tarjeta" };

export default async function CustomerAccessPage({ searchParams }: { searchParams: Promise<{ salida?: string }> }) {
  const { salida } = await searchParams;
  const session = await getCustomerSession();
  if (session.status === "enrolled") redirect("/tarjeta");

  const completing = session.status === "not_enrolled";

  return (
    <main id="contenido" className="min-h-dvh bg-crema px-5 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-block rounded-full text-tabaco" aria-label="Café Nómada, ir al inicio">
          <Wordmark />
        </Link>

        <div className="mt-10 rounded-[2rem] bg-papel p-6 shadow-[0_24px_60px_-30px_rgb(36_25_20/0.45)] sm:p-8">
          <p className="bitacora text-arcilla-texto">{completing ? "Último paso" : "Bitácora del viajero"}</p>
          <h1 className="mt-2 text-3xl leading-tight text-tabaco sm:text-4xl">
            {completing ? "Completa tu tarjeta" : "Entra o crea tu tarjeta"}
          </h1>
          <p className="mt-3 leading-7 text-tabaco/75">
            {completing
              ? "Ya verificamos tu contacto. Solo falta tu aceptación del aviso de privacidad."
              : "Sin contraseñas: te mandamos un código cada vez que entres desde un dispositivo nuevo."}
          </p>

          {salida ? (
            <p role="status" className="mt-5 rounded-xl border border-exito/30 bg-exito/5 px-4 py-3 text-sm text-exito">
              Cerraste sesión. Tu tarjeta y tus sellos siguen guardados.
            </p>
          ) : null}

          <div className="mt-6">
            {session.status === "not_configured" ? (
              <p role="alert" className="rounded-xl border border-tabaco/20 bg-crema px-4 py-4 leading-6 text-tabaco">
                <strong>Integración no configurada.</strong> Este entorno no tiene conexión con el servicio de tarjetas.
              </p>
            ) : completing ? (
              <>
                <ProfileForm contactLabel={session.contact} />
                <form action={customerSignOutAction} className="mt-4 text-center">
                  <button type="submit" className="text-sm text-tabaco/80 underline underline-offset-4">
                    No soy yo · usar otro correo
                  </button>
                </form>
              </>
            ) : (
              <AccessFlow phoneEnabled={PHONE_AUTH_ENABLED} />
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-tabaco/75">
          ¿Trabajas en Café Nómada?{" "}
          <Link href="/personal/ingresar" className="font-semibold underline underline-offset-4">
            Acceso del personal
          </Link>
        </p>
      </div>
    </main>
  );
}
