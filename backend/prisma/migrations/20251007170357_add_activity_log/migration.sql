-- DropForeignKey
ALTER TABLE "public"."PointsEvent" DROP CONSTRAINT "PointsEvent_userId_fkey";

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "meetingId" TEXT,
    "offerId" TEXT,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "public"."ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "public"."ActivityLog"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "public"."ActivityLog"("userId");

-- AddForeignKey
ALTER TABLE "public"."PointsEvent" ADD CONSTRAINT "PointsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
