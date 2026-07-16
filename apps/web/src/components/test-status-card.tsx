import Link from 'next/link';
import { Badge, Button } from '@nab/ui';
import type { TestSubmissionStatus } from '@/lib/applications';

const LABEL: Record<TestSubmissionStatus['status'], string> = {
  IN_PROGRESS: 'En curso',
  SUBMITTED: 'Enviada — en espera de evaluación',
  EVALUATING: 'Evaluando…',
  EVALUATED: 'Evaluada',
  EVALUATION_FAILED: 'Hubo un problema evaluando tu prueba',
};

const VARIANT: Record<TestSubmissionStatus['status'], 'neutral' | 'info' | 'success' | 'danger'> = {
  IN_PROGRESS: 'info',
  SUBMITTED: 'neutral',
  EVALUATING: 'info',
  EVALUATED: 'success',
  EVALUATION_FAILED: 'danger',
};

export function TestStatusCard({
  applicationId,
  submission,
}: {
  applicationId: string;
  submission: TestSubmissionStatus | null;
}) {
  if (!submission) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted">Esta vacante requiere una prueba técnica.</p>
        <Link href={`/applications/${applicationId}/prueba`}>
          <Button size="sm">Realizar prueba</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Badge variant={VARIANT[submission.status]}>{LABEL[submission.status]}</Badge>
      {submission.status === 'IN_PROGRESS' && (
        <Link href={`/applications/${applicationId}/prueba`}>
          <Button size="sm" variant="outline">
            Continuar prueba
          </Button>
        </Link>
      )}
    </div>
  );
}
