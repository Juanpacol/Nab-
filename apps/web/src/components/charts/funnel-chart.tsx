'use client';

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@nab/ui';
import { chartAxisTick, chartColors } from './chart-theme';
import { ChartTooltipBox, ChartTooltipRow } from './chart-tooltip';

// Progresión ordenada del funnel — orden real, no alfabético. SAVED (guardado
// sin aplicar) y los estados terminales REJECTED/WITHDRAWN quedan fuera: son
// salidas del funnel, no un paso "más avanzado" — mezclarlos en las mismas
// barras falsearía la magnitud de la progresión.
const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: 'APPLIED', label: 'Aplicado' },
  { key: 'VIEWED', label: 'Visto' },
  { key: 'INTERVIEW', label: 'Entrevista' },
  { key: 'OFFER', label: 'Oferta' },
];

interface FunnelChartProps {
  byStatus: Record<string, number>;
}

function FunnelTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipBox>
      <ChartTooltipRow label={p.label} value={p.count} swatch={chartColors.primary} />
      {p.conversion != null && (
        <p className="mt-1 text-xs text-muted">{p.conversion}% de la etapa anterior</p>
      )}
    </ChartTooltipBox>
  );
}

export function FunnelChart({ byStatus }: FunnelChartProps) {
  const rows = FUNNEL_STAGES.map((stage, i) => {
    const count = byStatus[stage.key] ?? 0;
    const prevCount = i > 0 ? (byStatus[FUNNEL_STAGES[i - 1]!.key] ?? 0) : null;
    const conversion = prevCount != null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
    return { ...stage, count, conversion };
  });

  const rejected = (byStatus.REJECTED ?? 0) + (byStatus.WITHDRAWN ?? 0);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="Aún no hay aplicantes"
        description="El funnel se completa a medida que los candidatos avanzan por el proceso."
      />
    );
  }

  const summary = rows.map((r) => `${r.label}: ${r.count}`).join(', ');

  return (
    <div>
      <div
        style={{ width: '100%', height: FUNNEL_STAGES.length * 44 + 16 }}
        role="img"
        aria-label={`Funnel de aplicantes por etapa. ${summary}.`}
      >
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={90}
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
            />
            <Tooltip content={<FunnelTooltip />} cursor={{ fill: chartColors.border, opacity: 0.3 }} />
            <Bar dataKey="count" fill={chartColors.primary} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.key} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: chartColors.textPrimary, fontSize: 12, fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
        {rows.slice(1).map((r) => (
          <span key={r.key}>
            {r.label}: {r.conversion != null ? `${r.conversion}%` : '—'}
          </span>
        ))}
        {rejected > 0 && <span>Rechazados/retirados: {rejected}</span>}
      </div>
    </div>
  );
}
