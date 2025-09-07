-- CreateTable Offer
CREATE TABLE "public"."Offer" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "pdf" BYTEA NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Offer_clientId_idx" ON "public"."Offer"("clientId");
CREATE INDEX "Offer_ownerId_idx" ON "public"."Offer"("ownerId");

-- FKs
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


