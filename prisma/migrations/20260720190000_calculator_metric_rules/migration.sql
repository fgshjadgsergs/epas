-- Метрические правила цены (баннеры и любые услуги с формульными надбавками):
-- надбавка за длину производной метрики и за количество интервалов.
-- Expand-only: новые enum-значения + nullable-колонка config, существующие
-- данные не затрагиваются.

-- AlterEnum
ALTER TYPE "PriceRuleKind" ADD VALUE 'SURCHARGE_PER_LENGTH';
ALTER TYPE "PriceRuleKind" ADD VALUE 'SURCHARGE_PER_INTERVAL_COUNT';

-- AlterTable
ALTER TABLE "price_rules" ADD COLUMN "config" JSONB;
