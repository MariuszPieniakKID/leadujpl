-- Add optional pvPower (kW) to Client
ALTER TABLE "public"."Client" ADD COLUMN IF NOT EXISTS "pvPower" DOUBLE PRECISION;


