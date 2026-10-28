import type { Metadata } from "next";
import { ProductImport } from "@/components/imports/Importers";
import { Notice } from "@/components/staff/OperationParts";
import { SectionNav } from "@/components/staff/SectionNav";
import { requireCapability } from "@/lib/staff/session";
import { demoProductImage } from "@/lib/demo-product-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CatalogList, type CatalogRow } from "./CatalogList";
import { CategoryManager } from "./CategoryManager";
import { ProductForm } from "./ProductForm";
import { PricingCalculator } from "./PricingCalculator";

export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage() {
  const { membership } = await requireCapability("manage_campaigns");
  const supabase = await createSupabaseServerClient();
  const [catalogResult, categoryResult, inventoryResult] = await Promise.all([
    supabase?.rpc("admin_catalog", { p_business_id: membership.business_id }),
    supabase?.from("product_categories").select("name").eq("business_id", membership.business_id).order("name"),
    supabase?.rpc("inventory_overview", { p_business_id: membership.business_id }),
  ]);
  const { data, error } = catalogResult ?? { data: null, error: true };
  const products = ((data?.ok ? data.products : []) as (Omit<CatalogRow, "image_url"> & { image_path?: string | null })[])
    .map((product): CatalogRow => ({ ...product, image_url: product.image_path && supabase
      ? supabase.storage.from("product-photos").getPublicUrl(product.image_path).data.publicUrl
      : membership.is_demo ? demoProductImage(membership.business_id, product.name) : null }));
  const categories = categoryResult?.error ? [...new Set(products.map((p) => p.category))] : (categoryResult?.data ?? []).map((c) => c.name);
  const hasSamples = products.some((p) => p.name.includes("(ejemplo)") || p.name.includes("(DEMO)"));
  const withoutCost = products.filter((p) => p.active && p.cost_cents === null).length;
  const inventory = inventoryResult?.data?.ok ? inventoryResult.data as {
    items: { id: string; name: string; unit: string }[];
    recipes: { product_id: string; item_id: string; quantity: number }[];
  } : null;

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

      <SectionNav label="Secciones del catálogo" items={[{ href: "#lista-productos", label: "Productos" }, { href: "#nuevo-producto", label: "+ Nuevo producto" }, { href: "#categorias", label: "Categorías" }, { href: "#importar-catalogo", label: "Importar Excel" }, { href: "#calculadora", label: "Calculadora" }]} />

      <CatalogList products={products} categories={categories} recipes={inventory?.recipes ?? null} />

      <section id="nuevo-producto" className="workspace-card scroll-mt-24 p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-tabaco">Agregar producto o variante</h2>
        <div className="mt-4">
          <ProductForm product={null} categories={categories} />
        </div>
      </section>
      <section id="categorias" className="scroll-mt-24"><CategoryManager categories={categories} /></section>
      <details id="importar-catalogo" className="workspace-card scroll-mt-24 p-5 sm:p-6"><summary className="cursor-pointer text-lg font-semibold text-slate-950">Importar catálogo desde Excel</summary>
        <div className="mt-5"><ProductImport existingNames={products.map((p) => p.name)} /></div></details>
      <div id="calculadora" className="scroll-mt-24"><PricingCalculator products={products.map((product) => ({ id: product.id, name: product.name, priceCents: product.price_cents, costCents: product.cost_cents }))} items={inventory?.items ?? []} recipes={inventory?.recipes ?? []} /></div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"><strong>Siguiente paso:</strong> cuando el producto esté listo, <a href="/negocio/inventario?vista=recetas" className="font-bold underline">define su receta</a> para habilitarlo en caja.</p>
    </div>
  );
}
