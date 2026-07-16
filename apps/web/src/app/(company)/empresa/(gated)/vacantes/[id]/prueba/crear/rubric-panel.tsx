import { Badge } from '@nab/ui';
import { TECH_STANDARDS_CATALOG, type Rubric, type VerifiedRubricReference } from '@nab/shared';

const STANDARDS_BY_ID = new Map(TECH_STANDARDS_CATALOG.map((s) => [s.slug, s]));

function ReferenceRow({ item }: { item: VerifiedRubricReference }) {
  const verified = item.verification.status === 'verified';
  const label =
    item.reference.kind === 'role_spec'
      ? `"${item.reference.quote}"`
      : item.reference.kind === 'standard'
        ? (STANDARDS_BY_ID.get(item.reference.standardId)?.name ?? item.reference.standardId)
        : 'Guía interna';

  return (
    <div className="flex items-start gap-2 text-xs">
      <Badge variant={verified ? 'success' : 'warning'} className="shrink-0">
        {verified ? '✓ Verificada' : '⚠ Sin verificar'}
      </Badge>
      <span className="text-muted">{label}</span>
    </div>
  );
}

/** Solo lectura en v1 — la estructura de la rúbrica se ajusta regenerando, no editando campo a campo. */
export function RubricPanel({ rubric }: { rubric: Rubric }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg text-foreground">Rúbrica de evaluación</h2>
        <p className="text-xs text-muted">Umbral de aprobación: {rubric.passThreshold}%</p>
      </div>
      {rubric.criteria.map((criterion) => (
        <div key={criterion.id} className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">{criterion.name}</p>
            <span className="font-mono text-xs text-muted">{Math.round(criterion.weight * 100)}%</span>
          </div>
          <p className="text-sm text-muted">{criterion.description}</p>
          <div className="space-y-1">
            {criterion.references.map((item, i) => (
              <ReferenceRow key={i} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
