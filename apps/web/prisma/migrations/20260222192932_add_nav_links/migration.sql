-- CreateTable
CREATE TABLE "nav_links" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 50,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nav_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nav_links_isVisible_sortOrder_idx" ON "nav_links"("isVisible", "sortOrder");
