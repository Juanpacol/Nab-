'use client';

import { useState, useTransition } from 'react';
import { Button, Card, CardContent } from '@nab/ui';
import { generateAiComparisonAction } from '@/app/actions/candidates';
import type { AiComparison } from '@/lib/compare';

export function AiComparisonPanel({
  companyId,
  jobId,
  applicationIds,
  candidateNames,
  criteriaNames,
}: {
  companyId: string;
  jobId: string;
  applicationIds: string[];
  candidateNames: Record<string, string>;
  criteriaNames: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  function nameFor(ref: string, legend: AiComparison['candidateLegend']): string {
    const applicationId = legend.find((l) => l.candidateRef === ref)?.applicationId;
    return (applicationId && candidateNames[applicationId]) || `Candidato ${ref}`;
  }

  function generate() {
    setError(null);
    // Clave fresca por cada click explícito — nunca se reutiliza en un
    // reintento automático, así que un doble-submit o un retry de red del
    // MISMO click no puede cobrar dos veces (choca con el refId único en
    // vez de generar un segundo cobro).
    const idempotencyKey = crypto.randomUUID();
    startTransition(async () => {
      const res = await generateAiComparisonAction(companyId, jobId, applicationIds, idempotencyKey);
      if (res.error) setError(res.error);
      else if (res.data) setResult(res.data);
    });
  }

  if (!result) {
    return (
      <div>
        <Button onClick={generate} disabled={pending} variant="outline">
          {pending ? 'Generando análisis…' : 'Generar análisis IA'}
        </Button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">
          Analiza únicamente las evaluaciones ya persistidas — no vuelve a leer las respuestas del candidato ni
          recomienda a quién contratar. Cuesta 1 crédito.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {result.byCriterion.length > 0 ? (
          <div className="space-y-3">
            {result.byCriterion.map((entry) => (
              <div key={entry.criterionId}>
                <p className="text-sm font-semibold text-foreground">
                  {criteriaNames[entry.criterionId] ?? entry.criterionId}
                  {entry.tied && <span className="ml-2 text-xs font-normal text-muted">(empate)</span>}
                </p>
                <p className="text-sm text-foreground">{entry.analysis}</p>
                <p className="mt-1 text-xs text-muted">
                  {entry.scores.map((s) => `${nameFor(s.candidateRef, result.candidateLegend)}: ${s.score}/5`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">La IA no pudo generar un análisis verificable para estos criterios.</p>
        )}

        {result.tradeoffs.length > 0 && (
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Tradeoffs</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {result.tradeoffs.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {result.caveats.length > 0 && (
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Advertencias</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted">
              {result.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted">Este análisis no recomienda a quién contratar — la decisión es tuya.</p>
      </CardContent>
    </Card>
  );
}
