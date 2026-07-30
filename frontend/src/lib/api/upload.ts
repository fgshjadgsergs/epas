import { ApiError } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Ответ POST /files/upload (safe DTO — без storageKey/bucket/ownerId). */
export interface UploadedFileResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: 'PRIVATE' | 'PUBLIC';
  status: 'PENDING' | 'READY' | 'DELETED';
  createdAt: string;
}

/**
 * Multipart-загрузка файла с РЕАЛЬНЫМ прогрессом.
 *
 * fetch не отдаёт upload progress, поэтому здесь XMLHttpRequest — единственная
 * точка, где upload делается не через apiFetch. Backend /files/upload остаётся
 * без изменений: файл валидируется по allowlist/сигнатуре и создаётся как
 * READY PRIVATE UploadedFile.
 */
export function uploadFileWithProgress(
  file: File,
  token: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedFileResponse> {
  return xhrUpload<UploadedFileResponse>('files/upload', file, token, { onProgress, signal });
}

/**
 * Загрузка ПУБЛИЧНОГО изображения услуги каталога с реальным прогрессом.
 * Отдельный business-контекст от artwork-файлов (PRIVATE): постит в admin
 * ServiceImage endpoint и возвращает safe DTO изображения (без storage-полей).
 */
export function uploadServiceImage(
  serviceId: string,
  file: File,
  token: string,
  opts: { alt?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<{ id: string; alt: string | null; sortOrder: number; isMain: boolean; url: string | null }> {
  const extra: Record<string, string> = {};
  if (opts.alt) extra.alt = opts.alt;
  return xhrUpload(`admin/services/${encodeURIComponent(serviceId)}/images`, file, token, {
    onProgress: opts.onProgress,
    signal: opts.signal,
    fields: extra,
  });
}

/** Общий XHR-загрузчик (единственная точка с реальным upload progress). */
function xhrUpload<T>(
  path: string,
  file: File,
  token: string,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal; fields?: Record<string, string> } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(opts.fields ?? {})) form.append(key, value);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL.replace(/\/$/, '')}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'text';

    if (xhr.upload && opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress!(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      const body = parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else {
        const err = (body ?? {}) as { message?: string; errors?: unknown };
        reject(new ApiError(xhr.status, err.message ?? `Ошибка загрузки (${xhr.status})`, err.errors as never));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Не удалось загрузить файл. Проверьте подключение.'));
    xhr.onabort = () => reject(new ApiError(0, 'Загрузка отменена.'));

    if (opts.signal) {
      if (opts.signal.aborted) return xhr.abort();
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}

function parse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}
