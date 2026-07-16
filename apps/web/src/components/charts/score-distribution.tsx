'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@nab/ui';
import { chartAxisTick, chartColors, chartGrid } from './chart-theme';
import { ChartTooltipBox, ChartTooltipRow } from './chart-tooltip';

interface ScoreDistributionProps {
  bins: { binStart: number; count: number }[];
  passScore: number | null;
}

function DistributionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipBox>
      <ChartTooltipRow label={p.label} value={p.count} swatch={p.fill} />
    </ChartTooltipBox>
  );
}

export function ScoreDistribution({ bins, passScore }: ScoreDistributionProps) {
  const total = bins.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="Aún no hay scores para mostrar"
        description="La distribución aparece cuando la IA evalúa al menos un candidato."
      />
    );
  }

  const rows = bins.map((b) => {
    const isPassingBin = passScore != null && b.binStart + 9 >= passScore;
    return {
      ...b,
      label: `${b.binStart}-${b.binStart + 9}`,
      fill: isPassingBin ? chartColors.success : chartColors.border,
    };
  });

  return (
    <div>
      <div
        style={{ width: '100%', height: 180 }}
        role="img"
        aria-label={`Distribución de scores de evaluación IA. Nota de aprobación: ${passScore ?? 'sin definir'}.`}
      >
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartGrid.stroke} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ ...chartAxisTick, fontSize: 10 }} interval={1} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} width={28} />
            <Tooltip content={<DistributionTooltip />} cursor={{ fill: chartColors.border, opacity: 0.3 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.label} fill={r.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {passScore != null && (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.success }} />
          Nota de aprobación: {passScore}
        </p>
      )}
    </div>
  );
}
