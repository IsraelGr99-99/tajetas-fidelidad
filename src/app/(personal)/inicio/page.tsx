import type { Metadata } from "next";
import Link from "next/link";
import { NavGlyph, type NavIcon } from "@/components/staff/ConsoleNav";
import { requireStaff } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio del espacio de trabajo" };

type Product = { id: string; active: boolean };
type Inventory = {
  ok: true;
  products: { id: string }[];
  recipes: { product_id: string; item_id: string }[];
  balances: { branch_id: string; item_id: string; quantity: number }[];
};

export default async function WorkspaceHome() {
  const { membership, activeBranch } = await requireStaff();
  const admin = membership.role === "owner" || membership.role === "admin";
  const supabase = admin ? await createSupabaseServerClient() : null;
  const [catalogResult, inventoryResult] = supabase ? await Promise.all([
    supabase.rpc("admin_catalog", { p_business_id: membership.business_id }),
    supabase.rpc("inventory_overview", { p_business_id: membership.business_id }),
  ]) : [null, null];
  const catalog = catalogResult?.data?.ok && Array.isArray(catalogResult.data.products)
    ? (catalogResult.data.products as Product[]).filter((p) => p.active) : null;
  const inventory = inventoryResult?.data?.ok ? (inventoryResult.data as Inventory) : null;
  const hasRecipes = inventory && inventory.products.length > 0 &&
    inventory.products.every((p) => inventory.recipes.some((r) => r.product_id === p.id));
  const hasStock = inventory && activeBranch && inventory.recipes.length > 0 &&
    inventory.recipes.every((r) => inventory.balances.some((b) => b.branch_id === activeBranch.id && b.item_id === r.item_id && Number(b.quantity) > 0));
  const next = !activeBranch
    ? { href: "/cuenta", label: "Elegir sucursal", detail: "Selecciona dónde vas a trabajar antes de registrar movimientos." }
    : admin && catalog?.length === 0
      ? { href: "/negocio/catalogo", label: "Preparar catálogo", detail: "Primero registra los productos y sus precios." }
      : admin && !inventory
        ? { href: "/negocio/inventario", label: "Habilitar inventario", detail: "Este entorno aún no tiene disponible el módulo de inventario; pide aplicar la migración." }
        : admin && !hasRecipes
          ? { href: "/negocio/inventario", label: "Completar recetas", detail: "Cada producto necesita los insumos que se descontarán al vender." }
          : admin && !hasStock
            ? { href: "/negocio/inventario", label: "Cargar existencias", detail: "Registra el conteo de esta sucursal para poder vender." }
            : { href: "/caja", label: "Abrir caja", detail: "Registra una venta cobrada y continúa con fidelidad si el cliente participa." };

  return <div className="space-y-7">
    <section className="workspace-card overflow-hidden border-[#dce6f4] bg-[linear-gradient(115deg,#fff_60%,#edf4ff)] p-6 sm:p-8">
      <p className="workspace-kicker">Inicio · {membership.business_name}</p>
      <h1 className="mt-2 max-w-2xl text-3xl text-[#14233b] sm:text-4xl">Todo tu trabajo, en un solo lugar.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeBranch ? `Sucursal activa: ${activeBranch.name}.` : "Aún no has elegido una sucursal."} Empieza por la siguiente acción y usa el menú para consultar o configurar el negocio.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3"><Link href={next.href} className="workspace-action">{next.label}<span aria-hidden="true">→</span></Link>
        <p className="max-w-md text-sm text-slate-600">{next.detail}</p></div>
    </section>

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
      <div className="grid gap-3 sm:grid-cols-3">
        <SetupCard title="Catálogo y precios" href="/negocio/catalogo" detail={catalog === null ? "No disponible en este entorno" : `${catalog.length} producto${catalog.length === 1 ? "" : "s"} activo${catalog.length === 1 ? "" : "s"}`} ready={Boolean(catalog?.length)} icon="products" />
        <SetupCard title="Recetas" href="/negocio/inventario" detail={inventory ? `${new Set(inventory.recipes.map((r) => r.product_id)).size} de ${inventory.products.length} productos con receta` : "Módulo no disponible"} ready={Boolean(hasRecipes)} icon="inventory" />
        <SetupCard title="Existencias" href="/negocio/inventario" detail={activeBranch ? hasStock ? `Stock cargado en ${activeBranch.name}` : `Revisa el stock de ${activeBranch.name}` : "Elige una sucursal"} ready={Boolean(hasStock)} icon="inventory" />
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
