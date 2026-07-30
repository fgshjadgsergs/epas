import { ReactNode, Suspense } from "react";
import { RequestModal } from "@/components/layout/request-modal";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileActionBar } from "@/components/public/mobile-action-bar";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
      <RequestModal />

      {/* Нижняя панель приложения (мобильные). Suspense — из-за
          useSearchParams внутри шторок поиска и фильтров. */}
      <Suspense fallback={null}>
        <MobileActionBar />
      </Suspense>
    </div>
  );
}
