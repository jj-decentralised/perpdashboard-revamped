/**
 * Pre-warms the cache by fetching all dashboard-critical API endpoints.
 * Runs on server start and then every REFRESH_INTERVAL.
 */

import { proxyRequest } from './proxy.js'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// All dashboard-critical endpoints to pre-warm
const WARMUP_URLS = [
  // DefiLlama — dashboard core
  '/api/llama/overview/derivatives?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/open-interest?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/protocols',

  // CoinGecko — derivatives data
  '/api/gecko/derivatives/exchanges?per_page=100&order=open_interest_btc_desc',
  '/api/gecko/derivatives',
  '/api/gecko/simple/price?ids=bitcoin&vs_currencies=usd',
  '/api/gecko/coins/list',

  // Yields — funding rates
  '/api/yields/perps',

  // Emissions
  '/api/emissions/emissions',

  // Lazy-loaded but important
  '/api/llama/overview/dexs',
]

// CoinGlass endpoints (only if API key is set)
const CG_KEY = process.env.COINGLASS_API_KEY || process.env.VITE_COINGLASS_API_KEY || ''
if (CG_KEY) {
  WARMUP_URLS.push(
    '/api/coinglass/futures/exchange-rank',
    '/api/coinglass/futures/liquidation/aggregated-history?symbol=BTC&interval=24h&limit=365',
  )
}

function parseUrlParts(url) {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) return { path: url, query: {} }
  const path = url.slice(0, qIndex)
  const params = Object.fromEntries(new URLSearchParams(url.slice(qIndex + 1)))
  return { path, query: params }
}

async function warmOne(url) {
  const { path, query } = parseUrlParts(url)
  try {
    const result = await proxyRequest(path, query)
    const size = result?.data?.length || 0
    const kb = (size / 1024).toFixed(1)
    console.log(`  [cache] ${result?.fromCache ? 'HIT' : 'MISS'} ${path} (${kb} KB)`)
  } catch (err) {
    console.warn(`  [cache] FAIL ${path}: ${err.message}`)
  }
}

export async function warmupCache() {
  console.log('[warmup] Pre-warming cache...')
  const start = Date.now()

  // Fetch in batches of 3 to avoid rate limiting
  for (let i = 0; i < WARMUP_URLS.length; i += 3) {
    const batch = WARMUP_URLS.slice(i, i + 3)
    await Promise.all(batch.map(warmOne))
    // Small delay between batches to avoid CoinGecko rate limits
    if (i + 3 < WARMUP_URLS.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[warmup] Done in ${elapsed}s`)
}

export function startRefreshLoop() {
  // Initial warmup
  warmupCache()

  // Periodic refresh
  setInterval(() => {
    console.log(`[refresh] Refreshing cache (every ${REFRESH_INTERVAL / 1000}s)...`)
    warmupCache()
  }, REFRESH_INTERVAL)
}
