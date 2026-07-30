'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FolderTree, Package } from 'lucide-react';
import { CategoriesPanel } from './categories-panel';
import { ServicesPanel } from './services-panel';

type Tab = 'categories' | 'services';

/** Рабочий раздел каталога: две вкладки (Категории / Услуги). Без dashboard-метрик. */
export function CatalogWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = params.get('tab') === 'services' ? 'services' : 'categories';

  const setTab = (next: Tab) => router.replace(`/admin/catalog/?tab=${next}`, { scroll: false });

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Каталог</h2>

      <div role="tablist" aria-label="Разделы каталога" className="mb-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={FolderTree}>Категории</TabButton>
        <TabButton active={tab === 'services'} onClick={() => setTab('services')} icon={Package}>Услуги</TabButton>
      </div>

      {tab === 'categories' ? <CategoriesPanel /> : <ServicesPanel />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof FolderTree; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:text-fg'}`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}
