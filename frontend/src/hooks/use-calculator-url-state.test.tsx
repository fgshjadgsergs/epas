// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalculatorUrlState } from './use-calculator-url-state';
import type { UrlStateSpec } from '@/lib/calculator/url-state';

const spec: UrlStateSpec = {
  order: ['format', 'paper', 'qty'],
  params: [
    { key: 'format', shareable: true, defaultValue: '90x50', allowedValues: ['90x50', '85x55'] },
    { key: 'paper', shareable: true, defaultValue: 'coated-350', allowedValues: ['coated-350', 'design'] },
    { key: 'qty', shareable: true, defaultValue: '100', numeric: { min: 50, max: 10000 } },
  ],
};

function setUrl(pathname: string, search = '') {
  window.history.replaceState(null, '', search ? `${pathname}?${search}` : pathname);
}

/** Снимает флаг инициализации хука — он выставляется в queueMicrotask, не в таймере. */
async function flushInit() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useCalculatorUrlState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setUrl('/vizitki/');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks(); // иначе vi.spyOn(window.history, 'pushState') копится между тестами
    vi.useRealTimers();
  });

  it('инициализация не делает pushState', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() =>
      useCalculatorUrlState({ spec, values: { format: '90x50', paper: 'coated-350', qty: 100 }, onRestore: vi.fn() }),
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('debounce 1000 мс: pushState происходит только после паузы', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    let values = { format: '90x50', paper: 'coated-350', qty: 100 };
    const { rerender } = renderHook((props) => useCalculatorUrlState(props), {
      initialProps: { spec, values, onRestore: vi.fn() },
    });
    await flushInit();

    values = { ...values, paper: 'design' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(500));
    expect(pushSpy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][2]).toContain('paper=design');
  });

  it('несколько быстрых изменений дают один pushState после паузы', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    let values = { format: '90x50', paper: 'coated-350', qty: 100 };
    const { rerender } = renderHook((props) => useCalculatorUrlState(props), {
      initialProps: { spec, values, onRestore: vi.fn() },
    });
    await flushInit();

    values = { ...values, format: '85x55' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(300));
    values = { ...values, paper: 'design' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(300));
    values = { ...values, qty: 500 };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(1000));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const url = pushSpy.mock.calls[0][2] as string;
    expect(url).toContain('format=85x55');
    expect(url).toContain('paper=design');
    expect(url).toContain('qty=500');
  });

  it('не делает duplicate push, если итоговый URL не изменился', async () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    let values = { format: '90x50', paper: 'coated-350', qty: 100 };
    const { rerender } = renderHook((props) => useCalculatorUrlState(props), {
      initialProps: { spec, values, onRestore: vi.fn() },
    });
    await flushInit();

    values = { ...values, paper: 'design' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(1000));
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Пользователь меняет и возвращает то же значение — итоговый URL не меняется.
    values = { ...values, paper: 'coated-350' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(500));
    values = { ...values, paper: 'design' };
    rerender({ spec, values, onRestore: vi.fn() });
    act(() => vi.advanceTimersByTime(1000));
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('popstate восстанавливает состояние и НЕ вызывает pushState', async () => {
    const onRestore = vi.fn();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() =>
      useCalculatorUrlState({ spec, values: { format: '90x50', paper: 'coated-350', qty: 100 }, onRestore }),
    );
    await flushInit();

    setUrl('/vizitki/', 'format=85x55');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ format: '85x55' }));
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('невалидное значение в URL при инициализации нормализуется через replaceState', () => {
    setUrl('/vizitki/', 'qty=abc&paper=unknown');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const onRestore = vi.fn();
    renderHook(() =>
      useCalculatorUrlState({ spec, values: { format: '90x50', paper: 'coated-350', qty: 100 }, onRestore }),
    );
    expect(replaceSpy).toHaveBeenCalled();
    const normalizedUrl = replaceSpy.mock.calls[0][2] as string;
    expect(normalizedUrl).not.toContain('qty=abc');
    expect(normalizedUrl).not.toContain('paper=unknown');
  });

  it('снимает timer и listener при unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount, rerender } = renderHook((props) => useCalculatorUrlState(props), {
      initialProps: { spec, values: { format: '90x50', paper: 'coated-350', qty: 100 }, onRestore: vi.fn() },
    });
    await flushInit();
    rerender({ spec, values: { format: '85x55', paper: 'coated-350', qty: 100 }, onRestore: vi.fn() });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    // Таймер отменяется при unmount — подтверждаем отсутствием ошибок
    // "setState after unmount" при последующем продвижении часов.
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });
});
