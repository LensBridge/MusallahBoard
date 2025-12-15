import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3000,
    open: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
})
