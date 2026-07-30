import Link from 'next/link';
import { MessageCircle, Phone, Send, Star } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Logo } from './logo';
import { footerColumns, paymentMethods, deliveryMethods, legalLinks } from '@/data/footer';
import { site } from '@/lib/site';

/** Футер сайта (ТЗ навигации, п.4). role=contentinfo. */
export function Footer() {
  return (
    <footer role="contentinfo" className="mt-20 border-t border-border bg-bg-2">
      {/* Pre-footer CTA. */}
      <div className="border-b border-border">
        <Container className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <p className="text-lg font-semibold">Нужна помощь? Менеджеры отвечают за 5 минут.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={site.phone.href}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold hover:bg-surface-2"
            >
              <Phone size={16} aria-hidden /> Перезвоните мне
            </a>
            <a
              href={site.socials.telegram}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              <Send size={16} aria-hidden /> Написать в Telegram
            </a>
          </div>
        </Container>
      </div>

      {/* Основное тело — 5 колонок. */}
      <Container className="grid grid-cols-2 gap-8 py-12 md:grid-cols-3 lg:grid-cols-5">
        {/* Колонка 1 — о компании. */}
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Онлайн-типография. Печать с доставкой по всей России.
          </p>
          <nav aria-label="Социальные сети" className="mt-4 flex gap-2">
            <SocialLink href={site.socials.vk} label="ВКонтакте">
              <span className="text-xs font-bold">VK</span>
            </SocialLink>
            <SocialLink href={site.socials.telegram} label="Telegram">
              <Send size={16} aria-hidden />
            </SocialLink>
            <SocialLink href={site.socials.whatsapp} label="WhatsApp">
              <MessageCircle size={16} aria-hidden />
            </SocialLink>
          </nav>
          <p className="mt-4 flex items-center gap-1 text-sm text-muted">
            <Star size={15} className="fill-warning text-warning" aria-hidden />
            <span className="font-semibold text-fg">{site.rating.value}</span> — {site.rating.source}
          </p>
        </div>

        {/* Колонки 2–4 — ссылки. */}
        {footerColumns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-3 text-sm font-semibold text-fg">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Колонка 5 — контакты. */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Контакты</h3>
          <a href={site.phone.href} className="text-lg font-bold hover:text-primary">
            {site.phone.display}
          </a>
          <p className="mt-1 text-sm text-muted">{site.workHours}</p>
          <a href={`mailto:${site.email}`} className="mt-2 block text-sm text-muted hover:text-primary">
            {site.email}
          </a>
          <div className="mt-4 space-y-2 text-xs text-subtle">
            <p>Оплата: {paymentMethods.join(' · ')}</p>
            <p>Доставка: {deliveryMethods.join(' · ')}</p>
          </div>
        </div>
      </Container>

      {/* Нижняя строка. */}
      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-xs text-subtle sm:flex-row">
          <p>© 2026 {site.name}. Все права защищены.</p>
          <nav aria-label="Юридическая информация" className="flex flex-wrap gap-4">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
            <Link href="/karta-sayta-html/" className="hover:text-fg">
              Карта сайта
            </Link>
          </nav>
          <p>
            ИНН: {site.legal.inn} | ОГРН: {site.legal.ogrn}
          </p>
        </Container>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:border-primary hover:text-primary"
    >
      {children}
    </a>
  );
}
