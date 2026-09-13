/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/basketball-turnier-manager/' : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', './e2e/**', '**/.worktrees/**'],
    // In CI, additionally emit a JUnit XML report (test-results/junit.xml) so the CI workflow
    // can upload it as an artifact -- the default 'basic' reporter alone only prints to the
    // console, which CI logs often truncate on a large run. Kept off locally so `npm test`
    // stays fast/quiet during normal development.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI ? { junit: './test-results/junit.xml' } : undefined,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/lib/export/**'],
      // 'text' keeps the existing console summary; 'html' produces a browsable report
      // (coverage/index.html) that CI uploads as an artifact so it can be inspected after
      // the run, not just read off the (often truncated) CI log.
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80,
        perFile: true,
      },
    },
  },
})
