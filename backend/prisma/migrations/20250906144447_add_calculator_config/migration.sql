-- CreateTable
CREATE TABLE "public"."CalculatorConfig" (
    "id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalculatorConfig_pkey" PRIMARY KEY ("id")
);
