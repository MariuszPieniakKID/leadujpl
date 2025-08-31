-- DropForeignKey
ALTER TABLE "public"."Meeting" DROP CONSTRAINT "Meeting_leadId_fkey";

-- AlterTable
ALTER TABLE "public"."Meeting" ALTER COLUMN "leadId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Meeting" ADD CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
