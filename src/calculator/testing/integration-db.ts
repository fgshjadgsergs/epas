/**
 * Одноразовые PostgreSQL-базы для integration-тестов калькулятора.
 *
 * Каждый тест-набор создаёт СВОЮ базу `photo_print_it_*` на том же сервере,
 * что и DATABASE_URL (docker-compose postgres), применяет к ней реальную
 * migration chain и удаляет базу в afterAll. Dev-база `photo_print` никогда
 * не модифицируется — из её URL берутся только хост/порт/учётные данные.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export interface DisposableDb {
  url: string;
  name: string;
  drop(): Promise<void>;
}

function adminUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL не задан — integration-тестам нужен PostgreSQL из docker-compose');
  return baseUrl;
}

export async function createDisposableDb(prefix: string): Promise<DisposableDb> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Integration-тесты запрещены при NODE_ENV=production');
  }
  const base = adminUrl();
  const name = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new PrismaClient({ datasources: { db: { url: base } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
  const parsed = new URL(base);
  parsed.pathname = `/${name}`;
  return {
    url: parsed.toString(),
    name,
    async drop() {
      const admin2 = new PrismaClient({ datasources: { db: { url: base } } });
      try {
        // FORCE (PG13+): рвёт оставшиеся коннекты, чтобы drop не завис.
        await admin2.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await admin2.$disconnect();
      }
    },
  };
}

/** Применяет migration chain проекта к указанной базе (prisma migrate deploy). */
export function migrateDeploy(databaseUrl: string, schemaPath = 'prisma/schema.prisma'): void {
  execSync(`npx prisma migrate deploy --schema ${schemaPath}`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}
