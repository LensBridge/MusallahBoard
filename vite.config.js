import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The board app only ever runs served by the device agent at 127.0.0.1:8080,
// which answers /api (payload, status, SSE events) and /media same-origin. In
// dev we proxy both to an agent so the page stays same-origin there too. Point
// it at a real board with `ssh -L 8080:127.0.0.1:8080 <board>` (the default),
// or set VITE_DEV_AGENT to another agent.
const AGENT = process.env.VITE_DEV_AGENT || 'http://127.0.0.1:8080'

// Baked into the bundle as the build's own version (src/version.js). It is the
// same number scripts/package-mbu.mjs signs into the app package, so the
// diagnostics can show which build is really running.
const { version: APP_VERSION } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

export default defineConfig({
  plugins: [react()],
  define: {
    __MB_APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      // /api/local/events is Server-Sent Events: a plain long-lived HTTP
      // response, which the proxy streams through as it arrives.
      '/api': { target: AGENT, changeOrigin: true },
      '/media': { target: AGENT, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  // Vitest reads this config, so the React plugin applies to tests too: a
  // component test compiles exactly like the bundle does.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.mjs'],
  },
})
