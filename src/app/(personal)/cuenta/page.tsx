import type { Metadata } from "next";
import { selectBranchAction } from "@/app/personal/actions";
import { requireStaff } from "@/lib/staff/session";

export const metadata: Metadata = { title: "Elegir sucursal" };

export default async function BranchPickerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { membership, activeBranch } = await requireStaff();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="bitacora text-arcilla-texto">Antes de empezar</p>
      <h1 className="mt-2 text-4xl text-tabaco">¿En qué sucursal estás hoy?</h1>
      <p className="mt-3 leading-7 text-tabaco/75">Las visitas y canjes que registres quedarán ligados a esta sucursal.</p>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
          No tienes acceso a esa sucursal. Elige una de la lista.
        </p>
      ) : null}

      {membership.branches.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-tabaco/25 bg-papel p-8 text-center">
          <h2 className="text-2xl text-tabaco">Aún no tienes sucursales asignadas</h2>
          <p className="mt-3 leading-7 text-tabaco/75">Pide a administración que te asigne al menos una sucursal para poder operar.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {membership.branches.map((branch) => {
            const current = activeBranch?.id === branch.id;
            return (
              <li key={branch.id}>
                <form action={selectBranchAction}>
                  <input type="hidden" name="branchId" value={branch.id} />
                  <button
                    type="submit"
                    aria-current={current ? "true" : undefined}
                    className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition ${
                      current ? "border-tabaco bg-tabaco text-crema" : "border-tabaco/15 bg-papel text-tabaco hover:border-tabaco"
                    }`}
                  >
                    <span className="font-display text-xl">{branch.name}</span>
                    <span className="text-sm font-semibold">{current ? "Sucursal actual" : "Elegir"}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
