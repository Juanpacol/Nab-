-- AlterEnum
ALTER TYPE "CreditReason" ADD VALUE 'EVALUATION';

-- CreateTable
CREATE TABLE "CandidateEvaluation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "aiScoresJson" JSONB,
    "aiSummary" TEXT,
    "aiTotalScore" INTEGER,
    "aiModel" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "overrideScoresJson" JSONB,
    "overrideTotalScore" INTEGER,
    "overrideNotes" TEXT,
    "overriddenByUserId" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "finalScore" INTEGER,
    "passed" BOOLEAN,

    CONSTRAINT "CandidateEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEvaluation_submissionId_key" ON "CandidateEvaluation"("submissionId");

-- CreateIndex
CREATE INDEX "CandidateEvaluation_passed_idx" ON "CandidateEvaluation"("passed");

-- AddForeignKey
ALTER TABLE "CandidateEvaluation" ADD CONSTRAINT "CandidateEvaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
