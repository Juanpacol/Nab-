-- CreateEnum
CREATE TYPE "TechTestStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "CreditReason" ADD VALUE 'TEST_GENERATION';

-- CreateTable
CREATE TABLE "TechTest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleSpec" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "status" "TechTestStatus" NOT NULL DEFAULT 'GENERATING',
    "questionsJson" JSONB,
    "rubricJson" JSONB,
    "model" TEXT,
    "generationError" TEXT,
    "timeLimitMinutes" INTEGER,
    "passScore" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechTest_companyId_status_idx" ON "TechTest"("companyId", "status");

-- AddForeignKey
ALTER TABLE "TechTest" ADD CONSTRAINT "TechTest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_techTestId_fkey" FOREIGN KEY ("techTestId") REFERENCES "TechTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
