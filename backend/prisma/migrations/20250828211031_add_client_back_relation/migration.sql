-- AlterTable
ALTER TABLE "public"."Meeting" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_clientId_idx" ON "public"."Meeting"("clientId");

-- AddForeignKey
ALTER TABLE "public"."Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
