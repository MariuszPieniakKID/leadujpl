-- AlterTable
ALTER TABLE "public"."Meeting" ADD COLUMN     "salesLocationAddress" TEXT,
ADD COLUMN     "salesLocationCapturedAt" TIMESTAMP(3),
ADD COLUMN     "salesLocationCity" TEXT,
ADD COLUMN     "salesLocationHouseNumber" TEXT,
ADD COLUMN     "salesLocationPostalCode" TEXT,
ADD COLUMN     "salesLocationStreet" TEXT;
