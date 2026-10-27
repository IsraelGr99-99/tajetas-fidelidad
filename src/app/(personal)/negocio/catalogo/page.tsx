import type { Metadata } from "next";
import { ProductImport } from "@/components/imports/Importers";
import { Notice } from "@/components/staff/OperationParts";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogList, type CatalogRow } from "./CatalogList";
import { CategoryManager } from "./CategoryManager";
import { ProductForm } from "./ProductForm";
import { PricingCalculator } from "./PricingCalculator";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage() {
  const { membership } = await requireCapability("manage_campaigns");
  const supabase = await createSupabaseServerClient();
  const [catalogResult, categoryResult] = await Promise.all([
    supabase?.rpc("admin_catalog", { p_business_id: membership.business_id }),
    supabase?.from("product_categories").select("name").eq("business_id", membership.business_id).order("name"),
  ]);
  const { data, error } = catalogResult ?? { data: null, error: true };
  const products = ((data?.ok ? data.products : []) as (Omit<CatalogRow, "image_url"> & { image_path?: string | null })[])
    .map((product): CatalogRow => ({ ...product, image_url: product.image_path && supabase
      ? supabase.storage.from("product-photos").getPublicUrl(product.image_path).data.publicUrl : null }));
  const categories = categoryResult?.error ? [...new Set(products.map((p) => p.category))] : (categoryResult?.data ?? []).map((c) => c.name);
  const hasSamples = products.some((p) => p.name.includes("(ejemplo)") || p.name.includes("(DEMO)"));
  const withoutCost = products.filter((p) => p.active && p.cost_cents === null).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Catálogo</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Registra lo que vendes, sus tamaños y precios. Después configura la receta de cada variante para que la caja descuente insumos.
        </p>
      </div>
      {error ? <Notice tone="error" title="No se pudo cargar el catálogo." /> : null}
      {categoryResult?.error ? <Notice tone="error" title="No se pudieron cargar las categorías. Verifica la migración de catálogo." /> : null}
      {hasSamples ? (
        <Notice tone="info" title="Hay productos de demostración">
          Sus precios, costos y recetas son ficticios. Reemplaza o desactiva los marcados “(ejemplo)” o “(DEMO)” antes de operar con datos reales.
        </Notice>
      ) : null}
      {withoutCost > 0 ? (
        <Notice tone="info" title={`${withoutCost} producto(s) activo(s) sin costo`}>
          Sin costo, el panel no puede calcular su ganancia. Agrégalo aquí o en tu archivo de importación.
        </Notice>
      ) : null}

      <nav aria-label="Acciones del catálogo" className="flex flex-wrap gap-2 text-sm font-semibold">
        <a href="#nuevo-producto" className="workspace-action">+ Nuevo producto</a>
        <a href="#categorias" className="workspace-action-secondary">Categorías</a>
        <a href="#importar-catalogo" className="workspace-action-secondary">Importar Excel</a>
      </nav>

      <CatalogList products={products} categories={categories} />

      <section id="nuevo-producto" className="workspace-card scroll-mt-24 p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-tabaco">Agregar producto o variante</h2>
        <div className="mt-4">
          <ProductForm product={null} categories={categories} />
        </div>
      </section>
      <section id="categorias" className="scroll-mt-24"><CategoryManager categories={categories} /></section>
      <details id="importar-catalogo" className="workspace-card scroll-mt-24 p-5 sm:p-6"><summary className="cursor-pointer text-lg font-semibold text-slate-950">Importar catálogo desde Excel</summary>
        <div className="mt-5"><ProductImport existingNames={products.map((p) => p.name)} /></div></details>
      <PricingCalculator />
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"><strong>Siguiente paso:</strong> cuando el producto esté listo, <a href="/negocio/inventario?vista=recetas" className="font-bold underline">define su receta</a> para habilitarlo en caja.</p>
    </div>
  );
}
