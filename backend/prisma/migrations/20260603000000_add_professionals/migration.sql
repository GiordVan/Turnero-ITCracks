-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Turn" ADD COLUMN     "professionalId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Turn_professionalId_idx" ON "Turn"("professionalId");

-- CreateIndex
CREATE INDEX "Turn_scheduledDate_professionalId_idx" ON "Turn"("scheduledDate", "professionalId");

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
