'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '@/components/seo/json-ld';

/**
 * Блок FAQ — аккордеон, одновременно открыт один вопрос (ТЗ главной, блок 10).
 * Schema.org FAQPage добавляется отдельно через <FaqJsonLd> на странице.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {items.map((item, i) => (
        <Accordion.Item key={i} value={`q-${i}`}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium hover:bg-surface-2">
              {item.question}
              <ChevronDown
                aria-hidden
                size={18}
                className="shrink-0 text-subtle transition-transform group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
