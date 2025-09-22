-- AlterTable
ALTER TABLE "public"."Offer" ADD COLUMN     "meetingId" TEXT;

-- CreateIndex
CREATE INDEX "Offer_meetingId_idx" ON "public"."Offer"("meetingId");

-- AddForeignKey
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
