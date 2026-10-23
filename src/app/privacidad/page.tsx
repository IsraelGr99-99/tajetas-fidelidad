import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";
import { PRIVACY_VERSION } from "@/domain/customer/contact";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Aviso de privacidad" };

/**
 * BORRADOR: debe revisarlo el área legal de Café Nómada / iautomexa (LFPDPPP) antes del piloto.
 * Si cambia el contenido sustancial, actualizar PRIVACY_VERSION para pedir nueva aceptación.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-crema text-tabaco">
      <header className="mx-auto max-w-2xl px-5 py-5">
        <Link href="/" aria-label="Café Nómada, ir al inicio" className="inline-block rounded-full">
          <Wordmark />
        </Link>
      </header>
      <main id="contenido" className="mx-auto max-w-2xl px-5 pb-16">
        <p className="bitacora text-arcilla-texto">Versión {formatDate(`${PRIVACY_VERSION}T12:00:00-06:00`)}</p>
        <h1 className="mt-2 text-4xl">Aviso de privacidad</h1>
        <p role="note" className="mt-4 rounded-xl border border-mostaza bg-mostaza/15 px-4 py-3 text-sm">
          Borrador para el piloto, pendiente de revisión legal. Los datos del responsable marcados como “por completar” se definirán antes de abrir el
          registro al público.
        </p>

        <div className="mt-8 space-y-6 leading-7 text-tabaco/85">
          <section>
            <h2 className="text-2xl text-tabaco">Quién es responsable</h2>
            <p className="mt-2">
              Café Nómada (razón social y domicilio: por completar), San Pedro Cholula, Puebla. La plataforma tecnológica la opera iautomexa como
              encargado del tratamiento.
            </p>
          </section>
          <section>
            <h2 className="text-2xl text-tabaco">Qué datos usamos</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Un solo medio de contacto que tú eliges: correo electrónico o teléfono celular.</li>
              <li>Un nombre corto opcional para saludarte en la barra.</li>
              <li>El historial de tus sellos y recompensas (fecha y sucursal).</li>
            </ul>
            <p className="mt-2">No pedimos datos sensibles, financieros, de domicilio ni de fecha de nacimiento.</p>
          </section>
          <section>
            <h2 className="text-2xl text-tabaco">Para qué</h2>
            <p className="mt-2">
              Exclusivamente para operar tu tarjeta de fidelidad: identificarte, registrar tus visitas, entregar tus recompensas, enviarte los
              códigos de acceso y prevenir fraudes. No vendemos ni compartimos tus datos con terceros para publicidad.
            </p>
          </section>
          <section>
            <h2 className="text-2xl text-tabaco">Cuánto tiempo</h2>
            <p className="mt-2">
              Mientras tengas tu tarjeta activa. El historial se conserva hasta 24 meses para aclaraciones y prevención de fraude; después se
              anonimiza.
            </p>
          </section>
          <section>
            <h2 className="text-2xl text-tabaco">Tus derechos (ARCO)</h2>
            <p className="mt-2">
              Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, y revocar tu consentimiento, escribiendo a: correo de contacto
              por completar. Si eliminas tu tarjeta, borramos tu contacto y nombre; el historial queda sin datos que te identifiquen.
            </p>
          </section>
          <section>
            <h2 className="text-2xl text-tabaco">Proveedores</h2>
            <p className="mt-2">
              Usamos Supabase (base de datos y autenticación) y un proveedor de envío de correo para mandarte tus códigos. Si decides agregar tu
              tarjeta a Google Wallet, Google recibe tu nombre corto (si lo diste), el número corto de tu tarjeta y tus sellos; nunca tu correo ni tu
              teléfono. Solo reciben lo necesario para prestar ese servicio.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
