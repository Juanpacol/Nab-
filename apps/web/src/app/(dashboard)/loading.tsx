/**
 * Se muestra mientras carga cualquier ruta bajo (dashboard) — sin esto, un
 * cold start de la API en Render (Ruta A, hasta ~1 min) dejaba la pantalla
 * en blanco/congelada en vez de dar alguna señal de que algo está pasando.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm text-foreground/60">Cargando…</p>
    </div>
  );
}
