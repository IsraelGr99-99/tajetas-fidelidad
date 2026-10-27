import type { Metadata } from "next";
import Link from "next/link";
import { NavGlyph, type NavIcon } from "@/components/staff/ConsoleNav";
import { requireStaff } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DemoControls } from "@/app/(personal)/negocio/finanzas/FinanceControls";

export const metadata: Metadata = { title: "Inicio del espacio de trabajo" };

type Product = { id: string; active: boolean };
type Inventory = {
  ok: true;
  items: { id: string }[];
  products: { id: string }[];
  recipes: { product_id: string; item_id: string }[];
  balances: { branch_id: string; item_id: string; quantity: number }[];
};

export default async function WorkspaceHome() {
  const { membership, activeBranch } = await requireStaff();
  const admin = membership.role === "owner" || membership.role === "admin";
  const supabase = admin ? await createSupabaseServerClient() : null;
  const [catalogResult, inventoryResult, demoResult] = supabase ? await Promise.all([
    supabase.rpc("admin_catalog", { p_business_id: membership.business_id }),
    supabase.rpc("inventory_overview", { p_business_id: membership.business_id }),
    membership.is_demo ? supabase.rpc("finance_records", { p_business_id: membership.business_id }) : Promise.resolve(null),
  ]) : [null, null, null];
  const catalog = catalogResult?.data?.ok && Array.isArray(catalogResult.data.products)
    ? (catalogResult.data.products as Product[]).filter((p) => p.active) : null;
  const inventory = inventoryResult?.data?.ok ? (inventoryResult.data as Inventory) : null;
  const demoFinance = demoResult?.data?.ok ? demoResult.data as { imports?: { is_demo: boolean }[]; expenses?: { is_demo: boolean }[] } : null;
  const hasDemoFinance = Boolean(demoFinance?.imports?.some((row) => row.is_demo) || demoFinance?.expenses?.some((row) => row.is_demo));
  const activeProductIds = new Set(catalog?.map((product) => product.id) ?? []);
  const hasRecipes = Boolean(inventory && activeProductIds.size > 0 &&
    [...activeProductIds].every((id) => inventory.recipes.some((recipe) => recipe.product_id === id)));
  const activeRecipes = inventory?.recipes.filter((recipe) => activeProductIds.has(recipe.product_id)) ?? [];
  const hasStock = Boolean(inventory && activeBranch && activeRecipes.length > 0 &&
    activeRecipes.every((recipe) => inventory.balances.some((balance) => balance.branch_id === activeBranch.id && balance.item_id === recipe.item_id && Number(balance.quantity) > 0)));
  const next = !activeBranch
    ? { href: "/cuenta", label: "Elegir sucursal", detail: "Selecciona dónde vas a trabajar antes de registrar movimientos." }
    : admin && catalog === null
      ? { href: "/negocio/catalogo", label: "Revisar catálogo", detail: "No se pudieron consultar los productos. Revisa la conexión antes de operar." }
      : admin && catalog?.length === 0
      ? { href: "/negocio/catalogo", label: "Preparar catálogo", detail: "Primero registra los productos y sus precios." }
      : admin && !inventory
        ? { href: "/negocio/inventario", label: "Revisar inventario", detail: "No se pudo consultar el inventario. Revisa la conexión antes de operar." }
        : admin && inventory?.items.length === 0
          ? { href: "/negocio/inventario?vista=gestionar", label: "Crear primer insumo", detail: "Registra los ingredientes o artículos que usarás en tus productos." }
        : admin && !hasRecipes
          ? { href: "/negocio/inventario?vista=recetas", label: "Completar recetas", detail: "Cada producto activo necesita los insumos que se descontarán al vender." }
          : admin && !hasStock
            ? { href: "/negocio/inventario?vista=ajustar", label: "Cargar existencias", detail: "Registra el conteo de esta sucursal para poder vender." }
            : { href: "/caja", label: "Abrir caja", detail: "Registra una venta cobrada y continúa con fidelidad si el cliente participa." };

  return <div className="space-y-7">
    <section className="workspace-card overflow-hidden border-[#dce6f4] bg-[linear-gradient(115deg,#fff_60%,#edf4ff)] p-6 sm:p-8">
      <p className="workspace-kicker">Inicio · {membership.business_name}</p>
      <h1 className="mt-2 max-w-2xl text-3xl text-[#14233b] sm:text-4xl">Todo tu trabajo, en un solo lugar.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeBranch ? `Sucursal activa: ${activeBranch.name}.` : "Aún no has elegido una sucursal."} Empieza por la siguiente acción y usa el menú para consultar o configurar el negocio.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3"><Link href={next.href} className="workspace-action">{next.label}<span aria-hidden="true">→</span></Link>
        <p className="max-w-md text-sm text-slate-600">{next.detail}</p></div>
    </section>

    {membership.is_demo && admin && <section aria-labelledby="demo-titulo" className="workspace-card border-amber-200 bg-[linear-gradient(120deg,#fffaf0,#fff)] p-6 sm:p-8">
      <p className="workspace-kicker text-amber-800">Recorrido de demostración · datos ficticios</p>
      <h2 id="demo-titulo" className="mt-2 text-2xl text-slate-950">Muestra Loyalty en cinco minutos</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">Explora el catálogo, el inventario y una venta en caja. Después consulta los reportes. Los importes generados aquí son ejemplos y nunca se presentan como ventas reales ni crean clientes ficticios.</p>
      <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <li><Link href="/negocio/catalogo" className="block rounded-xl border border-amber-100 bg-white p-3 font-semibold text-slate-800 hover:border-amber-400">1. Ver productos y variantes →</Link></li>
        <li><Link href="/negocio/inventario" className="block rounded-xl border border-amber-100 bg-white p-3 font-semibold text-slate-800 hover:border-amber-400">2. Ver stock y recetas →</Link></li>
        <li><Link href="/caja" className="block rounded-xl border border-amber-100 bg-white p-3 font-semibold text-slate-800 hover:border-amber-400">3. Probar la caja →</Link></li>
        <li><Link href="/negocio?rango=30" className="block rounded-xl border border-amber-100 bg-white p-3 font-semibold text-slate-800 hover:border-amber-400">4. Revisar indicadores →</Link></li>
      </ol>
      <div className="mt-5 border-t border-amber-200 pt-4">
        {demoFinance ? <><p className="mb-3 text-sm text-slate-700">{hasDemoFinance ? "Los reportes de ejemplo ya están cargados y rotulados DEMO." : "Si quieres ver gráficos con historia, carga 60 días ficticios de ventas y gastos."}</p><DemoControls hasDemo={hasDemoFinance} />{hasDemoFinance && <Link href="/negocio?rango=30" className="mt-3 inline-block text-sm font-bold text-blue-700 underline underline-offset-4">Ver análisis de ejemplo →</Link>}</> : <p className="text-sm text-amber-900">No se pudo consultar el estado de los reportes de ejemplo. Revisa la conexión antes de generarlos.</p>}
      </div>
    </section>}

    <section aria-labelledby="flujo-titulo" className="space-y-4"><div><p className="workspace-kicker">Operación diaria</p><h2 id="flujo-titulo" className="mt-1 text-2xl text-[#14233b]">El recorrido de una venta</h2>
      <p className="mt-1 text-sm text-slate-600">Dos registros distintos, presentados en el orden en que se atiende al cliente.</p></div>
      <ol className="grid gap-3 md:grid-cols-3">
        <FlowCard number="01" icon="cart" title="Cobrar en caja" description="Selecciona productos, confirma el pago y registra la venta. El inventario se descuenta automáticamente." href="/caja" link="Ir a caja" />
        <FlowCard number="02" icon="loyalty" title="Aplicar fidelidad" description="Si el cliente participa, escanea su QR y captura el folio del mismo ticket para sumar sellos o entregar un canje." href="/barra" link="Ir a fidelidad" />
        <FlowCard number="03" icon="chart" title="Revisar resultados" description={admin ? "Consulta ventas de caja por empleado y los reportes del negocio. Cada fuente de datos está identificada." : "La administración revisa ventas y movimientos; tú puedes seguir atendiendo al siguiente cliente."} href={admin ? "/negocio/ventas" : "/caja"} link={admin ? "Ver ventas" : "Siguiente venta"} />
      </ol>
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"><strong>Importante:</strong> caja y fidelidad aún son pasos separados. Registrar la venta no acredita sellos por sí solo; usa el mismo folio en fidelidad para evitar confusiones.</p>
    </section>

    {admin && <section aria-labelledby="preparacion-titulo" className="space-y-4"><div><p className="workspace-kicker">Administración</p><h2 id="preparacion-titulo" className="mt-1 text-2xl text-[#14233b]">Preparación del negocio</h2>
      <p className="mt-1 text-sm text-slate-600">Lo indispensable para vender con inventario. Los estados salen de los datos del servidor.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SetupCard title="Catálogo y precios" href="/negocio/catalogo" detail={catalog === null ? "No disponible en este entorno" : `${catalog.length} producto${catalog.length === 1 ? "" : "s"} activo${catalog.length === 1 ? "" : "s"}`} ready={Boolean(catalog?.length)} icon="products" />
        <SetupCard title="Insumos" href="/negocio/inventario?vista=gestionar" detail={inventory ? `${inventory.items.length} insumos registrados` : "Módulo no disponible"} ready={Boolean(inventory?.items.length)} icon="inventory" />
        <SetupCard title="Recetas" href="/negocio/inventario?vista=recetas" detail={inventory ? `${inventory.recipes.filter((recipe) => activeProductIds.has(recipe.product_id)).reduce((ids, recipe) => ids.add(recipe.product_id), new Set<string>()).size} de ${activeProductIds.size} productos activos con receta` : "Módulo no disponible"} ready={hasRecipes} icon="inventory" />
        <SetupCard title="Existencias" href="/negocio/inventario?vista=ajustar" detail={activeBranch ? hasStock ? `Stock cargado en ${activeBranch.name}` : `Revisa el stock de ${activeBranch.name}` : "Elige una sucursal"} ready={hasStock} icon="inventory" />
      </div></section>}
  </div>;
}

function FlowCard({ number, icon, title, description, href, link }: { number: string; icon: NavIcon; title: string; description: string; href: string; link: string }) {
  return <li className="workspace-card flex flex-col p-5"><div className="flex items-center justify-between"><span className="text-xs font-extrabold tracking-widest text-blue-600">{number}</span><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><NavGlyph name={icon} /></span></div>
    <h3 className="mt-4 text-lg text-[#14233b]">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p><Link href={href} className="mt-5 text-sm font-bold text-blue-700 hover:underline">{link} <span aria-hidden="true">→</span></Link></li>;
}

function SetupCard({ title, href, detail, ready, icon }: { title: string; href: string; detail: string; ready: boolean; icon: NavIcon }) {
  return <Link href={href} className="workspace-card group flex items-start gap-3 p-4 transition hover:border-blue-300 hover:shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><NavGlyph name={icon} /></span>
    <span><span className="block font-bold text-[#14233b] group-hover:text-blue-700">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{detail}</span><span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{ready ? "Configurado" : "Requiere atención"}</span></span></Link>;
}
