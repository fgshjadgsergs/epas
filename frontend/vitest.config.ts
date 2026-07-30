import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX-трансформ нужен только .test.tsx (hook/component-тесты на
  // @testing-library/react); чистые .test.ts модули не задействуют плагин.
  plugins: [react()],
  resolve: {
    alias: {
      // Тот же алиас, что в tsconfig ("@/*" → "./src/*") — иначе тесты
      // не могут импортировать модули, которые сами используют "@/".
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // .test.tsx — hook-тесты на @testing-library/react (jsdom per-file через
    // "// @vitest-environment jsdom"); остальные тесты — чистые функции, node.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
