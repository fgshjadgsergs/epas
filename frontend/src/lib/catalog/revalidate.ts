/**
 * Точечно обновляет публичные страницы каталога после успешной admin-мутации.
 * Best-effort: вызывается ПОСЛЕ ответа backend, ошибку не роняем в UI — на сайте
 * просто дольше поживёт старое значение (до истечения обычного ISR).
 */
export async function revalidateCatalog(token: string): Promise<void> {
  try {
    await fetch('/api/catalog/revalidate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Инвалидация — не критичный путь: молча игнорируем сетевые сбои.
  }
}
