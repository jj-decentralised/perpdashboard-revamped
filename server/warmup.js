/**
 * Pre-warms the cache by fetching all dashboard-critical API endpoints.
 * Runs on server start and then every REFRESH_INTERVAL.
 *
 * Key design:
 * - URLs grouped by upstream domain to respect per-domain rate limits
 * - DefiLlama (api.llama.fi + yields.llama.fi) share rate limits → sequential, 1.5s apart
 * - CoinGecko, CoinGlass → sequential with shorter delays
 * - Different domain groups run in parallel (they don't share rate limits)
 * - Retry on 429 with exponential backoff (3s, 6s, 12s)
 */

import { proxyRequest } from './proxy.js'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── DefiLlama endpoints (api.llama.fi + yields.llama.fi share rate limits) ──
// Ordered: lightweight/critical first, heavy full-breakdown last
const LLAMA_URLS = [
  '/api/llama/overview/derivatives?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/open-interest?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/protocols',
  '/api/yields/perps',
  '/api/emissions/emissions',
  '/api/llama/overview/dexs',
  // Heavy endpoint last — after all critical ones are cached
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

/**
 * Fetch a single URL with retry on 429 (rate limit).
 * Retries up to maxRetries times with exponential backoff: 3s, 6s, 12s.
 */
async function warmOneWithRetry(url, maxRetries = 3) {
  const { path, query } = parseUrlParts(url)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await proxyRequest(path, query)
      const size = result?.data?.length || 0
      const kb = (size / 1024).toFixed(1)
      console.log(`  [cache] ${result?.fromCache ? 'HIT' : 'MISS'} ${path} (${kb} KB)`)
      return true
    } catch (err) {
      const is429 = err.message?.includes('429')
      if (is429 && attempt < maxRetries) {
        const waitMs = 3000 * Math.pow(2, attempt) // 3s, 6s, 12s
        console.log(`  [cache] 429 ${path} — retry ${attempt + 1}/${maxRetries} in ${(waitMs / 1000).toFixed(0)}s`)
        await sleep(waitMs)
        continue
      }
      console.warn(`  [cache] FAIL ${path}: ${err.message}`)
      return false
    }
  }
  return false
}

/**
 * Fetch URLs sequentially within a domain group, with delay between each request.
 * This prevents triggering rate limits on providers that share limits across subdomains.
 */
async function warmDomainGroup(urls, label, delayMs) {
  if (urls.length === 0) return
  console.log(`  [warmup] ${label} (${urls.length} endpoints, ${delayMs}ms apart)`)

  for (let i = 0; i < urls.length; i++) {
    await warmOneWithRetry(urls[i])
    // Delay between requests (not after the last one)
    if (i < urls.length - 1) {
      await sleep(delayMs)
    }
  }
}

export async function warmupCache() {
  console.log('[warmup] Pre-warming cache...')
  const start = Date.now()

  // Warm all domain groups in parallel — they don't share rate limits
  await Promise.all([
    warmDomainGroup(LLAMA_URLS, 'DefiLlama', 1500),
    warmDomainGroup(GECKO_URLS, 'CoinGecko', 800),
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
