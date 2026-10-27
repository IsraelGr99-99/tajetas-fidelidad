import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/domain/staff/routes";
import { getStaffSession } from "@/lib/staff/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Acceso al negocio | iautomexa Loyalty" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ siguiente?: string; salida?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.siguiente);
  const session = await getStaffSession();
  if (session.status === "staff") redirect(next);

  return <main id="contenido" className="console-shell grid min-h-dvh bg-[#f3f6fb] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
    <section className="relative hidden min-h-dvh overflow-hidden border-r border-blue-100 bg-gradient-to-br from-[#eaf1ff] via-[#f7f9ff] to-[#fceef5] px-8 py-8 text-slate-950 lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-11">
      <div aria-hidden="true" className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
      <Link href="/" aria-label="iautomexa Loyalty, ir al inicio" className="relative flex w-fit items-center gap-3 text-slate-950">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-2xl font-black text-white shadow-lg shadow-blue-200">L</span>
        <span><span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-blue-700">Tecnología de iautomexa</span><span className="block text-xl font-bold leading-6">Loyalty</span></span>
      </Link>
      <div className="relative w-full max-w-2xl py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Tu negocio, en un solo lugar</p>
        <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Cada venta cuenta. Cada cliente también.</h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">Caja, inventario y fidelidad conectados para que veas lo importante y tu equipo sepa qué hacer.</p>
        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white bg-white/80 shadow-[0_25px_70px_rgba(53,76,125,.16)] backdrop-blur-xl" aria-label="Vista ilustrativa del espacio de trabajo">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><span className="text-sm font-bold">Loyalty <span className="font-normal text-slate-500">/ Mi negocio</span></span><span className="rounded-full bg-blue-50 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">Vista ilustrativa</span></div>
          <div className="grid grid-cols-[8rem_1fr] sm:grid-cols-[10rem_1fr]">
            <div className="space-y-2 border-r border-slate-100 bg-slate-50/70 p-3 text-xs font-semibold text-slate-600"><div className="rounded-xl bg-blue-100 px-3 py-2.5 text-blue-900">Inicio</div><div className="rounded-xl px-3 py-2.5">Caja</div><div className="rounded-xl px-3 py-2.5">Fidelidad</div><div className="rounded-xl px-3 py-2.5">Inventario</div><div className="rounded-xl px-3 py-2.5">Clientes</div></div>
            <div className="p-4 sm:p-5"><p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-blue-700">Resumen del negocio</p><p className="mt-1 text-lg font-bold">Todo claro, desde aquí</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><span className="block text-xl font-bold text-blue-800">01</span><span className="text-xs text-slate-700">Registra una venta</span></div><div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><span className="block text-xl font-bold text-violet-800">02</span><span className="text-xs text-slate-700">Suma fidelidad</span></div></div><div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900">Controla existencias por sucursal y actúa a tiempo.</div></div>
          </div>
        </div>
      </div>
      <p className="relative text-xs text-slate-500">Un espacio seguro para propietarios y personal autorizado.</p>
    </section>

    <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-12 lg:py-10 xl:px-20">
      <div className="flex items-center justify-between gap-3 lg:justify-end"><Link href="/" className="flex items-center gap-2 text-slate-950 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3972e4] font-black text-white">L</span><span className="font-bold">Loyalty</span></Link>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">Acceso al negocio</span></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-9">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Bienvenido a tu negocio</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Entra a Loyalty</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Usa el correo de tu equipo. Si recibiste una invitación, elige “Código por correo”.</p>
        {params.salida && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Cerraste sesión correctamente.</p>}
        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(20,35,59,0.06)] sm:p-7">
          {session.status === "not_configured" ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950"><strong>Acceso no disponible.</strong> Este entorno todavía no tiene conexión con Supabase.</p> : <LoginForm next={next} />}
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-slate-500">Este acceso es solo para personal autorizado. Si necesitas una cuenta, solicita una invitación al administrador de tu negocio.</p>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm text-slate-600"><span>© iautomexa Loyalty</span><Link href="/c/cafe-nomada" className="font-semibold text-blue-700 hover:underline">¿Buscas tu tarjeta de cliente? →</Link></div>
    </section>
  </main>;
}
