import type { Metadata } from "next";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BranchForm } from "./BranchForm";

export const metadata: Metadata = { title: "Sucursales" };

type Row = { id: string; name: string; address: string | null; active: boolean };

export default async function BranchesPage() {
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
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Sucursales</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Una sucursal inactiva deja de aparecer al personal y no acepta operaciones. Su historial se conserva.
        </p>
      </div>
      <section aria-labelledby="nueva-sucursal" className="rounded-3xl bg-papel p-6">
        <h2 id="nueva-sucursal" className="text-2xl text-tabaco">
          Nueva sucursal
        </h2>
        <div className="mt-4">
          <BranchForm branch={null} />
        </div>
      </section>
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
    </div>
  );
}
