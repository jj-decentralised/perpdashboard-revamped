/**
 * Express server: caching proxy + SPA serving.
 *
 * Routes:
 *   /api/llama/*     → proxy to api.llama.fi (cached)
 *   /api/gecko/*     → proxy to coingecko (cached)
 *   /api/yields/*    → proxy to yields.llama.fi (cached)
 *   /api/emissions/* → proxy to api.llama.fi (cached)
 *   /api/tt/*        → proxy to tokenterminal.com (cached, requires TT_API_KEY)
 *   /api/status      → cache health check
 *   /*               → serve built SPA from dist/
 */

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { proxyRequest } from './proxy.js'
import { startRefreshLoop } from './warmup.js'
import { cacheStats } from './cache.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const DIST = join(__dirname, '..', 'dist')

const app = express()

// Trust proxy (Railway, Render, etc.)
app.set('trust proxy', 1)

// CORS for dev mode
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

// API proxy routes
app.get('/api/status', (req, res) => {
  const stats = cacheStats()
  res.json({
    status: 'ok',
    cache: stats,
    uptime: Math.floor(process.uptime()),
  })
})

app.get('/api/llama/*', handleProxy)
app.get('/api/gecko/*', handleProxy)
app.get('/api/yields/*', handleProxy)
app.get('/api/emissions/*', handleProxy)
app.get('/api/tt/*', handleProxy)

async function handleProxy(req, res) {
  try {
    const result = await proxyRequest(req.path, req.query)
    if (!result) {
      return res.status(404).json({ error: 'Unknown proxy route' })
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Cache', result.fromCache ? 'HIT' : 'MISS')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(result.data)
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`)
    res.status(502).json({ error: 'Upstream fetch failed', message: err.message })
  }
}

// Serve static SPA files
app.use(express.static(DIST, { maxAge: '1h' }))

// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(join(DIST, 'index.html'))
})

// Start server
app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`)
  console.log(`[server] Serving SPA from ${DIST}`)

  // Start background cache refresh
  startRefreshLoop()
})
