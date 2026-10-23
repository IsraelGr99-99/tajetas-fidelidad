import type { Metadata } from "next";
import { Notice } from "@/components/staff/OperationParts";
import { formatMxn } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductForm } from "./ProductForm";

export const metadata: Metadata = { title: "Catálogo" };

type Row = { id: string; name: string; category: string; price_cents: number; eligible_for_stamp: boolean; active: boolean };

export default async function CatalogPage() {
  const { membership } = await requireCapability("manage_campaigns");
  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase
    ?.from("products")
    .select("id, name, category, price_cents, eligible_for_stamp, active")
    .eq("business_id", membership.business_id)
    .order("active", { ascending: false })
    .order("category")
    .order("name")) ?? { data: null, error: true };
  const products = (data ?? []) as Row[];
  const categories = [...new Set(products.map((p) => p.category))];
  const hasSamples = products.some((p) => p.name.includes("(ejemplo)"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Catálogo</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          El servidor usa estos precios para calcular el tope de cada recompensa: el barista no puede cambiarlos al registrar una visita.
        </p>
      </div>
      {error ? <Notice tone="error" title="No se pudo cargar el catálogo." /> : null}
      {hasSamples ? (
        <Notice tone="info" title="Hay productos de ejemplo">
          Sustitúyelos por los reales de Café Nómada (o desactívalos) antes del piloto.
        </Notice>
      ) : null}

      <datalist id="categorias">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <section aria-labelledby="nuevo-producto" className="rounded-3xl bg-papel p-6">
        <h2 id="nuevo-producto" className="text-2xl text-tabaco">
          Agregar producto
        </h2>
        <div className="mt-4">
          <ProductForm product={null} categories={categories} />
        </div>
      </section>

      <section aria-labelledby="lista-productos">
        <h2 id="lista-productos" className="text-2xl text-tabaco">
          Productos ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className="mt-3 text-tabaco/75">Aún no hay productos.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {products.map((p) => (
              <li key={p.id} className={`rounded-2xl border border-tabaco/10 bg-papel ${p.active ? "" : "opacity-75"}`}>
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <span>
                      <span className="font-semibold text-tabaco">{p.name}</span>
                      <span className="block text-sm text-tabaco/75">
                        {p.category} · {formatMxn(p.price_cents)} · {p.eligible_for_stamp ? "suma sello" : "no suma"}
                        {p.active ? "" : " · no disponible"}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-arcilla-texto underline underline-offset-4">Editar</span>
                  </summary>
                  <div className="border-t border-tabaco/10 p-4">
                    <ProductForm
                      product={{ id: p.id, name: p.name, category: p.category, priceCents: p.price_cents, eligible: p.eligible_for_stamp, active: p.active }}
                      categories={categories}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
