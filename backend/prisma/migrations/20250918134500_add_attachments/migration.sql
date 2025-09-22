CREATE TABLE "public"."Attachment" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "meetingId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Attachment_meetingId_idx" ON "public"."Attachment"("meetingId");
CREATE INDEX "Attachment_clientId_idx" ON "public"."Attachment"("clientId");
CREATE INDEX "Attachment_ownerId_idx" ON "public"."Attachment"("ownerId");

ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


