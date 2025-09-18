-- Add new columns to Client: newRules (boolean), buildingType (text)
ALTER TABLE "public"."Client" ADD COLUMN IF NOT EXISTS "newRules" BOOLEAN;
ALTER TABLE "public"."Client" ADD COLUMN IF NOT EXISTS "buildingType" TEXT;


