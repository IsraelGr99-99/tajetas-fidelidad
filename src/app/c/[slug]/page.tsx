import type { Metadata } from "next";
import Link from "next/link";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { customerPaths } from "@/domain/customer/business-route";
import { getCustomerBusiness } from "@/lib/customer/business";
import { customerEnrollmentOpen } from "@/lib/customer/availability";

export const metadata: Metadata = { title: "Programa de fidelidad", robots: { index: false } };

export default async function BusinessProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = await getCustomerBusiness(slug);
  const paths = customerPaths(slug);
  const enrollmentOpen = customerEnrollmentOpen(slug);
  return <main id="contenido" className="min-h-dvh bg-[#f3f6fb] text-slate-950">
    <header className="border-b border-slate-200 bg-white/85 px-5 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/" className="text-sm font-bold text-blue-700">iautomexa · Loyalty</Link>
        <Link href={paths.access} className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Mi tarjeta</Link>
      </div>
    </header>
    <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-24">
      <section aria-labelledby="program-title">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Programa de fidelidad</p>
        <h1 id="program-title" className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Tus visitas a {theme.businessName} cuentan.</h1>
        <p className="mt-5 max-w-prose text-lg leading-8 text-slate-600">Guarda tu tarjeta digital, muestra tu código al pagar y consulta tus sellos y recompensas en un solo lugar.</p>
        <ol className="mt-8 space-y-3 text-sm leading-6 text-slate-700">
          <li><strong>1.</strong> Entra con un código enviado a tu correo.</li>
          <li><strong>2.</strong> Muestra tu QR al personal en cada compra elegible.</li>
          <li><strong>3.</strong> Revisa tu avance y usa tus recompensas cuando estén disponibles.</li>
        </ol>
        {enrollmentOpen ? <Link href={paths.access} className="mt-9 inline-flex min-h-12 items-center rounded-full bg-blue-700 px-7 font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-800">Entrar o crear mi tarjeta →</Link>
          : <p role="status" className="mt-9 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Este programa está en configuración DEMO. El registro de clientes aún no está disponible.</p>}
        <p className="mt-4 text-xs text-slate-500">Las condiciones de la promoción vigente se muestran dentro de tu tarjeta cuando el programa esté habilitado.</p>
      </section>
      <div><PassportCard sample stampsBalance={3} stampsRequired={5} rewardsAvailable={0} rewardDescription="Tu recompensa" theme={theme} />
        <p className="mt-3 text-center text-xs text-slate-500">Tarjeta ilustrativa; los sellos y reglas reales se consultan al entrar.</p></div>
    </div>
  </main>;
}
