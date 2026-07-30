-- Codex hardening (переписана в upgrade-safe вид ДО какого-либо развёртывания
-- на production/shared: единственная БД, где успела примениться исходная
-- версия, — локальная dev `photo_print`, схема которой идентична результату
-- этой версии; `prisma migrate deploy` сопоставляет миграции по имени и
-- повторно её не выполняет).
--
-- Исходная версия падала на непустых таблицах: ADD COLUMN ... NOT NULL без
-- DEFAULT/backfill для calculation_snapshots и молча превращала «живые»
-- (isActive=true) определения в DRAFT. Теперь — expand → backfill → contract:
--   expand:   новые колонки добавляются NULLABLE/с DEFAULT;
--   backfill: legacy-строки получают значения (snapshot.priceListId — по
--             точному соответствию definitionId+priceListVersion, затем по
--             максимальной версии; engineVersion='engine/1-legacy';
--             status определений: isActive=true → ACTIVE, иначе DRAFT);
--   contract: NOT NULL включается только после backfill.
-- Если у legacy-snapshot вообще нет прайс-листа его определения (в старом
-- коде невозможно — расчёт требовал активный прайс), SET NOT NULL упадёт
-- громко — это осознанный fail-closed вместо тихой порчи данных.
-- Воспроизводимая проверка апгрейда со старой схемы с данными:
-- `npm run test:migrations:calculator`.

-- AlterEnum
ALTER TYPE "CompatRuleKind" ADD VALUE 'SET_BOUNDS';

-- DropIndex
DROP INDEX "calculator_definitions_code_key";

-- Expand: все новые колонки nullable либо с DEFAULT ------------------------

ALTER TABLE "calculation_snapshots"
  ADD COLUMN "appliedRules" JSONB,
  ADD COLUMN "customerContext" JSONB,
  ADD COLUMN "engineVersion" TEXT,
  ADD COLUMN "priceListId" TEXT;

ALTER TABLE "calculator_definitions"
  ADD COLUMN "config" JSONB,
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "status" "PriceListStatus";

ALTER TABLE "calculator_parameters" ADD COLUMN "config" JSONB;

ALTER TABLE "price_lists"
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

ALTER TABLE "price_rules" ADD COLUMN "qtyTo" INTEGER;

-- Backfill: legacy-данные получают корректные значения ----------------------

-- Снимки старого формата: пустой applied-trace, маркер legacy-движка и связь
-- с прайс-листом по точной версии (snapshot всегда хранил priceListVersion),
-- с фолбэком на максимальную версию определения.
UPDATE "calculation_snapshots" s SET
  "appliedRules" = COALESCE(s."appliedRules", '[]'::jsonb),
  "engineVersion" = COALESCE(s."engineVersion", 'engine/1-legacy'),
  "priceListId" = COALESCE(
    s."priceListId",
    (SELECT pl."id" FROM "price_lists" pl
       WHERE pl."definitionId" = s."definitionId" AND pl."version" = s."priceListVersion"
       LIMIT 1),
    (SELECT pl."id" FROM "price_lists" pl
       WHERE pl."definitionId" = s."definitionId"
       ORDER BY pl."version" DESC
       LIMIT 1)
  );

-- «Живые» определения (isActive=true) продолжают обслуживаться: ACTIVE.
-- Выключенные — DRAFT (редактируемы), НЕ ARCHIVED (архив неизменяем навсегда).
UPDATE "calculator_definitions"
  SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"PriceListStatus" ELSE 'DRAFT'::"PriceListStatus" END
  WHERE "status" IS NULL;

-- Contract: обязательность и значения по умолчанию --------------------------

ALTER TABLE "calculation_snapshots"
  ALTER COLUMN "appliedRules" SET NOT NULL,
  ALTER COLUMN "engineVersion" SET NOT NULL,
  ALTER COLUMN "priceListId" SET NOT NULL;

ALTER TABLE "calculator_definitions"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "calculator_definitions_code_status_idx" ON "calculator_definitions"("code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calculator_definitions_code_version_key" ON "calculator_definitions"("code", "version");

-- AddForeignKey
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
