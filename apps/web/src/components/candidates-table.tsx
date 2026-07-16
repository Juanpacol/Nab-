'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Avatar,
  Badge,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nab/ui';
import type { Applicant } from '@/lib/candidates';
import { updateApplicantStatusAction } from '@/app/actions/candidates';
import { CompareBar } from '@/components/compare-bar';

const STATUS_FILTERS = ['APPLIED', 'VIEWED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'];
const MOVABLE_STATUSES = ['APPLIED', 'VIEWED', 'INTERVIEW', 'OFFER', 'REJECTED'];

type SortKey = 'recent' | 'match' | 'score';

function testBadge(testSubmission: Applicant['testSubmission']) {
  if (!testSubmission) return <span className="text-xs text-muted">Sin prueba asignada</span>;
  const { status, evaluation } = testSubmission;
  if (status === 'EVALUATED' && evaluation) {
    if (evaluation.passed === true) return <Badge variant="success">Aprobó ({evaluation.finalScore})</Badge>;
    if (evaluation.passed === false) return <Badge variant="danger">No aprobó ({evaluation.finalScore})</Badge>;
    return <Badge variant="warning">Evaluado — pendiente de revisión</Badge>;
  }
  const labels: Record<string, string> = {
    IN_PROGRESS: 'Prueba en curso',
    SUBMITTED: 'Prueba enviada',
    EVALUATING: 'Evaluando…',
    EVALUATION_FAILED: 'Evaluación falló',
  };
  return <Badge variant="neutral">{labels[status] ?? status}</Badge>;
}

export function CandidatesTable({
  companyId,
  jobId,
  applicants,
}: {
  companyId: string;
  jobId: string;
  applicants: Applicant[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function toggleSelect(applicationId: string) {
    setSelectedIds((prev) =>
      prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId],
    );
  }

  const rows = useMemo(() => {
    let filtered = applicants;
    if (statusFilter !== 'ALL') filtered = filtered.filter((a) => a.status === statusFilter);
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'match') return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (sortKey === 'score') {
        const scoreA = a.testSubmission?.evaluation?.finalScore ?? -1;
        const scoreB = b.testSubmission?.evaluation?.finalScore ?? -1;
        return scoreB - scoreA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [applicants, statusFilter, sortKey]);

  function handleStatusChange(applicationId: string, status: string) {
    setError(null);
    setPendingId(applicationId);
    startTransition(async () => {
      const result = await updateApplicantStatusAction(companyId, jobId, applicationId, status);
      setPendingId(null);
      if (result.error) setError(result.error);
    });
  }

  if (applicants.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Aún no hay aplicantes para esta vacante.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
          aria-label="Filtrar por estado"
        >
          <option value="ALL">Todos los estados</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="w-auto"
          aria-label="Ordenar por"
        >
          <option value="recent">Más recientes</option>
          <option value="match">Mayor match</option>
          <option value="score">Mayor score de prueba</option>
        </Select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Candidato</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prueba técnica</TableHead>
            <TableHead>Aplicó</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={() => toggleSelect(a.id)}
                  disabled={!selectedIds.includes(a.id) && selectedIds.length >= 4}
                  aria-label={`Seleccionar a ${a.user.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar src={a.user.avatarUrl} name={a.user.name} size="sm" />
                  <div>
                    <p className="text-foreground">{a.user.name}</p>
                    <p className="text-xs text-muted">{a.user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={a.status}
                  disabled={pendingId === a.id}
                  onChange={(e) => handleStatusChange(a.id, e.target.value)}
                  className="h-9 w-auto text-xs"
                  aria-label={`Estado de ${a.user.name}`}
                >
                  {MOVABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {!MOVABLE_STATUSES.includes(a.status) && <option value={a.status}>{a.status}</option>}
                </Select>
              </TableCell>
              <TableCell>{testBadge(a.testSubmission)}</TableCell>
              <TableCell className="text-xs text-muted">
                {new Date(a.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </TableCell>
              <TableCell>
                <Link href={`/empresa/vacantes/${jobId}/candidatos/${a.id}`} className="text-sm text-primary hover:underline">
                  Ver detalle
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CompareBar jobId={jobId} selectedIds={selectedIds} />
    </div>
  );
}
