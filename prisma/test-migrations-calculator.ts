/**
 * Воспроизводимая проверка upgrade-безопасности миграций калькулятора:
 * `npm run test:migrations:calculator`.
 *
 * Сценарий:
 *  1. Создаёт одноразовую БД photo_print_migtest_<ts> на сервере из
 *     DATABASE_URL (сама база из DATABASE_URL никогда не трогается).
 *  2. Применяет migration chain ТОЛЬКО до hardening (init + pricing engine) —
 *     состояние «предыдущая схема».
 *  3. Наполняет её данными старого формата: живое (isActive=true) и
 *     выключенное определения, ACTIVE-прайс, CalculationSnapshot без
 *     appliedRules/engineVersion/priceListId.
 *  4. Применяет полную актуальную цепочку миграций.
 *  5. Проверяет: миграции не падают; snapshot сохранён и backfill'ен
 *     (priceListId по версии, engineVersion='engine/1-legacy'); живое
 *     определение стало ACTIVE (не «молча DRAFT»); Prisma-клиент текущей
 *     схемы успешно читает все таблицы.
 *  6. В finally удаляет одноразовую БД и временные файлы.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const PRE_HARDENING_MIGRATIONS = ['20260626111452_init', '20260719234857_add_calculator_pricing_engine'];

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
  console.log(`✓ ${message}`);
}

function deploy(databaseUrl: string, schemaPath: string): void {
  execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
    cwd: path.join(__dirname, '..'),
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('test:migrations:calculator запрещён при NODE_ENV=production');
  }
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL не задан');

  const dbName = `photo_print_migtest_${Date.now()}`;
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${dbName}`;
  const testUrl = parsed.toString();

  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  let tmpDir: string | null = null;
  let client: PrismaClient | null = null;

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`Одноразовая БД создана: ${dbName}`);

    // Шаг 2: временный prisma-каталог только с миграциями до hardening.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migtest-'));
    const tmpMigrations = path.join(tmpDir, 'migrations');
    fs.mkdirSync(tmpMigrations);
    for (const name of PRE_HARDENING_MIGRATIONS) {
      const src = path.join(__dirname, 'migrations', name);
      fs.mkdirSync(path.join(tmpMigrations, name));
      fs.copyFileSync(path.join(src, 'migration.sql'), path.join(tmpMigrations, name, 'migration.sql'));
    }
    const tmpSchema = path.join(tmpDir, 'schema.prisma');
    fs.copyFileSync(path.join(__dirname, 'schema.prisma'), tmpSchema);
    deploy(testUrl, tmpSchema);
    console.log('Применена предыдущая схема (до hardening)');

    // Шаг 3: legacy-данные старого формата (raw SQL — старой схемы у клиента нет).
    client = new PrismaClient({ datasources: { db: { url: testUrl } } });
    await client.$executeRawUnsafe(`
      INSERT INTO "calculator_definitions"
        ("id", "code", "title", "version", "isActive", "urlOrder", "minQty", "maxQty", "qtyStep", "defaultQty", "updatedAt")
      VALUES
        ('def-live', 'legacy-cards', 'Живое определение', 1, true, ARRAY['qty'], 50, 10000, 50, 100, now()),
        ('def-off', 'legacy-off', 'Выключенное определение', 1, false, ARRAY['qty'], 1, 100, 1, 1, now());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "price_lists" ("id", "definitionId", "version", "status", "updatedAt")
      VALUES ('pl-legacy-1', 'def-live', 1, 'ACTIVE', now()),
             ('pl-legacy-2', 'def-live', 2, 'DRAFT', now());
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "price_rules" ("id", "priceListId", "kind", "qtyFrom", "amountMinor")
      VALUES ('pr-legacy', 'pl-legacy-1', 'BASE_TIER', 50, 1000);
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "calculation_snapshots"
        ("id", "definitionId", "definitionVersion", "priceListVersion", "serviceSlug", "parameters",
         "totalMinor", "unitMinor", "vatMinor", "workingDays")
      VALUES ('snap-legacy', 'def-live', 1, 1, 'vizitki', '{"qty": 100}', 100000, 1000, 20000, 2);
    `);
    await client.$disconnect();
    client = null;
    console.log('Вставлены данные старого формата (2 определения, 2 прайса, 1 snapshot)');

    // Шаг 4: полный актуальный migration chain.
    deploy(testUrl, path.join(__dirname, 'schema.prisma'));
    console.log('Полная цепочка миграций применена без ошибок');

    // Шаг 5: проверки.
    client = new PrismaClient({ datasources: { db: { url: testUrl } } });

    const snapshots = await client.$queryRawUnsafe<
      { id: string; priceListId: string; engineVersion: string; appliedRules: unknown; upsells: unknown }[]
    >(`SELECT "id", "priceListId", "engineVersion", "appliedRules", "upsells" FROM "calculation_snapshots"`);
    assert(snapshots.length === 1, 'snapshot не потерян');
    assert(snapshots[0].priceListId === 'pl-legacy-1', 'snapshot.priceListId backfill по (definitionId, priceListVersion)');
    assert(snapshots[0].engineVersion === 'engine/1-legacy', 'snapshot.engineVersion помечен как legacy');
    assert(JSON.stringify(snapshots[0].appliedRules) === '[]', 'snapshot.appliedRules backfill пустым списком');
    assert(JSON.stringify(snapshots[0].upsells) === '[]', 'snapshot.upsells backfill пустым списком');

    const defs = await client.$queryRawUnsafe<{ id: string; status: string }[]>(
      `SELECT "id", "status"::text AS status FROM "calculator_definitions" ORDER BY "id"`,
    );
    assert(defs.find((d) => d.id === 'def-live')?.status === 'ACTIVE', 'живое определение осталось ACTIVE, а не молча DRAFT');
    assert(defs.find((d) => d.id === 'def-off')?.status === 'DRAFT', 'выключенное определение стало редактируемым DRAFT');

    const lists = await client.$queryRawUnsafe<{ id: string; status: string }[]>(
      `SELECT "id", "status"::text AS status FROM "price_lists" ORDER BY "id"`,
    );
    assert(lists.find((l) => l.id === 'pl-legacy-1')?.status === 'ACTIVE', 'ACTIVE-прайс сохранил статус');
    assert(lists.find((l) => l.id === 'pl-legacy-2')?.status === 'DRAFT', 'DRAFT-прайс сохранил статус');

    // «Приложение запускается»: Prisma-клиент актуальной схемы читает таблицы.
    const viaClient = await client.calculationSnapshot.findMany({ include: { priceList: true, definition: true } });
    assert(viaClient.length === 1 && viaClient[0].priceList.id === 'pl-legacy-1', 'Prisma-клиент читает мигрированные данные со связями');
    await client.calculatorDefinition.findMany({ include: { parameters: true, priceLists: true } });
    console.log('\nUpgrade-сценарий пройден полностью.');
  } finally {
    if (client) await client.$disconnect().catch(() => undefined);
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      console.log(`Одноразовая БД удалена: ${dbName}`);
    } finally {
      await admin.$disconnect().catch(() => undefined);
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
