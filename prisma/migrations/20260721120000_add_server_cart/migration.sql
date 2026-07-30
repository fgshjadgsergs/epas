-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'MERGED', 'ORDERED');

-- CreateEnum
CREATE TYPE "CartItemStatus" AS ENUM ('VALID', 'STALE', 'UNAVAILABLE', 'REQUIRES_RECALCULATION');

-- AlterTable
ALTER TABLE "calculation_snapshots" ADD COLUMN     "anonymousSessionId" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "calculationSnapshotId" TEXT NOT NULL,
    "serviceSlug" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "configurationSnapshot" JSONB NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_userId_idx" ON "carts"("userId");

-- CreateIndex
CREATE INDEX "carts_anonymousSessionId_idx" ON "carts"("anonymousSessionId");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_calculationSnapshotId_key" ON "cart_items"("cartId", "calculationSnapshotId");

-- CreateIndex
CREATE INDEX "calculation_snapshots_userId_idx" ON "calculation_snapshots"("userId");

-- CreateIndex
CREATE INDEX "calculation_snapshots_anonymousSessionId_idx" ON "calculation_snapshots"("anonymousSessionId");

-- AddForeignKey
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_calculationSnapshotId_fkey" FOREIGN KEY ("calculationSnapshotId") REFERENCES "calculation_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Один ACTIVE-cart на пользователя и на анонимную сессию (partial unique):
-- защита от гонки «два одновременных create cart» на уровне БД.
CREATE UNIQUE INDEX "carts_active_user_key" ON "carts"("userId")
  WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;
CREATE UNIQUE INDEX "carts_active_anon_key" ON "carts"("anonymousSessionId")
  WHERE "status" = 'ACTIVE' AND "anonymousSessionId" IS NOT NULL;

-- Количество копий позиции строго положительное.
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" >= 1);
