/**
 * Pre-warms the cache by fetching all dashboard-critical API endpoints.
 * Runs on server start and then every REFRESH_INTERVAL.
 *
 * Key design:
 * - 15s initial delay on startup — lets rate limits from previous deploy expire
 * - URLs grouped by upstream domain to respect per-domain rate limits
 * - DefiLlama: sequential, 8s apart (~4 req/30s, well under the ~5/30s limit)
 * - CoinGecko, CoinGlass: sequential with shorter delays
 * - Different domain groups run in parallel
 * - Two-pass: pass 1 tries all, pass 2 retries failures after 65s cooldown
 *   (DefiLlama rate limit window is >35s based on production logs)
 */

import { proxyRequest } from './proxy.js'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
const INITIAL_DELAY = 15_000 // 15s — let previous deploy's rate limits expire
const LLAMA_DELAY = 8_000 // 8s between DefiLlama requests
const PASS2_WAIT = 65_000 // 65s — DefiLlama rate limit window is >35s

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── DefiLlama FREE endpoints (api.llama.fi + yields.llama.fi) ──
// All these return 200 on the free API. Ordered: critical first, heavy last.
const LLAMA_URLS = [
  // Critical for dashboard rendering
  '/api/llama/overview/derivatives?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/open-interest?excludeTotalDataChartBreakdown=true',
  '/api/llama/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',
  '/api/llama/protocols',
  '/api/yields/perps',
  '/api/llama/overview/dexs',
  // Heavy endpoint last — chain breakdown line charts
  '/api/llama/overview/derivatives',
]

// ── DefiLlama PAYWALLED endpoints — only warm if DEFILLAMA_API_KEY is set ──
// These return "Upgrade to the paid API plan" on the free API.
const LLAMA_KEY = process.env.DEFILLAMA_API_KEY || process.env.VITE_DEFILLAMA_API_KEY || ''
const LLAMA_PRO_URLS = LLAMA_KEY ? [
  '/api/emissions/emissions',
] : []

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

/** Single attempt to warm one URL. Returns true on success (including cache HIT). */
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
 * Pass 2: after PASS2_WAIT cooldown, retry any URLs that failed in pass 1.
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

  // Pass 2: retry after rate limit window expires
  const waitSec = Math.round(PASS2_WAIT / 1000)
  console.log(`  [warmup] ${label} — ${failed.length} failed, waiting ${waitSec}s for rate limit reset...`)
  await sleep(PASS2_WAIT)
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

export async function warmupCache(isInitial = false) {
  // On initial startup, wait for rate limits from previous deploy to expire
  if (isInitial) {
    console.log(`[warmup] Waiting ${INITIAL_DELAY / 1000}s for rate limits to clear...`)
    await sleep(INITIAL_DELAY)
  }

  console.log('[warmup] Pre-warming cache...')
  const start = Date.now()

  // Warm all domain groups in parallel — they don't share rate limits
  // Note: LLAMA_PRO_URLS share rate limits with LLAMA_URLS, so they run sequentially after
  const allLlamaUrls = [...LLAMA_URLS, ...LLAMA_PRO_URLS]
  if (LLAMA_PRO_URLS.length > 0) {
    console.log(`  [warmup] DefiLlama Pro key detected — will also warm ${LLAMA_PRO_URLS.length} paywalled endpoint(s)`)
  }
  await Promise.all([
    warmDomainGroup(allLlamaUrls, 'DefiLlama', LLAMA_DELAY),
    warmDomainGroup(GECKO_URLS, 'CoinGecko', 1000),
    warmDomainGroup(COINGLASS_URLS, 'CoinGlass', 500),
  ])

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[warmup] Done in ${elapsed}s`)
}

export function startRefreshLoop() {
  // Initial warmup (with delay to let previous deploy's rate limits expire)
  warmupCache(true)

  // Periodic refresh (no initial delay needed — we're the only process)
  setInterval(() => {
    console.log(`[refresh] Refreshing cache (every ${REFRESH_INTERVAL / 1000}s)...`)
    warmupCache(false)
  }, REFRESH_INTERVAL)
}
