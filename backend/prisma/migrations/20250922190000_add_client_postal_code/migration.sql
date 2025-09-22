-- AlterTable: add postalCode to Client
ALTER TABLE "public"."Client" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;


