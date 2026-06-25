import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, extname, join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public')

// Serve standalone pages that live at public/<name>/index.html (supergoal, snapwrite, simplywise, …)
// at clean URLs like /supergoal and /supergoal/. Without this, Vite's SPA history-fallback rewrites
// those routes to the app's index.html and you land on the homepage instead of the page. Runs for
// both the dev server and `vite preview`.
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
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) },
  }
}

// Dev-only plugin. Two jobs, both gated to `vite` serve (never affects `vite build`):
//   1. Serve the Vercel functions in /api so the Orb playground (Movorb) works end-to-end during
//      `npm run dev` (in production Vercel serves these directly).
//   2. Serve nested public/.../index.html for directory URLs (e.g. /playground/orb/) as a fallback —
//      standalonePages above already covers this, but keeping it makes the orb self-contained.
function devApi() {
  const PUBLIC = resolve(process.cwd(), 'public')

  const adapt = (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    req.query = Object.fromEntries(url.searchParams)
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
    res.send = (body) => { res.end(body) }
  }
  const routes = { '/api/titles': 'api/titles.js', '/api/poster': 'api/poster.js', '/api/external': 'api/external.js', '/api/details': 'api/details.js' }

  // Map a directory-ish URL to a nested public index.html, if one exists.
  const nestedIndex = (urlPath) => {
    if (extname(urlPath)) return null // has a file extension — let Vite serve it
    const rel = decodeURIComponent(urlPath.replace(/\/+$/, '')) // strip trailing slash(es)
    const file = resolve(PUBLIC, '.' + rel + '/index.html')
    return file.startsWith(PUBLIC) && existsSync(file) ? file : null
  }

  return {
    name: 'movorb-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Runs before Vite's internal middlewares (incl. the SPA fallback).
      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url.split('?')[0]

        // (1) API functions
        const fn = routes[urlPath]
        if (fn) {
          try {
            // Cache-bust the import so edits to /api/*.js are picked up without a restart.
            const url = pathToFileURL(resolve(process.cwd(), fn)).href + '?t=' + Date.now()
            const handler = (await import(url)).default
            adapt(req, res)
            await handler(req, res)
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err?.message || err) }))
          }
          return
        }

        // (2) Nested static pages (skip the app's own routes/assets)
        if (req.method === 'GET' && !urlPath.startsWith('/@') && !urlPath.startsWith('/src/') && !urlPath.startsWith('/node_modules/')) {
          const file = nestedIndex(urlPath)
          if (file) {
            res.setHeader('Content-Type', 'text/html')
            res.end(readFileSync(file))
            return
          }
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Surface API keys from .env into process.env so the dev /api functions can read them
  // locally, exactly like Vercel injects env vars in production.
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['THETVDB_KEY', 'THETVDB_PIN', 'TMDB_KEY']) if (env[k]) process.env[k] = env[k]

  return {
    plugins: [react(), standalonePages(), devApi()],
    // Movorb's globe imports `three` from a browser import-map (CDN), not node_modules.
    // Scope Vite's dep scanner to the real app entry so it doesn't try to resolve it.
    optimizeDeps: { entries: ['index.html'] },
  }
})
