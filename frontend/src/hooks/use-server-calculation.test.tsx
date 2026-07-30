// @vitest-environment jsdom
import { act, render, renderHook, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerCalculation } from './use-server-calculation';
import { ApiError } from '@/lib/api/client';
import type { CalculateRequestBody, CalculateResponseDto } from '@/lib/api/calculator';

const postCalculateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/calculator', () => ({ postCalculate: postCalculateMock }));

function makeResponse(amountMinor: number): CalculateResponseDto {
  return {
    serviceSlug: 'vizitki',
    normalizedParameters: {},
    quantity: 100,
    price: { amountMinor, currency: 'RUB' },
    unitPrice: { amountMinor: amountMinor / 100, currency: 'RUB' },
    priceWithVat: null,
    production: { workingDays: 2, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    warnings: [],
    calculationVersion: 'v1',
  };
}

describe('useServerCalculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    postCalculateMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('idle без body/enabled', () => {
    const { result } = renderHook(() => useServerCalculation('vizitki', null, true));
    expect(result.current.status).toBe('idle');
    expect(result.current.canAddToCart).toBe(false);
  });

  it('успешный расчёт делает canAddToCart=true и вызывает onSucceeded', async () => {
    postCalculateMock.mockResolvedValue(makeResponse(178200));
    const onSucceeded = vi.fn();
    const { result } = renderHook(() =>
      useServerCalculation('vizitki', { parameters: { qty: 100 } }, true, { onSucceeded }),
    );
    expect(result.current.status).toBe('pending');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.status).toBe('fresh');
    expect(result.current.canAddToCart).toBe(true);
    expect(onSucceeded).toHaveBeenCalledWith(expect.objectContaining({ price: { amountMinor: 178200, currency: 'RUB' } }));
  });

  it('изменение параметров делает предыдущий результат stale и блокирует add-to-cart', async () => {
    postCalculateMock.mockResolvedValue(makeResponse(178200));
    let body = { parameters: { qty: 100 } };
    const { result, rerender } = renderHook((b: typeof body) => useServerCalculation('vizitki', b, true), {
      initialProps: body,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.status).toBe('fresh');

    body = { parameters: { qty: 200 } };
    rerender(body);
    // Наблюдаемый контракт безопасности: как только параметры изменились,
    // предыдущая цена больше не годится для checkout — независимо от того,
    // окажется ли промежуточный статус 'stale' или сразу 'pending' (порядок
    // эффектов React может слить их в один коммит).
    expect(result.current.status).not.toBe('fresh');
    expect(result.current.canAddToCart).toBe(false);
  });

  it('422 переводит в error, canAddToCart=false, onFailed(validation)', async () => {
    postCalculateMock.mockRejectedValue(
      new ApiError(422, 'Неверные параметры', [{ param: 'qty', message: 'мин. 50' } as never]),
    );
    const onFailed = vi.fn();
    const { result } = renderHook(() =>
      useServerCalculation('vizitki', { parameters: { qty: 1 } }, true, { onFailed }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.canAddToCart).toBe(false);
    expect(result.current.fieldErrors[0]).toMatchObject({ param: 'qty' });
    expect(onFailed).toHaveBeenCalledWith('validation');
  });

  it('сетевая ошибка: error + onFailed(network), последняя цена остаётся видна как stale', async () => {
    postCalculateMock.mockRejectedValueOnce(new ApiError(0, 'Не удалось связаться с сервером'));
    const onFailed = vi.fn();
    const { result } = renderHook(() =>
      useServerCalculation('vizitki', { parameters: { qty: 100 } }, true, { onFailed }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.offline).toBe(true);
    expect(result.current.canAddToCart).toBe(false);
    expect(onFailed).toHaveBeenCalledWith('network');
  });

  it('exact bodyKey: canAddToCart=false уже в ПЕРВОМ render с новым body, до passive effects', async () => {
    postCalculateMock.mockResolvedValue(makeResponse(178200));
    // Пробный компонент пишет значения В МОМЕНТ render — эффекты (и смена
    // status на stale/pending) происходят только после коммита, поэтому
    // первая запись для нового body сделана строго до их выполнения.
    const renders: { status: string; canAddToCart: boolean }[] = [];
    function Probe({ body }: { body: CalculateRequestBody }) {
      const state = useServerCalculation('vizitki', body, true);
      renders.push({ status: state.status, canAddToCart: state.canAddToCart });
      return null;
    }

    const view = render(<Probe body={{ parameters: { qty: 100 } }} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(renders[renders.length - 1]).toMatchObject({ status: 'fresh', canAddToCart: true });

    const mark = renders.length;
    view.rerender(<Probe body={{ parameters: { qty: 200 } }} />);
    // Первый render с input B: status из state ещё может быть 'fresh', но
    // сверка exact bodyKey уже блокирует checkout.
    expect(renders.length).toBeGreaterThan(mark);
    for (const snapshotOfRender of renders.slice(mark)) {
      expect(snapshotOfRender.canAddToCart).toBe(false);
    }
  });

  it('поздний ответ конфигурации A не разблокирует add-to-cart для конфигурации B', async () => {
    let resolveA!: (v: CalculateResponseDto) => void;
    let resolveB!: (v: CalculateResponseDto) => void;
    postCalculateMock.mockImplementationOnce(() => new Promise<CalculateResponseDto>((r) => (resolveA = r)));
    postCalculateMock.mockImplementationOnce(() => new Promise<CalculateResponseDto>((r) => (resolveB = r)));

    let body = { parameters: { qty: 100 } };
    const { result, rerender } = renderHook((b: typeof body) => useServerCalculation('vizitki', b, true), {
      initialProps: body,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // запрос A в полёте
    });
    body = { parameters: { qty: 200 } };
    rerender(body);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // запрос B в полёте
    });

    // Поздний успех A: чужая конфигурация не должна открыть корзину для B.
    await act(async () => {
      resolveA(makeResponse(100000));
      await Promise.resolve();
    });
    expect(result.current.canAddToCart).toBe(false);
    expect(result.current.status).not.toBe('fresh');

    // Ответ именно для B — разблокирует.
    await act(async () => {
      resolveB(makeResponse(200000));
      await Promise.resolve();
    });
    expect(result.current.canAddToCart).toBe(true);
    expect(result.current.data?.price.amountMinor).toBe(200000);
  });

  it('поздний ответ устаревшего запроса не заменяет результат более нового', async () => {
    let resolveFirst!: (v: CalculateResponseDto) => void;
    postCalculateMock.mockImplementationOnce(
      () => new Promise<CalculateResponseDto>((res) => (resolveFirst = res)),
    );
    postCalculateMock.mockResolvedValueOnce(makeResponse(200000));

    let body = { parameters: { qty: 100 } };
    const { result, rerender } = renderHook((b: typeof body) => useServerCalculation('vizitki', b, true), {
      initialProps: body,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // первый запрос ушёл, ещё не resolved
    });

    body = { parameters: { qty: 200 } };
    rerender(body);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // второй запрос ушёл и УЖЕ resolved (200000)
    });
    expect(result.current.data?.price.amountMinor).toBe(200000);

    // Поздний ответ первого (устаревшего) запроса приходит ПОСЛЕ второго.
    await act(async () => {
      resolveFirst(makeResponse(100000));
      await Promise.resolve();
    });
    // Данные не должны откатиться к более старому ответу.
    expect(result.current.data?.price.amountMinor).toBe(200000);
  });
});
