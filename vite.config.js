import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The kiosk talks to the LensBridge backend. In dev we proxy /api to the
// local Spring app so the browser stays same-origin (no CORS). In prod the
// backend origin is injected via VITE_API_BASE_URL at build time; when unset
// the app falls back to same-origin /api (reverse-proxied in deployment).
const BACKEND = process.env.VITE_DEV_BACKEND || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      // ws: the refresh channel upgrades under /api too, and without this the
      // upgrade isn't forwarded — the socket reconnect-loops silently in dev
      // while every HTTP call works fine.
      '/api': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  // Vitest reads this config, so the React plugin and the aliases above apply
  // to tests too — a component test compiles exactly like the bundle does.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
