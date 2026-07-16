import { Badge } from '@nab/ui';
import type { CandidateEvaluation } from '@/lib/candidates';

export function EvaluationSummary({ evaluation }: { evaluation: CandidateEvaluation }) {
  return (
    <div className="space-y-4">
      {evaluation.injectionSuspected && (
        <div className="rounded-lg border border-danger bg-red-100 px-4 py-3 text-sm text-danger dark:bg-red-950/40">
          <p className="font-semibold">⚠ Posible manipulación del evaluador detectada</p>
          <p className="mt-1 text-foreground">
            La IA marcó esta submission como sospechosa de intentar manipular su propia evaluación. El veredicto
            automático quedó bloqueado — revisa las respuestas manualmente antes de decidir. Esto también aplica al
            resumen, fortalezas, debilidades y destacados de más abajo: vienen de la misma llamada sospechosa, así
            que trátalos como no confiables hasta que los verifiques contra las respuestas reales.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {evaluation.finalScore != null ? (
          <span className="font-display text-4xl text-foreground">{evaluation.finalScore}</span>
        ) : (
          <span className="font-display text-2xl text-muted">Sin veredicto</span>
        )}
        {evaluation.passed === true && <Badge variant="success">Aprobó</Badge>}
        {evaluation.passed === false && <Badge variant="danger">No aprobó</Badge>}
        {evaluation.passed == null && evaluation.finalScore == null && (
          <Badge variant="warning">Pendiente de revisión de RH</Badge>
        )}
      </div>

      {evaluation.aiSummary && (
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Resumen de la IA</p>
          <p className="text-sm leading-relaxed text-foreground">{evaluation.aiSummary}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {!!evaluation.aiHighlights?.length && (
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Destacados</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {evaluation.aiHighlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}
        {!!evaluation.aiStrengths?.length && (
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Fortalezas</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {evaluation.aiStrengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {!!evaluation.aiWeaknesses?.length && (
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Áreas de mejora</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {evaluation.aiWeaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {evaluation.overrideNotes && (
        <div className="rounded-lg bg-surface-2 px-4 py-3">
          <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted">Notas de RH</p>
          <p className="text-sm text-foreground">{evaluation.overrideNotes}</p>
        </div>
      )}
    </div>
  );
}
