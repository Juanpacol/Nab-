import { Badge } from '@nab/ui';
import type { CriterionEvaluation, RubricCriterion, TechQuestion } from '@/lib/candidates';

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
};

function AnswerForQuestion({ question, answer }: { question: TechQuestion; answer: string | undefined }) {
  if (question.type === 'multiple_choice') {
    const options = (question.options as { id: string; text: string }[]) ?? [];
    const correctId = question.correctOptionId as string;
    const isCorrect = answer === correctId;
    return (
      <div className="space-y-1">
        {options.map((opt) => {
          const isCandidateChoice = opt.id === answer;
          const isCorrectOption = opt.id === correctId;
          return (
            <p
              key={opt.id}
              className={
                isCorrectOption
                  ? 'text-sm font-medium text-success'
                  : isCandidateChoice
                    ? 'text-sm font-medium text-danger'
                    : 'text-sm text-muted'
              }
            >
              {isCandidateChoice ? '→ ' : '  '}
              {opt.text}
              {isCorrectOption ? ' (correcta)' : ''}
            </p>
          );
        })}
        <Badge variant={isCorrect ? 'success' : 'danger'}>{isCorrect ? 'Correcto' : 'Incorrecto'}</Badge>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-sm text-foreground">{answer || <em className="text-muted">Sin respuesta</em>}</p>;
}

export function AnswerReviewList({
  questions,
  answers,
  criteria,
  criterionEvaluations,
}: {
  questions: TechQuestion[];
  answers: { questionId: string; answer: string }[];
  criteria: RubricCriterion[];
  criterionEvaluations: CriterionEvaluation[] | null;
}) {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.answer]));
  const evalByCriterion = new Map((criterionEvaluations ?? []).map((c) => [c.criterionId, c]));

  return (
    <div className="space-y-6">
      {questions.map((q) => {
        const relatedCriteria = criteria.filter((c) => c.appliesTo.includes(q.id));
        return (
          <div key={q.id} className="rounded-lg border border-border p-4">
            <p className="mb-3 text-sm font-medium text-foreground">{q.prompt}</p>
            <AnswerForQuestion question={q} answer={answerByQuestion.get(q.id)} />

            {relatedCriteria.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                {relatedCriteria.map((c) => {
                  const evaluation = evalByCriterion.get(c.id);
                  if (!evaluation) return null;
                  return (
                    <div key={c.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.name}</p>
                        <Badge variant="neutral">{evaluation.score}/5</Badge>
                        <Badge variant={CONFIDENCE_VARIANT[evaluation.confidence] ?? 'neutral'}>
                          confianza {evaluation.confidence}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{evaluation.justification}</p>
                      {evaluation.evidence.length > 0 && (
                        <ul className="mt-1 space-y-1">
                          {evaluation.evidence.map((e, i) => (
                            <li key={i} className="border-l-2 border-primary-soft pl-2 text-xs italic text-muted">
                              &ldquo;{e.quote}&rdquo;
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
