'use client';

import { useEffect } from 'react';
import { useEditor } from './store';
import { ParamsStep } from './params-step';
import { Editor } from './editor';
import { OrderStep } from './order-step';

export function ConstructorApp() {
  const step = useEditor((s) => s.step);
  const save = useEditor((s) => s.save);
  const spreads = useEditor((s) => s.spreads);
  const params = useEditor((s) => s.params);

  // Автосохранение с debounce (ТЗ п.4.7). Демо: структура в localStorage;
  // на проде — POST /api/v1/photobook/project/save (фото в S3).
  useEffect(() => {
    const t = setTimeout(() => save(), 2000);
    return () => clearTimeout(t);
  }, [spreads, params, save]);

  if (step === 'params') return <ParamsStep />;
  if (step === 'order') return <OrderStep />;
  return <Editor />;
}
