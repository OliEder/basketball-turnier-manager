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
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/lib/export/**'],
      thresholds: {
        branches: 80,
        perFile: true,
      },
    },
  },
})
