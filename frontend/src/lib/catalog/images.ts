import fs from 'node:fs';
import path from 'node:path';

/**
 * Фото услуги/подтипа для карточек каталога: public/img/catalog/<slug>.jpg
 * (например /vizitki/standartnye/ → public/img/catalog/vizitki/standartnye.jpg).
 * Пока файла нет — карточка показывает градиентную заглушку, поэтому фото
 * можно докладывать пакетами без правок кода. Только для серверных компонентов.
 */
export function catalogImage(slug: string): string | undefined {
  const rel = path.posix.join('img/catalog', slug.replace(/^\/|\/$/g, '') + '.jpg');
  try {
    return fs.existsSync(path.join(process.cwd(), 'public', rel)) ? `/${rel}` : undefined;
  } catch {
    return undefined;
  }
}
