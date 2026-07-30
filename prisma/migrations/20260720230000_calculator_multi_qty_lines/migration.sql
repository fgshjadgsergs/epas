-- Построчная тарификация MULTI_QTY (фотопечать, будущие футболки):
-- базовая цена одной строки её собственным количеством.
-- Expand-only: только новое enum-значение.

-- AlterEnum
ALTER TYPE "PriceRuleKind" ADD VALUE 'BASE_PER_MULTI_QTY_LINE';
