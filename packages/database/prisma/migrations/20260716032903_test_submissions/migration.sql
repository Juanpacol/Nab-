-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATING', 'EVALUATED', 'EVALUATION_FAILED');

-- CreateTable
CREATE TABLE "TestSubmission" (
    "id" TEXT NOT NULL,
    "techTestId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "answersJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER,
    "evaluationAttempt" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestSubmission_applicationId_key" ON "TestSubmission"("applicationId");

-- CreateIndex
CREATE INDEX "TestSubmission_techTestId_status_idx" ON "TestSubmission"("techTestId", "status");

-- CreateIndex
CREATE INDEX "TestSubmission_jobId_status_idx" ON "TestSubmission"("jobId", "status");

-- CreateIndex
CREATE INDEX "TestSubmission_userId_idx" ON "TestSubmission"("userId");

-- AddForeignKey
ALTER TABLE "TestSubmission" ADD CONSTRAINT "TestSubmission_techTestId_fkey" FOREIGN KEY ("techTestId") REFERENCES "TechTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSubmission" ADD CONSTRAINT "TestSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
