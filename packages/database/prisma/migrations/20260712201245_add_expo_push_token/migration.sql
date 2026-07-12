-- DropIndex
DROP INDEX "Job_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expoPushToken" TEXT;
