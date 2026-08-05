import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/reveal';
import { AccountNav } from '@/components/account/account-nav';

export const metadata: Metadata = {
  title: 'Личный кабинет — ПРИНТЕРА',
  robots: { index: false, follow: true },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-8">
      <Reveal as="h1" className="mb-6 text-2xl font-bold sm:text-3xl">
        Личный кабинет
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* min-w-0: иначе nowrap-ссылки меню растягивают грид-колонку шире экрана на мобиле. */}
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <AccountNav />
        </aside>
        <Reveal delay={80} className="min-w-0">
          {children}
        </Reveal>
      </div>
    </Container>
  );
}
