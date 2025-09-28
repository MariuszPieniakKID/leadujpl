-- CreateTable
CREATE TABLE "public"."PointsEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "clientId" TEXT,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "public"."PointsEvent"
  ADD CONSTRAINT "PointsEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PointsEvent_userId_idx" ON "public"."PointsEvent"("userId");
CREATE INDEX "PointsEvent_createdAt_idx" ON "public"."PointsEvent"("createdAt");


