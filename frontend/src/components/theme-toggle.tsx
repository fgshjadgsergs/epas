'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Переключатель двух тем: «Чернила» (тёмная) ⇄ «Бумага» (светлая).
 * Иконка показывает, какая тема включится по клику. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Тема известна только на клиенте — избегаем рассинхрона при гидратации.
  useEffect(() => setMounted(true), []);

  const isLight = resolvedTheme === 'light';
  const next = isLight ? 'dark' : 'light';
  const Icon = isLight ? Moon : Sun;
  const label = isLight ? 'Включить тёмную тему «Чернила»' : 'Включить светлую тему «Бумага»';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={className}
      style={{
        display: 'inline-flex',
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {mounted && <Icon size={18} aria-hidden />}
    </button>
  );
}
