-- AlterEnum
ALTER TYPE "JobSourceProvider" ADD VALUE 'COMPANY';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "techTestId" TEXT,
ALTER COLUMN "applyUrl" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Job_companyId_isActive_idx" ON "Job"("companyId", "isActive");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
