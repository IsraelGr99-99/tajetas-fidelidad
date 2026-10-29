"use client";

import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { selectBranchAction } from "@/actions/staff-session";

/** Cambia de sucursal sin salir de la pantalla. La sucursal se valida en el servidor. */
export function BranchSwitcher({
  branches,
  activeId,
  tone = "light",
}: {
  branches: { id: string; name: string }[];
  activeId: string | null;
  tone?: "light" | "dark";
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const pathname = usePathname();
  const id = useId();
  const text = tone === "dark" ? "text-crema" : "text-tabaco";

  if (branches.length <= 1) {
    return <p className={`truncate text-sm font-semibold ${text}`}>{branches[0]?.name ?? "Sin sucursal"}</p>;
  }
  return (
    <form ref={formRef} action={selectBranchAction} className="min-w-0">
      <input type="hidden" name="returnTo" value={pathname} />
      <label htmlFor={id} className="sr-only">
        Sucursal
      </label>
      <select
        id={id}
        name="branchId"
        defaultValue={activeId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className={`max-w-full truncate rounded-full border px-3 py-1.5 text-sm font-semibold ${
          tone === "dark" ? "border-crema/25 bg-tabaco text-crema" : "min-h-9 border-slate-200 bg-white text-slate-900 shadow-[0_4px_12px_-8px_rgb(11_18_32/.4)] hover:border-slate-300"
        }`}
      >
        {activeId ? null : (
          <option value="" disabled>
            Elige sucursal
          </option>
        )}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </form>
  );
}
