-- Codex review v2: confirm parity + DB-enforced immutability + serialized publication.
--
-- Части:
--   1. Расширение схемы (expand-only, безопасно для существующих данных):
--      - calculator_upsells.visibleIf — доступность upsell по параметрам;
--      - calculation_snapshots.upsells / appliedUpsells — normalized input
--        и применённые upsells в снимке расчёта (DEFAULT '[]' для старых строк).
--   2. Exclusion constraint: два ACTIVE прайс-листа одного definition не могут
--      иметь пересекающиеся периоды действия — гарантия уровня БД против
--      race condition конкурентных публикаций (блок 6). Advisory lock в
--      PublishService сериализует публикации и даёт чистый 409; constraint —
--      жёсткая вторая линия.
--   3. Триггеры неизменяемости опубликованного aggregate (блок 5):
--      - DRAFT: редактировать/удалять можно;
--      - ACTIVE/ARCHIVED: UPDATE и DELETE запрещены; единственный допустимый
--        переход — ACTIVE → ARCHIVED, при котором меняется ТОЛЬКО status
--        (и updatedAt);
--      - дочерние записи (parameters/options/compat rules/upsells/production
--        rules → definition; price_rules → price list) нельзя вставлять,
--        менять и удалять, пока родитель не DRAFT;
--      - price_lists НЕ считаются «дочерними» у definition: у них собственный
--        жизненный цикл (новый DRAFT-прайс для ACTIVE definition — норма);
--      - service_calculators намеренно БЕЗ триггеров: это изменяемый указатель
--        «услуга → текущая версия определения» (иначе невозможно выкатить
--        новую версию), snapshot на него не ссылается;
--      - каскадное удаление DRAFT-родителя проходит: к моменту срабатывания
--        дочернего триггера родительская строка уже удалена (NOT FOUND → OK),
--        а удаление не-DRAFT родителя блокирует его собственный триггер ДО
--        каскада.

-- 1. Расширение схемы -------------------------------------------------------

ALTER TABLE "calculator_upsells" ADD COLUMN "visibleIf" JSONB;

ALTER TABLE "calculation_snapshots"
  ADD COLUMN "upsells" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "appliedUpsells" JSONB NOT NULL DEFAULT '[]';

-- 2. Exclusion constraint на периоды ACTIVE-прайсов -------------------------

-- btree_gist нужен для равенства definitionId внутри GiST-индекса.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Семантика периода: [validFrom, validTo) — validFrom включительно,
-- validTo исключительно; NULL = открытая граница (±infinity).
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_active_period_excl"
  EXCLUDE USING gist (
    "definitionId" WITH =,
    tsrange(
      COALESCE("validFrom", '-infinity'::timestamp),
      COALESCE("validTo", 'infinity'::timestamp),
      '[)'
    ) WITH &&
  )
  WHERE ("status" = 'ACTIVE');

-- 3. Триггеры неизменяемости ------------------------------------------------

-- Родители (calculator_definitions, price_lists): единая функция —
-- у обеих таблиц есть колонка status одного enum-типа.
CREATE OR REPLACE FUNCTION calc_guard_parent_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'published % (id=%, status=%) is immutable: DELETE forbidden',
        TG_TABLE_NAME, OLD."id", OLD."status";
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: черновик редактируется свободно (включая публикацию DRAFT→ACTIVE).
  IF OLD."status" = 'DRAFT' THEN
    RETURN NEW;
  END IF;
  -- Единственный допустимый переход опубликованной записи: ACTIVE → ARCHIVED,
  -- при котором не меняется ничего, кроме status и updatedAt.
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'ARCHIVED'
     AND (to_jsonb(OLD) - 'status' - 'updatedAt') = (to_jsonb(NEW) - 'status' - 'updatedAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'published % (id=%, status=%) is immutable: UPDATE forbidden (only ACTIVE -> ARCHIVED status change is allowed)',
    TG_TABLE_NAME, OLD."id", OLD."status";
END $$ LANGUAGE plpgsql;

-- Дети calculator_definitions (parameters / compatibility rules / upsells /
-- production rules): любые INSERT/UPDATE/DELETE только пока definition DRAFT.
CREATE OR REPLACE FUNCTION calc_guard_definition_child() RETURNS trigger AS $$
DECLARE
  parent_id TEXT;
  parent_status "PriceListStatus";
BEGIN
  -- При смене definitionId (перенос строки) проверяем И старого родителя.
  IF TG_OP = 'UPDATE' AND NEW."definitionId" IS DISTINCT FROM OLD."definitionId" THEN
    SELECT "status" INTO parent_status FROM "calculator_definitions" WHERE "id" = OLD."definitionId";
    IF FOUND AND parent_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'definition % is published (%): child rows of % are immutable',
        OLD."definitionId", parent_status, TG_TABLE_NAME;
    END IF;
  END IF;
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."definitionId" ELSE NEW."definitionId" END;
  SELECT "status" INTO parent_status FROM "calculator_definitions" WHERE "id" = parent_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD); -- каскад от удаления DRAFT-родителя
  END IF;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'definition % is published (%): child rows of % are immutable',
      parent_id, parent_status, TG_TABLE_NAME;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

-- Опции: родитель определяется через parameter → definition (два перехода).
CREATE OR REPLACE FUNCTION calc_guard_option_immutable() RETURNS trigger AS $$
DECLARE
  param_id TEXT;
  parent_status "PriceListStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."parameterId" IS DISTINCT FROM OLD."parameterId" THEN
    SELECT d."status" INTO parent_status
      FROM "calculator_parameters" p
      JOIN "calculator_definitions" d ON d."id" = p."definitionId"
      WHERE p."id" = OLD."parameterId";
    IF FOUND AND parent_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'definition of option % is published (%): immutable', OLD."id", parent_status;
    END IF;
  END IF;
  param_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."parameterId" ELSE NEW."parameterId" END;
  SELECT d."status" INTO parent_status
    FROM "calculator_parameters" p
    JOIN "calculator_definitions" d ON d."id" = p."definitionId"
    WHERE p."id" = param_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'definition of option is published (%): immutable', parent_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

-- Прайс-правила: родитель — price_lists.
CREATE OR REPLACE FUNCTION calc_guard_price_rule_immutable() RETURNS trigger AS $$
DECLARE
  parent_id TEXT;
  parent_status "PriceListStatus";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."priceListId" IS DISTINCT FROM OLD."priceListId" THEN
    SELECT "status" INTO parent_status FROM "price_lists" WHERE "id" = OLD."priceListId";
    IF FOUND AND parent_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'price list % is published (%): price rules are immutable', OLD."priceListId", parent_status;
    END IF;
  END IF;
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."priceListId" ELSE NEW."priceListId" END;
  SELECT "status" INTO parent_status FROM "price_lists" WHERE "id" = parent_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'price list % is published (%): price rules are immutable', parent_id, parent_status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_definition_immutable
  BEFORE UPDATE OR DELETE ON "calculator_definitions"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_parent_immutable();

CREATE TRIGGER trg_guard_price_list_immutable
  BEFORE UPDATE OR DELETE ON "price_lists"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_parent_immutable();

CREATE TRIGGER trg_guard_parameter_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "calculator_parameters"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_definition_child();

CREATE TRIGGER trg_guard_compat_rule_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "calculator_compatibility_rules"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_definition_child();

CREATE TRIGGER trg_guard_upsell_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "calculator_upsells"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_definition_child();

CREATE TRIGGER trg_guard_production_rule_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "production_time_rules"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_definition_child();

CREATE TRIGGER trg_guard_option_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "calculator_options"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_option_immutable();

CREATE TRIGGER trg_guard_price_rule_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "price_rules"
  FOR EACH ROW EXECUTE FUNCTION calc_guard_price_rule_immutable();
