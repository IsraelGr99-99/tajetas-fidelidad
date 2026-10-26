/**
 * Vista previa del panel del negocio. Las cifras son de demostración y van
 * rotuladas como DEMO: no representan a ningún negocio real.
 */

const KPIS = [
  { label: "Visitas con sello", value: "1,284", delta: "+18 %" },
  { label: "Clientes activos", value: "412", delta: "+9 %" },
  { label: "Recompensas canjeadas", value: "96", delta: "+12 %" },
];
const BARS = [38, 52, 46, 61, 58, 72, 66, 80, 74, 88, 83, 95];

export function DashboardPreview() {
  return (
    <figure aria-label="Vista previa del panel con datos de demostración" className="lx-panel relative overflow-hidden p-5 sm:p-7">
      <div aria-hidden="true" className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-electrico/25 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-niebla">Panel del negocio</p>
          <p className="text-lg font-bold">Resumen de los últimos 30 días</p>
        </div>
        <span className="lx-dato rounded-md border border-cian/40 bg-cian/10 px-2 py-1 text-xs font-bold text-cian">DEMO</span>
      </div>

      <dl className="relative mt-6 grid gap-3 sm:grid-cols-3">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl border border-white/10 bg-noche/60 p-4">
            <dt className="text-xs text-niebla">{k.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="lx-dato text-2xl font-bold">{k.value}</span>
              <span className="text-xs font-semibold text-cian">{k.delta}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="relative mt-5 rounded-2xl border border-white/10 bg-noche/60 p-4">
        <p className="text-xs text-niebla">Sellos por semana</p>
        <svg viewBox="0 0 240 80" className="mt-3 h-28 w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="barra" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-cian)" />
              <stop offset="1" stopColor="var(--color-electrico)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {BARS.map((h, i) => (
            <rect key={i} x={i * 20 + 4} y={80 - (h * 78) / 100} width="12" height={(h * 78) / 100} rx="3" fill="url(#barra)" />
          ))}
        </svg>
      </div>
    </figure>
  );
}
