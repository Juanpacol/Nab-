'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@nab/ui';
import { chartAxisTick, chartColors, chartGrid } from './chart-theme';
import { ChartTooltipBox, ChartTooltipRow } from './chart-tooltip';

interface ApplicantsTrendProps {
  points: { date: string; count: number }[];
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="mb-1 text-xs text-muted">{formatDayLabel(p.date)}</p>
      <ChartTooltipRow label="Aplicantes" value={p.count} swatch={chartColors.primary} />
    </ChartTooltipBox>
  );
}

export function ApplicantsTrend({ points }: ApplicantsTrendProps) {
  const total = points.reduce((sum, p) => sum + p.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="Sin aplicantes en los últimos 30 días"
        description="La tendencia aparecerá aquí cuando lleguen nuevas aplicaciones."
      />
    );
  }

  // Etiquetas de eje cada ~5 días para no saturar 30 ticks en el eje X.
  const tickIndices = points
    .map((_, i) => i)
    .filter((i) => i === 0 || i === points.length - 1 || i % 5 === 0);

  return (
    <div
      style={{ width: '100%', height: 200 }}
      role="img"
      aria-label={`Tendencia de aplicantes en los últimos 30 días, total ${total}.`}
    >
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="applicants-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.1} />
              <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartGrid.stroke} vertical={false} />
          <XAxis
            dataKey="date"
            ticks={tickIndices.map((i) => points[i]!.date)}
            tickFormatter={formatDayLabel}
            tickLine={false}
            axisLine={false}
            tick={chartAxisTick}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} width={28} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: chartColors.border, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={chartColors.primary}
            strokeWidth={2}
            fill="url(#applicants-trend-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
