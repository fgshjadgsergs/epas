'use client';

import { useTheme } from 'next-themes';
import { Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Переключатель тем по циклу: тёмная → светлая → золотая тёмная → золотая
 * светлая → тёмная. Иконка показывает, какая тема включится по клику. */
const CYCLE = ['dark', 'light', 'gold', 'gold-light'] as const;

const NEXT_META: Record<string, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Включить светлую тему' },
  gold: { icon: Sparkles, label: 'Включить золотую тёмную тему' },
  'gold-light': { icon: Palette, label: 'Включить золотую светлую тему' },
  dark: { icon: Moon, label: 'Включить тёмную тему' },
};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Тема известна только на клиенте — избегаем рассинхрона при гидратации.
  useEffect(() => setMounted(true), []);

  const current = CYCLE.includes(resolvedTheme as (typeof CYCLE)[number])
    ? (resolvedTheme as (typeof CYCLE)[number])
    : 'dark';
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
  const meta = NEXT_META[next];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={meta.label}
      title={meta.label}
      className={className}
      style={{
        display: 'inline-flex',
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {mounted && <meta.icon size={18} aria-hidden />}
    </button>
  );
}
