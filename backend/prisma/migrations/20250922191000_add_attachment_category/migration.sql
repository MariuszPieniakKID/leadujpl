-- Add optional category column to Attachment
ALTER TABLE "public"."Attachment" ADD COLUMN IF NOT EXISTS "category" TEXT;


