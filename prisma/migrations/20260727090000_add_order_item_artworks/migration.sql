-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('UPLOADED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "order_item_artworks" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ArtworkStatus" NOT NULL DEFAULT 'UPLOADED',
    "customerComment" TEXT,
    "reviewComment" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_status_history" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "fromStatus" "ArtworkStatus",
    "toStatus" "ArtworkStatus" NOT NULL,
    "changedByUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_item_artworks_orderItemId_status_idx" ON "order_item_artworks"("orderItemId", "status");

-- CreateIndex
CREATE INDEX "order_item_artworks_status_idx" ON "order_item_artworks"("status");

-- CreateIndex
CREATE INDEX "order_item_artworks_fileId_idx" ON "order_item_artworks"("fileId");

-- CreateIndex
CREATE INDEX "order_item_artworks_createdAt_idx" ON "order_item_artworks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_artworks_orderItemId_version_key" ON "order_item_artworks"("orderItemId", "version");

-- CreateIndex
CREATE INDEX "artwork_status_history_artworkId_createdAt_idx" ON "artwork_status_history"("artworkId", "createdAt");

-- AddForeignKey
ALTER TABLE "order_item_artworks" ADD CONSTRAINT "order_item_artworks_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_artworks" ADD CONSTRAINT "order_item_artworks_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "uploaded_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_artworks" ADD CONSTRAINT "order_item_artworks_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_status_history" ADD CONSTRAINT "artwork_status_history_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "order_item_artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_status_history" ADD CONSTRAINT "artwork_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
