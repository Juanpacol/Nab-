import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Avatar, Badge, Card, CardContent } from '@nab/ui';
import { getCompanyJob } from '@/lib/company-jobs';
import { getSubmissionDetail, listApplicants } from '@/lib/candidates';
import { getAccessToken, getCurrentUser } from '@/lib/session';
import { EvaluateButton } from '@/components/evaluate-button';
import { EvaluationSummary } from '@/components/evaluation-summary';
import { AnswerReviewList } from '@/components/answer-review-list';
import { ScoreOverrideForm } from '@/components/score-override-form';

export const metadata: Metadata = { title: 'Candidato · Nab' };

const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Tomando la prueba…',
  SUBMITTED: 'Prueba enviada — lista para evaluar',
  EVALUATING: 'Evaluando con IA…',
  EVALUATION_FAILED: 'La evaluación falló — puedes reintentar',
};

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const { id: jobId, applicationId } = await params;
  const user = await getCurrentUser();
  if (!user?.recruiterCompany) redirect('/empresa/onboarding');
  const access = await getAccessToken();
  if (!access) redirect('/login');
  const companyId = user.recruiterCompany.id;

  let job;
  try {
    job = await getCompanyJob(companyId, jobId, access);
  } catch {
    notFound();
  }

  const applicants = await listApplicants(companyId, jobId, access);
  const applicant = applicants.find((a) => a.id === applicationId);
  if (!applicant) notFound();

  const submission = applicant.testSubmission;
  const detail = submission && submission.status !== 'IN_PROGRESS' ? await getSubmissionDetail(companyId, submission.id, access) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/empresa/vacantes/${jobId}/candidatos`} className="text-sm text-muted hover:text-foreground">
          ← Candidatos de {job.title}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Avatar src={applicant.user.avatarUrl} name={applicant.user.name} size="lg" />
        <div>
          <h1 className="font-display text-2xl text-foreground">{applicant.user.name}</h1>
          <p className="text-sm text-muted">{applicant.user.email}</p>
        </div>
        <Badge variant="neutral" className="ml-auto">
          {applicant.status}
        </Badge>
      </div>

      {!submission && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted">Este candidato aún no tiene una prueba técnica asignada.</CardContent>
        </Card>
      )}

      {submission && submission.status === 'IN_PROGRESS' && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted">{SUBMISSION_STATUS_LABEL.IN_PROGRESS}</CardContent>
        </Card>
      )}

      {submission && (submission.status === 'SUBMITTED' || submission.status === 'EVALUATION_FAILED') && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-foreground">{SUBMISSION_STATUS_LABEL[submission.status]}</p>
            <EvaluateButton companyId={companyId} jobId={jobId} submissionId={submission.id} />
          </CardContent>
        </Card>
      )}

      {submission && submission.status === 'EVALUATING' && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted">{SUBMISSION_STATUS_LABEL.EVALUATING}</CardContent>
        </Card>
      )}

      {detail?.evaluation && (
        <>
          <Card>
            <CardContent className="pt-6">
              <EvaluationSummary evaluation={detail.evaluation} />
            </CardContent>
          </Card>

          <ScoreOverrideForm companyId={companyId} jobId={jobId} applicationId={applicationId} evaluation={detail.evaluation} />

          <div>
            <h2 className="mb-3 font-display text-lg text-foreground">Respuestas</h2>
            <AnswerReviewList
              questions={detail.techTest.questionsJson}
              answers={detail.answersJson ?? []}
              criteria={detail.techTest.rubricJson.criteria}
              criterionEvaluations={detail.evaluation.aiScoresJson}
            />
          </div>
        </>
      )}
    </div>
  );
}
