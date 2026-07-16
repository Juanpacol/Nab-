'use client';

/**
 * Tooltip temático compartido — Recharts trae un tooltip default con fondo
 * blanco fijo, que rompe en dark mode. Este usa tokens de superficie/texto
 * para heredar el tema en runtime.
 */
export function ChartTooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-soft" role="tooltip">
      {children}
    </div>
  );
}

export function ChartTooltipRow({ label, value, swatch }: { label: string; value: React.ReactNode; swatch?: string }) {
  return (
    <div className="flex items-center gap-2">
      {swatch && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: swatch }} />}
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}
