import { Avatar, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nab/ui';
import type { RubricCriterion } from '@/lib/candidates';
import type { ComparisonCandidate } from '@/lib/compare';

function scoreFor(candidate: ComparisonCandidate, criterionId: string): number | null {
  const entry = candidate.testSubmission?.evaluation?.aiScoresJson?.find((c) => c.criterionId === criterionId);
  return entry?.score ?? null;
}

export function CandidateCompareGrid({
  criteria,
  candidates,
}: {
  criteria: RubricCriterion[];
  candidates: ComparisonCandidate[];
}) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Criterio</TableHead>
            {candidates.map((c) => (
              <TableHead key={c.id}>
                <div className="flex items-center gap-2">
                  <Avatar src={c.user.avatarUrl} name={c.user.name} size="sm" />
                  <span className="normal-case text-foreground">{c.user.name}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {criteria.map((crit) => {
            const scores = candidates.map((c) => scoreFor(c, crit.id));
            const maxScore = Math.max(...scores.filter((s): s is number => s != null), -1);
            return (
              <TableRow key={crit.id}>
                <TableCell className="whitespace-normal font-medium text-foreground">{crit.name}</TableCell>
                {candidates.map((c, i) => {
                  const score = scores[i];
                  const isTopScore = score != null && score === maxScore && maxScore >= 0;
                  return (
                    <TableCell key={c.id}>
                      {score == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={isTopScore ? 'font-semibold text-success' : 'text-foreground'}>
                          {score}/5
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          <TableRow>
            <TableCell className="font-medium text-foreground">Score final</TableCell>
            {candidates.map((c) => (
              <TableCell key={c.id}>
                {c.testSubmission?.evaluation?.finalScore != null ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{c.testSubmission.evaluation.finalScore}</span>
                    {c.testSubmission.evaluation.passed === true && <Badge variant="success">Aprobó</Badge>}
                    {c.testSubmission.evaluation.passed === false && <Badge variant="danger">No aprobó</Badge>}
                  </div>
                ) : (
                  <span className="text-muted">Sin veredicto</span>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
