/**
 * Template ремоунтится при каждой навигации (в отличие от layout) — за счёт этого
 * на каждой смене страницы проигрывается лёгкий вход .page-enter (opacity + сдвиг).
 * Без JS, чистый CSS; под prefers-reduced-motion — мгновенно.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
