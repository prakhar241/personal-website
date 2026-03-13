-- CreateEnum
CREATE TYPE "NotifyMode" AS ENUM ('INSTANT', 'DIGEST', 'BOTH');

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notifyMode" "NotifyMode" NOT NULL DEFAULT 'INSTANT',
    "subscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_verifyToken_key" ON "subscribers"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_unsubscribeToken_key" ON "subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "subscribers_verified_idx" ON "subscribers"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_templateKey_key" ON "email_templates"("templateKey");
