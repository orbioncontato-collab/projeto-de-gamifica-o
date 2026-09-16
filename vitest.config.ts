import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/hooks.ts', 'src/features/wheel/spin-engine.ts'],
      exclude: ['src/lib/database.types.ts', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80 },
    },
  },
})
