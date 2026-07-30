/**
 * F-2: ресурсоёмкие файловые endpoints имеют собственный лимит поверх
 * глобального catalog-friendly throttler (1200/мин). Проверяем применённые
 * @Throttle-лимиты структурно (metadata), чтобы регрессия не сняла защиту.
 */
import { FilesController } from './files.controller';
import { ArtworkController } from '../artworks/artwork.controller';
import { AdminArtworkController } from '../artworks/admin-artwork.controller';
import { ServiceImagesAdminController } from '../catalog/services/service-images.admin.controller';

const LIMIT_KEY = 'THROTTLER:LIMITdefault';
const TTL_KEY = 'THROTTLER:TTLdefault';

function methodLimit(ctor: object, method: string): { limit: unknown; ttl: unknown } {
  const handler = (ctor as { prototype: Record<string, unknown> }).prototype[method];
  return { limit: Reflect.getMetadata(LIMIT_KEY, handler as object), ttl: Reflect.getMetadata(TTL_KEY, handler as object) };
}
function classLimit(ctor: object): { limit: unknown; ttl: unknown } {
  return { limit: Reflect.getMetadata(LIMIT_KEY, ctor), ttl: Reflect.getMetadata(TTL_KEY, ctor) };
}

describe('F-2: throttling файловых endpoints', () => {
  it('files.upload — 20/мин (тяжёлая загрузка)', () => {
    expect(methodLimit(FilesController, 'upload')).toEqual({ limit: 20, ttl: 60_000 });
  });

  it('files.presigned-url — 60/мин', () => {
    expect(methodLimit(FilesController, 'getPresignedUrl')).toEqual({ limit: 60, ttl: 60_000 });
  });

  it('artwork controller — presign-операции 60/мин (класс), привязка 30/мин', () => {
    expect(classLimit(ArtworkController)).toEqual({ limit: 60, ttl: 60_000 });
    expect(methodLimit(ArtworkController, 'attach')).toEqual({ limit: 30, ttl: 60_000 });
  });

  it('admin artwork — download/preview 60/мин', () => {
    expect(methodLimit(AdminArtworkController, 'download')).toEqual({ limit: 60, ttl: 60_000 });
    expect(methodLimit(AdminArtworkController, 'preview')).toEqual({ limit: 60, ttl: 60_000 });
  });

  it('catalog service image upload — 20/мин', () => {
    expect(methodLimit(ServiceImagesAdminController, 'upload')).toEqual({ limit: 20, ttl: 60_000 });
  });
});
