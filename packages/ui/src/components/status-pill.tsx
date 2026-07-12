import { Badge, type BadgeProps } from './badge';

/** Mapea cada estado de aplicación a una variante visual y su etiqueta en español. */
const STATUS_CONFIG: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  SAVED: { label: 'Guardado', variant: 'neutral' },
  APPLIED: { label: 'Aplicado', variant: 'info' },
  VIEWED: { label: 'Visto', variant: 'info' },
  INTERVIEW: { label: 'Entrevista', variant: 'primary' },
  OFFER: { label: 'Oferta', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
  WITHDRAWN: { label: 'Retirado', variant: 'warning' },
};

export function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
