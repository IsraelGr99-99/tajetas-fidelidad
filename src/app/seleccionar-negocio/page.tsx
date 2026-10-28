import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { selectBusinessAction } from "@/actions/staff-session";
import { staffContextSchema } from "@/domain/staff/permissions";
import { LOGIN_PATH, NO_ACCESS_PATH, safeNextPath } from "@/domain/staff/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Elegir negocio", robots: { index: false } };

export default async function SelectBusinessPage({ searchParams }: { searchParams: Promise<{ error?: string; siguiente?: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(LOGIN_PATH);
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(LOGIN_PATH);
  const { data, error } = await supabase.rpc("get_staff_context");
  if (error) throw new Error(`get_staff_context falló (${error.code ?? "sin código"})`);
  const parsed = staffContextSchema.parse(data);
  if (!parsed.ok || parsed.memberships.length === 0) redirect(NO_ACCESS_PATH);
  const { error: selectionError, siguiente } = await searchParams;

  return <main id="contenido" className="flex min-h-dvh items-center justify-center bg-[#f3f6fb] px-4 py-10 text-slate-900">
    <section aria-labelledby="elegir-negocio" className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(40,66,110,.1)] sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">iautomexa · Loyalty</p>
      <h1 id="elegir-negocio" className="mt-3 text-3xl font-bold tracking-tight">Elige tu negocio</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Tus datos y sucursales se muestran por separado. Puedes cambiar de negocio después desde Mi cuenta.</p>
      {selectionError ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">No tienes acceso a ese negocio. Elige uno de la lista.</p> : null}
      <ul className="mt-6 space-y-3">{parsed.memberships.map((membership) => <li key={membership.business_id}>
        <form action={selectBusinessAction}>
          <input type="hidden" name="businessId" value={membership.business_id} />
          <input type="hidden" name="returnTo" value={safeNextPath(siguiente)} />
          <button type="submit" className="flex min-h-16 w-full cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 text-left transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-3 focus-visible:outline-blue-500">
            <span><span className="block text-lg font-bold">{membership.business_name}</span><span className="text-sm text-slate-500">{membership.branches.length} sucursal{membership.branches.length === 1 ? "" : "es"} disponible{membership.branches.length === 1 ? "" : "s"}</span></span>
            <span aria-hidden="true" className="text-xl text-blue-700">→</span>
          </button>
        </form>
      </li>)}</ul>
    </section>
  </main>;
}
