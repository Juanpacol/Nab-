-- AlterTable
ALTER TABLE "CandidateEvaluation" ADD COLUMN     "aiHighlights" JSONB,
ADD COLUMN     "aiStrengths" JSONB,
ADD COLUMN     "aiWeaknesses" JSONB;
