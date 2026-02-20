/**
 * Pre-warms the cache by fetching all dashboard-critical API endpoints.
 * Runs on server start and then every REFRESH_INTERVAL.
 *
 * Key design:
 * - URLs grouped by upstream domain to respect per-domain rate limits
 * - DefiLlama (api.llama.fi + yields.llama.fi): sequential, 4s apart
 * - CoinGecko, CoinGlass: sequential with shorter delays
 * - Different domain groups run in parallel
 * - Two-pass approach: first pass tries all URLs, second pass retries failed
 *   ones after a 35s cooldown (proxy circuit breaker blocks for 30s on 429)
 */

import { proxyRequest } from './proxy.js'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── DefiLlama endpoints (api.llama.fi + yields.llama.fi share rate limits) ──
// Ordered: lightweight/critical first (dashboard needs these to render),
// heavy/optional endpoints last
const LLAMA_URLS = [
  // Critical for dashboard rendering
  '/api/llama/overview/derivatives?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/open-interest?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/protocols',
  // Optional/lazy-loaded features
  '/api/yields/perps',
  '/api/emissions/emissions',
  '/api/llama/overview/dexs',
  // Heavy endpoint last — chain breakdown line charts
  '/api/llama/overview/derivatives',
]

// ── CoinGecko endpoints ──
const GECKO_URLS = [
  '/api/gecko/derivatives/exchanges?per_page=100&order=open_interest_btc_desc',
  '/api/gecko/derivatives',
  '/api/gecko/simple/price?ids=bitcoin&vs_currencies=usd',
  '/api/gecko/coins/list',
]

// ── CoinGlass endpoints (only if API key is set) ──
const COINGLASS_URLS = []
const CG_KEY = process.env.COINGLASS_API_KEY || process.env.VITE_COINGLASS_API_KEY || ''
if (CG_KEY) {
  COINGLASS_URLS.push(
    '/api/coinglass/futures/exchange-rank',
    '/api/coinglass/futures/aggregated-taker-buy-sell-volume/history?symbol=BTC&interval=1d&limit=365',
    '/api/coinglass/futures/aggregated-taker-buy-sell-volume/history?symbol=ETH&interval=1d&limit=365',
    '/api/coinglass/futures/aggregated-taker-buy-sell-volume/history?symbol=SOL&interval=1d&limit=365',
  )
}

function parseUrlParts(url) {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) return { path: url, query: {} }
  const path = url.slice(0, qIndex)
  const params = Object.fromEntries(new URLSearchParams(url.slice(qIndex + 1)))
  return { path, query: params }
}

/** Single attempt to warm one URL. Returns true on success. */
async function warmOne(url) {
  const { path, query } = parseUrlParts(url)
  try {
    const result = await proxyRequest(path, query)
    const size = result?.data?.length || 0
    const kb = (size / 1024).toFixed(1)
    console.log(`  [cache] ${result?.fromCache ? 'HIT' : 'MISS'} ${path} (${kb} KB)`)
    return true
  } catch (err) {
    console.warn(`  [cache] FAIL ${path}: ${err.message}`)
    return false
  }
}

/**
 * Two-pass warmup for a domain group:
 * Pass 1: try every URL sequentially with delayMs between each.
 * Pass 2: after a 35s cooldown (so the proxy's 30s circuit breaker expires),
 *          retry any URLs that failed in pass 1.
 */
async function warmDomainGroup(urls, label, delayMs) {
  if (urls.length === 0) return
  console.log(`  [warmup] ${label} — pass 1 (${urls.length} endpoints, ${delayMs}ms apart)`)

  // Pass 1
  const failed = []
  for (let i = 0; i < urls.length; i++) {
    const ok = await warmOne(urls[i])
    if (!ok) failed.push(urls[i])
    if (i < urls.length - 1) await sleep(delayMs)
  }

  if (failed.length === 0) return

  // Pass 2: retry after circuit breaker cooldown
  console.log(`  [warmup] ${label} — ${failed.length} failed, waiting 35s for cooldown...`)
  await sleep(35_000)
  console.log(`  [warmup] ${label} — pass 2 (retrying ${failed.length} endpoints)`)

  const stillFailed = []
  for (let i = 0; i < failed.length; i++) {
    const ok = await warmOne(failed[i])
    if (!ok) stillFailed.push(failed[i])
    if (i < failed.length - 1) await sleep(delayMs)
  }

  if (stillFailed.length > 0) {
    console.warn(`  [warmup] ${label} — ${stillFailed.length} endpoints still failing: ${stillFailed.map((u) => parseUrlParts(u).path).join(', ')}`)
  }
}

export async function warmupCache() {
  console.log('[warmup] Pre-warming cache...')
  const start = Date.now()

  // Warm all domain groups in parallel — they don't share rate limits
  await Promise.all([
    warmDomainGroup(LLAMA_URLS, 'DefiLlama', 4000),
    warmDomainGroup(GECKO_URLS, 'CoinGecko', 1000),
    warmDomainGroup(COINGLASS_URLS, 'CoinGlass', 500),
  ])

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
