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

  return <main id="contenido" className="console-shell grid min-h-dvh bg-[#f3f6fb] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <section className="relative hidden min-h-dvh overflow-hidden bg-[#11243e] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-11">
      <div aria-hidden="true" className="absolute -right-36 -top-44 h-[34rem] w-[34rem] rounded-full bg-blue-500/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-44 -left-40 h-[32rem] w-[32rem] rounded-full bg-cyan-300/10 blur-3xl" />
      <Link href="/" aria-label="iautomexa Loyalty, ir al inicio" className="relative flex w-fit items-center gap-3 text-white">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#3972e4] text-2xl font-black">L</span>
        <span><span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sky-200">Tecnología de iautomexa</span><span className="block text-xl font-bold leading-6">Loyalty</span></span>
      </Link>
      <div className="relative max-w-xl pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Espacio de trabajo para negocios</p>
        <h2 className="mt-5 text-4xl font-bold leading-tight text-white xl:text-5xl">Una operación más clara, desde la primera venta.</h2>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">Caja, inventario y fidelidad en un espacio diseñado para que tu equipo sepa qué hacer después.</p>
        <div className="mt-9 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm" aria-label="Áreas del espacio de trabajo">
          <div className="flex items-center justify-between border-b border-white/15 pb-4"><span className="text-sm font-bold text-white">Tu espacio de trabajo</span><span className="rounded-full bg-sky-300/15 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-sky-100">Vista ilustrativa</span></div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            <li className="rounded-xl border border-white/10 bg-white/10 p-3"><span className="text-xs font-bold text-sky-200">01</span><strong className="mt-2 block text-sm text-white">Caja</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Registra ventas</span></li>
            <li className="rounded-xl border border-white/10 bg-white/10 p-3"><span className="text-xs font-bold text-sky-200">02</span><strong className="mt-2 block text-sm text-white">Inventario</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Controla insumos</span></li>
            <li className="rounded-xl border border-white/10 bg-white/10 p-3"><span className="text-xs font-bold text-sky-200">03</span><strong className="mt-2 block text-sm text-white">Fidelidad</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Atiende clientes</span></li>
          </ol>
        </div>
      </div>
      <p className="relative text-xs text-slate-300">Acceso reservado para el personal autorizado de cada negocio.</p>
    </section>

    <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-12 lg:py-10 xl:px-20">
      <div className="flex items-center justify-between gap-3 lg:justify-end"><Link href="/" className="flex items-center gap-2 text-slate-950 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3972e4] font-black text-white">L</span><span className="font-bold">Loyalty</span></Link>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">Acceso del personal</span></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-9">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Bienvenido a tu negocio</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">Accede a tu espacio de trabajo</h1>
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
