import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
})