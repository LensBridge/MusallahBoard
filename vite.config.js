import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const friendlyRoutePlugin = {
  name: 'friendly-mpa-routes',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (!req.url) return next()
      const pathname = req.url.split('?')[0]
      if (pathname === '/signin' || pathname === '/admin') {
        req.url = `${pathname}/`
      }
      next()
    })
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [friendlyRoutePlugin],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3000,
    open: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        signin: resolve(rootDir, 'signin/index.html'),
        admin: resolve(rootDir, 'admin/index.html')
      }
    }
  }
})
