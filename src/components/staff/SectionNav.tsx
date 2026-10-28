type SectionLink = { href: string; label: string };

/** Accesos visibles a las tareas de una pantalla larga. */
export function SectionNav({ label, items }: { label: string; items: SectionLink[] }) {
  return <nav aria-label={label} className="sticky top-16 z-20 -mx-2 overflow-x-auto border-y border-blue-100 bg-white/95 px-2 py-3 backdrop-blur-lg sm:rounded-2xl sm:border sm:px-4">
    <div className="flex min-w-max items-center gap-2">
      <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ir a</span>
      {items.map((item) => <a key={item.href} href={item.href} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{item.label}</a>)}
    </div>
  </nav>;
}
