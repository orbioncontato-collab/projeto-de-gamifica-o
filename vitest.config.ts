import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Telas com React Query + router demoram sob paralelismo (52 jsdom em máquinas modestas);
    // os limites padrão (5 s / 1 s do testing-library) geravam falhas intermitentes sem bug real.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/hooks.ts', 'src/features/wheel/spin-engine.ts'],
      exclude: ['src/lib/database.types.ts', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80 },
    },
  },
})
