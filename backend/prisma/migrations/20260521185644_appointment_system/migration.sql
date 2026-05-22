-- DropForeignKey
ALTER TABLE "Turn" DROP CONSTRAINT "Turn_serviceId_fkey";

-- DropIndex
DROP INDEX "Turn_createdAt_idx";

-- AlterTable
ALTER TABLE "Turn" ADD COLUMN     "email" TEXT,
ADD COLUMN     "scheduledDate" TEXT,
ADD COLUMN     "scheduledTime" TEXT,
ALTER COLUMN "serviceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Turn_scheduledDate_idx" ON "Turn"("scheduledDate");

-- CreateIndex
CREATE INDEX "Turn_email_idx" ON "Turn"("email");

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
