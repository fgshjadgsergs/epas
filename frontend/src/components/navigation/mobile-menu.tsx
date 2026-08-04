'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as Accordion from '@radix-ui/react-accordion';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { mainNav, type NavItem } from '@/data/navigation';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Мобильное меню (ТЗ навигации, п.3.3, 4.2–4.3).
 * Radix Dialog обеспечивает focus-trap, aria-modal, блокировку скролла body,
 * закрытие по Escape / клику на оверлей и возврат фокуса на триггер.
 * Аккордеон — type=single: одновременно открыт только один пункт.
 */
export function MobileMenu({ nav = mainNav }: { nav?: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Открыть меню"
          className="grid h-11 w-11 place-items-center rounded-lg text-fg hover:bg-surface-2 lg:hidden"
        >
          <Menu aria-hidden size={22} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col bg-bg shadow-pop focus:outline-none data-[state=open]:animate-slide-down"
          aria-label="Мобильное меню"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-bold">
              {site.name.split('-')[0]}
              <span className="text-primary">-ПРИНТ</span>
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть меню"
                className="grid h-11 w-11 place-items-center rounded-lg text-fg hover:bg-surface-2"
              >
                <X aria-hidden size={22} />
              </button>
            </Dialog.Close>
          </div>

          <nav aria-label="Мобильная навигация" className="flex-1 overflow-y-auto px-2 py-2">
            <Accordion.Root type="single" collapsible className="space-y-0.5">
              {nav.map((item) => {
                if (!item.mega) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex min-h-[44px] items-center justify-between rounded-lg px-3 text-[15px] font-medium hover:bg-surface-2',
                        item.featured && 'text-accent',
                      )}
                    >
                      {item.label}
                      <span aria-hidden className="text-subtle">
                        ›
                      </span>
                    </Link>
                  );
                }
                return (
                  <Accordion.Item key={item.id} value={item.id} className="border-none">
                    <Accordion.Header>
                      <Accordion.Trigger
                        className={cn(
                          'group flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-[15px] font-medium hover:bg-surface-2',
                          item.featured && 'bg-accent/15 text-accent',
                        )}
                      >
                        {item.label}
                        <ChevronDown
                          aria-hidden
                          size={18}
                          className="text-subtle transition-transform group-data-[state=open]:rotate-180"
                        />
                      </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                      <ul className="space-y-0.5 py-1 pl-3">
                        {/* «→ Все …» — в конец плоского списка (ТЗ навигации, п.3.3);
                            дубли по href схлопываем, оставляя самую общую (последнюю). */}
                        {(() => {
                          const links = item.mega.groups.flatMap((g) => g.links);
                          const regular = links.filter((l) => !l.label.startsWith('→'));
                          const alls = [
                            ...new Map(
                              links.filter((l) => l.label.startsWith('→')).map((l) => [l.href, l]),
                            ).values(),
                          ];
                          return [...regular, ...alls];
                        })().map((link) => (
                            <li key={link.href + link.label}>
                              <Link
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                  'flex min-h-[44px] items-center rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg',
                                  link.label.startsWith('→') && 'font-medium text-primary',
                                  link.highlight && 'font-semibold text-accent',
                                )}
                              >
                                {link.label}
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </Accordion.Content>
                  </Accordion.Item>
                );
              })}
            </Accordion.Root>
          </nav>

          {/* Главный CTA — всегда виден внизу оверлея. */}
          <div className="border-t border-border p-4">
            <Link
              href="/oformlenie-zakaza/"
              onClick={() => setOpen(false)}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg"
            >
              Заказать сейчас
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
