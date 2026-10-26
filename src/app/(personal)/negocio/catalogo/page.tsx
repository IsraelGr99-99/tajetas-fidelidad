import type { Metadata } from "next";
import { ProductImport } from "@/components/imports/Importers";
import { Notice } from "@/components/staff/OperationParts";
import { formatMxn } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductForm } from "./ProductForm";
import { PricingCalculator } from "./PricingCalculator";

export const metadata: Metadata = { title: "Catálogo" };

type Row = { id: string; name: string; category: string; price_cents: number; cost_cents: number | null; eligible: boolean; active: boolean };

export default async function CatalogPage() {
  const { membership } = await requireCapability("manage_campaigns");
  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase?.rpc("admin_catalog", { p_business_id: membership.business_id })) ?? { data: null, error: true };
  const products = (data?.ok ? data.products : []) as Row[];
  const categories = [...new Set(products.map((p) => p.category))];
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

      <datalist id="categorias">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <details className="rounded-3xl bg-papel p-6">
        <summary className="cursor-pointer text-lg font-semibold text-tabaco">+ Agregar un producto a mano</summary>
        <div className="mt-4">
          <ProductForm product={null} categories={categories} />
        </div>
      </details>

      <section aria-labelledby="lista-productos">
        <h2 id="lista-productos" className="text-2xl text-tabaco">
          Productos ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className="mt-3 text-tabaco/75">Aún no hay productos. Importa tu lista o agrégalos a mano.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {products.map((p) => {
              const margin = p.cost_cents !== null && p.price_cents > 0 ? Math.round(((p.price_cents - p.cost_cents) / p.price_cents) * 100) : null;
              return (
                <li key={p.id} className={`rounded-2xl border border-tabaco/10 bg-papel ${p.active ? "" : "opacity-75"}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <span className="min-w-0">
                        <span className="font-semibold text-tabaco">{p.name}</span>
                        <span className="block text-sm text-tabaco/75">
                          {p.category} · {p.eligible ? "suma sello" : "no suma"}
                          {p.active ? "" : " · no disponible"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        <span className="block font-semibold text-tabaco">{formatMxn(p.price_cents)}</span>
                        <span className="text-tabaco/75">{margin !== null ? `margen ${margin} %` : "sin costo"}</span>
                      </span>
                    </summary>
                    <div className="border-t border-tabaco/10 p-4">
                      <ProductForm
                        product={{
                          id: p.id,
                          name: p.name,
                          category: p.category,
                          priceCents: p.price_cents,
                          costCents: p.cost_cents,
                          eligible: p.eligible,
                          active: p.active,
                        }}
                        categories={categories}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
