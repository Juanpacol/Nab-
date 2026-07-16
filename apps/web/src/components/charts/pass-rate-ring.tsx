'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { EmptyState } from '@nab/ui';
import { chartColors } from './chart-theme';
import { ChartTooltipBox, ChartTooltipRow } from './chart-tooltip';

interface PassRateRingProps {
  evaluatedCount: number;
  passRate: number | null;
}

function RingTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <ChartTooltipBox>
      <ChartTooltipRow label={p.name} value={p.value} swatch={p.payload.fill} />
    </ChartTooltipBox>
  );
}

export function PassRateRing({ evaluatedCount, passRate }: PassRateRingProps) {
  if (evaluatedCount === 0 || passRate == null) {
    return (
      <EmptyState
        title="Aún no hay evaluaciones"
        description="El pass rate aparece cuando al menos un candidato haya sido evaluado."
      />
    );
  }

  // El backend expone el % ya redondeado; derivamos los conteos absolutos
  // solo para dibujar el donut — es una aproximación visual, no un valor de
  // negocio (el finalScore/passed reales viven en CandidateEvaluation).
  const passedCount = Math.round((evaluatedCount * passRate) / 100);
  const notPassedCount = evaluatedCount - passedCount;

  const data = [
    { name: 'Aprobados', value: passedCount, fill: chartColors.success },
    { name: 'No aprobados', value: notPassedCount, fill: chartColors.danger },
  ];

  return (
    <div>
      <div
        className="relative"
        style={{ width: '100%', height: 180 }}
        role="img"
        aria-label={`Pass rate de pruebas técnicas: ${passRate}% (${passedCount} de ${evaluatedCount} evaluados aprobaron).`}
      >
        <ResponsiveContainer>
          <PieChart>
            <Tooltip content={<RingTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke={chartColors.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl text-foreground">{passRate}%</span>
          <span className="text-xs text-muted">aprobación</span>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-6 text-sm">
        <span className="flex items-center gap-1.5 text-foreground">
          <span aria-hidden className="text-success">✓</span>
          Aprobados <span className="font-mono text-muted">({passedCount})</span>
        </span>
        <span className="flex items-center gap-1.5 text-foreground">
          <span aria-hidden className="text-danger">✕</span>
          No aprobados <span className="font-mono text-muted">({notPassedCount})</span>
        </span>
      </div>
    </div>
  );
}
