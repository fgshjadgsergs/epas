import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/catalog/remote';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Точечная инвалидация ISR-кэша каталога после admin-мутации. Ревалидация сама
 * по себе безопасна (лишь обновляет кэш), но чтобы не давать анонимам сбрасывать
 * кэш, требуем валидный catalog.manage: пробрасываем JWT вызывающего в backend
 * (GET /admin/categories) и продолжаем только при 200. Секрет не храним.
 */
export async function POST(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ revalidated: false, reason: 'unauthorized' }, { status: 401 });
  }

  let check: Response;
  try {
    check = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/admin/categories`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ revalidated: false, reason: 'backend-unreachable' }, { status: 502 });
  }
  if (!check.ok) {
    return NextResponse.json({ revalidated: false, reason: 'forbidden' }, { status: check.status });
  }

  revalidateTag(CATALOG_TAG);
  return NextResponse.json({ revalidated: true });
}
