-- AlterTable
ALTER TABLE "public"."Meeting" ADD COLUMN     "billRange" TEXT,
ADD COLUMN     "extraComments" TEXT,
ADD COLUMN     "pvInstalled" BOOLEAN;
