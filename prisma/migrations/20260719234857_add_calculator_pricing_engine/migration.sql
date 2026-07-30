-- CreateEnum
CREATE TYPE "CalcParamType" AS ENUM ('SEGMENTED', 'SWATCH', 'SELECT', 'SEARCH_SELECT', 'DIMENSION', 'TOGGLE', 'MULTI_QTY');

-- CreateEnum
CREATE TYPE "CalcPricingMode" AS ENUM ('TIER', 'AREA');

-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceRuleKind" AS ENUM ('BASE_TIER', 'BASE_PER_SQM', 'MULTIPLIER', 'SURCHARGE_FLAT', 'SURCHARGE_PER_UNIT', 'QTY_DISCOUNT', 'MIN_TOTAL');

-- CreateEnum
CREATE TYPE "CompatRuleKind" AS ENUM ('DISABLE_OPTIONS', 'HIDE_PARAMS', 'MIN_QTY', 'MAX_QTY');

-- CreateEnum
CREATE TYPE "UpsellPricing" AS ENUM ('FLAT', 'PER_UNIT', 'MULTIPLIER');

-- CreateTable
CREATE TABLE "calculator_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pricingMode" "CalcPricingMode" NOT NULL DEFAULT 'TIER',
    "urlOrder" TEXT[],
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER NOT NULL DEFAULT 1000000,
    "qtyStep" INTEGER NOT NULL DEFAULT 1,
    "defaultQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calculator_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_calculators" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "preset" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_calculators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculator_parameters" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CalcParamType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "shareable" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT,
    "minValue" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "stepValue" DECIMAL(12,4),
    "defaultValue" TEXT,
    "visibleIf" JSONB,

    CONSTRAINT "calculator_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculator_options" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "calculator_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculator_compatibility_rules" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "kind" "CompatRuleKind" NOT NULL,
    "when" JSONB NOT NULL,
    "target" JSONB NOT NULL,
    "message" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calculator_compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculator_upsells" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pricing" "UpsellPricing" NOT NULL,
    "amountMinor" INTEGER,
    "multiplier" DECIMAL(8,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calculator_upsells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PriceListStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "kind" "PriceRuleKind" NOT NULL,
    "condition" JSONB,
    "qtyFrom" INTEGER,
    "amountMinor" INTEGER,
    "multiplier" DECIMAL(8,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_time_rules" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "condition" JSONB,
    "workingDays" INTEGER NOT NULL,
    "cutoff" TEXT NOT NULL DEFAULT '14:00',
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "production_time_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_snapshots" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "priceListVersion" INTEGER NOT NULL,
    "serviceSlug" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "unitMinor" INTEGER NOT NULL,
    "vatMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "workingDays" INTEGER NOT NULL,
    "b2b" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calculator_definitions_code_key" ON "calculator_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_calculators_serviceId_key" ON "service_calculators"("serviceId");

-- CreateIndex
CREATE INDEX "service_calculators_definitionId_idx" ON "service_calculators"("definitionId");

-- CreateIndex
CREATE INDEX "calculator_parameters_definitionId_idx" ON "calculator_parameters"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "calculator_parameters_definitionId_urlKey_key" ON "calculator_parameters"("definitionId", "urlKey");

-- CreateIndex
CREATE INDEX "calculator_options_parameterId_idx" ON "calculator_options"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "calculator_options_parameterId_value_key" ON "calculator_options"("parameterId", "value");

-- CreateIndex
CREATE INDEX "calculator_compatibility_rules_definitionId_idx" ON "calculator_compatibility_rules"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "calculator_upsells_definitionId_code_key" ON "calculator_upsells"("definitionId", "code");

-- CreateIndex
CREATE INDEX "price_lists_definitionId_status_idx" ON "price_lists"("definitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_definitionId_version_key" ON "price_lists"("definitionId", "version");

-- CreateIndex
CREATE INDEX "price_rules_priceListId_kind_idx" ON "price_rules"("priceListId", "kind");

-- CreateIndex
CREATE INDEX "production_time_rules_definitionId_idx" ON "production_time_rules"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "calculation_snapshots_definitionId_createdAt_idx" ON "calculation_snapshots"("definitionId", "createdAt");

-- AddForeignKey
ALTER TABLE "service_calculators" ADD CONSTRAINT "service_calculators_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_calculators" ADD CONSTRAINT "service_calculators_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculator_parameters" ADD CONSTRAINT "calculator_parameters_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculator_options" ADD CONSTRAINT "calculator_options_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "calculator_parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculator_compatibility_rules" ADD CONSTRAINT "calculator_compatibility_rules_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculator_upsells" ADD CONSTRAINT "calculator_upsells_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_time_rules" ADD CONSTRAINT "production_time_rules_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "calculator_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
