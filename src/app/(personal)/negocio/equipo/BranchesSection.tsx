import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BranchForm } from "./BranchForm";

type Row = { id: string; name: string; address: string | null; active: boolean };

/** Sucursales dentro de Equipo: quién trabaja y dónde, en un solo lugar. */
export async function BranchesSection() {
  const { membership } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    ?.from("branches")
    .select("id, name, address, active")
    .eq("business_id", membership.business_id)
    .order("active", { ascending: false })
    .order("name")) ?? { data: null };
  const branches = (data ?? []) as Row[];

  return (
    <section aria-labelledby="sucursales-titulo" className="space-y-6">
      <div>
        <h2 id="sucursales-titulo" className="text-3xl text-tabaco">Sucursales</h2>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Una sucursal inactiva deja de aparecer al personal y no acepta operaciones. Su historial se conserva.
        </p>
      </div>
      <details className="rounded-3xl bg-papel p-6">
        <summary className="cursor-pointer text-lg font-semibold text-tabaco">+ Nueva sucursal</summary>
        <div className="mt-4">
          <BranchForm branch={null} />
        </div>
      </details>
      <ul className="space-y-3">
        {branches.map((b) => (
          <li key={b.id} className="rounded-2xl border border-tabaco/10 bg-papel">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <span>
                  <span className="font-semibold text-tabaco">{b.name}</span>
                  <span className="block text-sm text-tabaco/75">
                    {b.address ?? "Sin dirección"} · {b.active ? "activa" : "inactiva"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-arcilla-texto underline underline-offset-4">Editar</span>
              </summary>
              <div className="border-t border-tabaco/10 p-4">
                <BranchForm branch={b} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
