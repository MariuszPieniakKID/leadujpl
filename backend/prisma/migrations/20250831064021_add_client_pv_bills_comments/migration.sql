-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "billRange" TEXT,
ADD COLUMN     "extraComments" TEXT,
ADD COLUMN     "pvInstalled" BOOLEAN;
