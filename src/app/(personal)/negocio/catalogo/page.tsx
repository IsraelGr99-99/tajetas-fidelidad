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
  const products = (data?.ok ? data.products : []) as CatalogRow[];
  const categories = categoryResult?.error ? [...new Set(products.map((p) => p.category))] : (categoryResult?.data ?? []).map((c) => c.name);
  const hasSamples = products.some((p) => p.name.includes("(ejemplo)"));
  const withoutCost = products.filter((p) => p.active && p.cost_cents === null).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Catálogo</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Productos y servicios con precio y costo. El precio define el tope de las recompensas; el costo, la ganancia del panel. El barista no ve
          los costos.
        </p>
      </div>
      {error ? <Notice tone="error" title="No se pudo cargar el catálogo." /> : null}
      {categoryResult?.error ? <Notice tone="error" title="No se pudieron cargar las categorías. Verifica la migración de catálogo." /> : null}
      {hasSamples ? (
        <Notice tone="info" title="Hay productos de ejemplo">
          Importa tu lista real o desactiva los marcados “(ejemplo)” antes del piloto.
        </Notice>
      ) : null}
      {withoutCost > 0 ? (
        <Notice tone="info" title={`${withoutCost} producto(s) activo(s) sin costo`}>
          Sin costo, el panel no puede calcular su ganancia. Agrégalo aquí o en tu archivo de importación.
        </Notice>
      ) : null}

      <PricingCalculator />

      <ProductImport existingNames={products.map((p) => p.name)} />
      <CategoryManager categories={categories} />

      <details className="rounded-3xl bg-papel p-6">
        <summary className="cursor-pointer text-lg font-semibold text-tabaco">+ Agregar un producto a mano</summary>
        <div className="mt-4">
          <ProductForm product={null} categories={categories} />
        </div>
      </details>

      <CatalogList products={products} categories={categories} />
    </div>
  );
}
