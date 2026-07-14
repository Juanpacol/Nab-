-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "autoApplied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoApplyMaxPerDay" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "autoApplyMinScore" INTEGER NOT NULL DEFAULT 85;

-- CreateIndex
CREATE INDEX "Application_userId_autoApplied_submittedAt_idx" ON "Application"("userId", "autoApplied", "submittedAt");
