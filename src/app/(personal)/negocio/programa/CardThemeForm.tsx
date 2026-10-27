"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveCardTheme, type CardThemeState } from "@/actions/card-theme";
import { contrastRatio, type CardTheme } from "@/domain/loyalty/branding";

const initialState: CardThemeState = { ok: false, message: "" };

export function CardThemeForm({ initial }: { initial: CardTheme }) {
  const [state, action, pending] = useActionState(saveCardTheme, initialState);
  const [background, setBackground] = useState(initial.background);
  const [secondary, setSecondary] = useState(initial.secondary);
  const [text, setText] = useState(initial.text);
  const contrastOk = contrastRatio(background, text) >= 4.5;
  const accentOk = contrastRatio(background, secondary) >= 3;

  return <section aria-labelledby="diseno-tarjeta" className="workspace-card p-5 sm:p-7">
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)]">
      <div>
        <p className="workspace-kicker">Identidad de tu negocio</p>
        <h2 id="diseno-tarjeta" className="mt-2 text-2xl font-bold text-slate-950">Diseña tu tarjeta</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Tu logo y colores se aplican a todas las tarjetas, incluidas las de clientes ya registrados. Los sellos y recompensas no cambian.</p>
        <form action={action} className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-slate-800">Logo del negocio
            <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm font-normal file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-800" />
            <span className="text-xs font-normal text-slate-500">Opcional · JPG, PNG o WebP · máximo 2 MB</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["background", "Fondo", background, setBackground],
              ["secondary", "Acento", secondary, setSecondary],
              ["text", "Texto", text, setText],
            ] as const).map(([name, label, value, setter]) => <label key={name} className="grid gap-2 text-sm font-semibold text-slate-800">{label}
              <span className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <input name={name} type="color" value={value} onChange={(event) => setter(event.target.value)} className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent" />
                <span className="font-mono text-xs uppercase text-slate-600">{value}</span>
              </span>
            </label>)}
          </div>
          {!contrastOk && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">El texto necesita más contraste con el fondo para poder leerse.</p>}
          {!accentOk && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">El acento necesita destacar más sobre el fondo.</p>}
          {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{state.message}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending || !contrastOk || !accentOk} className="workspace-action disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Guardando…" : "Guardar diseño"}</button>
            {initial.logoUrl && <button type="submit" name="intent" value="remove-logo" disabled={pending || !contrastOk || !accentOk} className="workspace-action-secondary">Quitar logo</button>}
          </div>
        </form>
      </div>
      <div className="flex items-center justify-center rounded-[2rem] bg-slate-100/70 p-5">
        <div aria-label="Vista previa de la tarjeta" className="w-full max-w-sm overflow-hidden rounded-[1.75rem] p-6 shadow-[0_20px_50px_rgba(16,32,64,.2)]" style={{ backgroundColor: background, color: text }}>
          <div className="flex items-center gap-3">
            {initial.logoUrl ? <Image src={initial.logoUrl} width={52} height={52} alt="Logo actual del negocio" unoptimized className="h-13 w-13 rounded-xl bg-white object-contain p-1" /> : <span className="grid h-13 w-13 place-items-center rounded-xl text-xl font-black" style={{ backgroundColor: secondary, color: background }}>{initial.businessName.slice(0, 1)}</span>}
            <div><p className="text-xs uppercase tracking-[0.18em] opacity-75">Tarjeta de fidelidad</p><p className="font-bold">{initial.businessName}</p></div>
          </div>
          <div className="mt-8 flex gap-2" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i} className="grid h-10 w-10 place-items-center rounded-full border text-sm font-bold" style={{ borderColor: secondary, backgroundColor: i < 3 ? secondary : "transparent", color: i < 3 ? background : text }}>{i < 3 ? "✓" : i + 1}</span>)}</div>
          <p className="mt-7 text-sm opacity-80">Cada visita cuenta.</p>
        </div>
      </div>
    </div>
  </section>;
}
