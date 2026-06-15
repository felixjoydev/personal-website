import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public')

// Serve standalone pages that live at public/<name>/index.html (supergoal,
// snapwrite, simplywise, …) at clean URLs like /supergoal and /supergoal/.
// Without this, Vite's SPA history-fallback rewrites those routes to the
// app's index.html and you land on the homepage instead of the page.
function standalonePages() {
  const rewrite = (req, _res, next) => {
    const path = (req.url || '/').split('?')[0]
    if (path !== '/' && !path.includes('.')) {
      const clean = path.replace(/\/+$/, '')
      if (existsSync(join(publicDir, clean, 'index.html'))) {
        req.url = `${clean}/index.html${req.url.slice(path.length)}`
      }
    }
    next()
  }
  return {
    name: 'serve-standalone-pages',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), standalonePages()],
})
