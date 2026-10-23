export default function ConsoleLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Cargando la consola…</span>
      <div className="h-4 w-32 rounded bg-tabaco/10" />
      <div className="h-10 w-2/3 rounded bg-tabaco/10" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-3xl bg-tabaco/10" />
        <div className="h-36 rounded-3xl bg-tabaco/10" />
      </div>
    </div>
  );
}
