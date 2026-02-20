/**
 * Caching proxy middleware.
 *
 * Protection layers (in order):
 * 1. Cache: serve from memory/disk if available
 * 2. Circuit breaker: block URLs that returned 429 for 30s
 * 3. Request coalescing: concurrent requests for same URL share one fetch
 * 4. Domain rate limiter: queue ALL requests per domain (1 per 2s for DefiLlama)
 *    — this is the key fix. No matter how many client/warmup requests arrive,
 *    DefiLlama never sees a burst.
 * 5. Negative cache for 4xx: cache 400 errors for 10 min (e.g., treasury
 *    endpoints that don't exist) so we stop retrying them.
 */

import { cacheGet, cacheSet } from './cache.js'

const LLAMA_KEY = process.env.DEFILLAMA_API_KEY || process.env.VITE_DEFILLAMA_API_KEY || ''
const GECKO_KEY = process.env.VITE_COINGECKO_API_KEY || process.env.COINGECKO_API_KEY || ''
const TT_KEY = process.env.VITE_TT_API_KEY || process.env.TT_API_KEY || ''
const CG_KEY = process.env.COINGLASS_API_KEY || process.env.VITE_COINGLASS_API_KEY || ''

// DefiLlama Pro API: key goes in URL path — https://pro-api.llama.fi/{KEY}/endpoint
// Free API: https://api.llama.fi/endpoint, https://yields.llama.fi/endpoint
const LLAMA_BASE = LLAMA_KEY
  ? `https://pro-api.llama.fi/${LLAMA_KEY}`
  : 'https://api.llama.fi'
const YIELDS_BASE = LLAMA_KEY
  ? `https://pro-api.llama.fi/${LLAMA_KEY}/yields`
  : 'https://yields.llama.fi'

const TARGETS = {
  '/api/llama': LLAMA_BASE,
  '/api/gecko': GECKO_KEY
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3',
  '/api/yields': YIELDS_BASE,
  '/api/emissions': LLAMA_BASE,
  ...(TT_KEY ? { '/api/tt': 'https://api.tokenterminal.com/v2' } : {}),
  ...(CG_KEY ? { '/api/coinglass': 'https://open-api-v4.coinglass.com/api' } : {}),
}

// TTL by path pattern (ms)
const TTL_RULES = [
  { pattern: /\/overview\//, ttl: 5 * 60 * 1000 },     // overviews: 5 min
  { pattern: /\/summary\//, ttl: 10 * 60 * 1000 },      // per-exchange: 10 min
  { pattern: /\/protocol\/[^/]+$/, ttl: 15 * 60 * 1000 }, // individual protocol TVL: 15 min
  { pattern: /\/treasury\//, ttl: 30 * 60 * 1000 },     // treasury: 30 min
  { pattern: /\/protocols$/, ttl: 10 * 60 * 1000 },     // protocols list: 10 min
  { pattern: /\/coins\/list/, ttl: 60 * 60 * 1000 },    // coins list: 1 hour
  { pattern: /\/coins\/markets/, ttl: 5 * 60 * 1000 },  // market data: 5 min
  { pattern: /\/coins\/[^/]+\/market_chart/, ttl: 15 * 60 * 1000 }, // charts: 15 min
  { pattern: /\/coins\/[^/]+$/, ttl: 10 * 60 * 1000 },  // coin detail: 10 min
  { pattern: /\/derivatives/, ttl: 5 * 60 * 1000 },     // derivatives: 5 min
  { pattern: /\/simple\//, ttl: 2 * 60 * 1000 },        // simple price: 2 min
  { pattern: /\/perps/, ttl: 5 * 60 * 1000 },           // yields/perps: 5 min
  { pattern: /\/emissions/, ttl: 30 * 60 * 1000 },      // emissions: 30 min
  { pattern: /\/projects\/.*\/metrics/, ttl: 60 * 60 * 1000 }, // TT metrics: 1 hour
  { pattern: /\/futures\/exchange-rank/, ttl: 5 * 60 * 1000 }, // CoinGlass exchange rank: 5 min
  { pattern: /\/futures\/aggregated-taker/, ttl: 10 * 60 * 1000 }, // CoinGlass taker volume: 10 min
]

function getTTL(path) {
  for (const rule of TTL_RULES) {
    if (rule.pattern.test(path)) return rule.ttl
  }
  return 5 * 60 * 1000 // default 5 min
}

function resolveTarget(reqPath) {
  for (const [prefix, target] of Object.entries(TARGETS)) {
    if (reqPath.startsWith(prefix)) {
      const stripped = reqPath.slice(prefix.length)
      return { target, path: stripped }
    }
  }
  return null
}

// ── Domain rate limiter ──
// Queues all upstream requests per domain group so we never burst.
// DefiLlama (api.llama.fi + yields.llama.fi): max 1 request per 2s
// CoinGecko: max 1 request per 500ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class DomainRateLimiter {
  constructor(minDelayMs) {
    this.minDelay = minDelayMs
    this.queue = Promise.resolve()
    this.lastCompleted = 0
  }

  execute(fn) {
    const task = this.queue.then(async () => {
      const elapsed = Date.now() - this.lastCompleted
      if (elapsed < this.minDelay && this.lastCompleted > 0) {
        await sleep(this.minDelay - elapsed)
      }
      try {
        return await fn()
      } finally {
        this.lastCompleted = Date.now()
      }
    })
    // Don't let errors break the chain
    this.queue = task.catch(() => {})
    return task
  }
}

const llamaLimiter = new DomainRateLimiter(3000)  // 1 req / 3s for all DefiLlama
const geckoLimiter = new DomainRateLimiter(500)    // 1 req / 500ms for CoinGecko

function getLimiter(url) {
  if (url.includes('llama.fi')) return llamaLimiter
  if (url.includes('coingecko')) return geckoLimiter
  return null // no limit for CoinGlass, TokenTerminal, etc.
}

// ── Request coalescing ──
const inflight = new Map()

// ── Circuit breaker: URL → timestamp when requests are allowed again ──
const rateLimitedUntil = new Map()
const RATE_LIMIT_COOLDOWN_MS = 30_000

// ── Negative cache for 4xx errors: URL → timestamp when we'll retry ──
const errorCache = new Map()
const ERROR_CACHE_MS = 10 * 60 * 1000 // 10 minutes for 400/404 errors

export async function proxyRequest(reqPath, reqQuery) {
  const resolved = resolveTarget(reqPath)
  if (!resolved) return null

  const queryString = new URLSearchParams(reqQuery).toString()
  const externalUrl = `${resolved.target}${resolved.path}${queryString ? '?' + queryString : ''}`
  const cacheKey = externalUrl

  // 1. Check cache
  const cached = cacheGet(cacheKey)
  if (cached) {
    return { data: cached, fromCache: true }
  }

  // 2. Check circuit breaker (429 cooldown)
  const blockedUntil = rateLimitedUntil.get(cacheKey)
  if (blockedUntil && Date.now() < blockedUntil) {
    const remaining = Math.ceil((blockedUntil - Date.now()) / 1000)
    throw new Error(`Rate limited (cooling down ${remaining}s): ${externalUrl}`)
  }

  // 3. Check negative cache (400/404 — endpoint doesn't exist, stop retrying)
  const errorUntil = errorCache.get(cacheKey)
  if (errorUntil && Date.now() < errorUntil) {
    throw new Error(`Cached error (not retrying): ${externalUrl}`)
  }

  // 4. Request coalescing: if same URL is already in-flight, wait for it
  if (inflight.has(cacheKey)) {
    const data = await inflight.get(cacheKey)
    return { data, fromCache: true }
  }

  // 5. Build headers
  const headers = {}
  if (GECKO_KEY && resolved.target.includes('coingecko')) {
    headers['x-cg-pro-api-key'] = GECKO_KEY
  }
  if (TT_KEY && resolved.target.includes('tokenterminal')) {
    headers['Authorization'] = `Bearer ${TT_KEY}`
  }
  if (CG_KEY && resolved.target.includes('coinglass')) {
    headers['CG-API-KEY'] = CG_KEY
  }

  // 6. Rate-limited upstream fetch
  const limiter = getLimiter(externalUrl)

  const doFetch = async () => {
    const res = await fetch(externalUrl, { headers })
    if (!res.ok) {
      if (res.status === 429) {
        rateLimitedUntil.set(cacheKey, Date.now() + RATE_LIMIT_COOLDOWN_MS)
      } else if (res.status >= 400 && res.status < 500) {
        // Cache 400/404 errors so we stop retrying known-bad endpoints
        errorCache.set(cacheKey, Date.now() + ERROR_CACHE_MS)
      }
      throw new Error(`Upstream ${res.status}: ${externalUrl}`)
    }
    const data = await res.text()
    const ttl = getTTL(resolved.path)
    cacheSet(cacheKey, data, ttl)
    rateLimitedUntil.delete(cacheKey)
    errorCache.delete(cacheKey)
    return data
  }

  const fetchPromise = limiter ? limiter.execute(doFetch) : doFetch()

  inflight.set(cacheKey, fetchPromise)

  try {
    const data = await fetchPromise
    return { data, fromCache: false }
  } finally {
    inflight.delete(cacheKey)
  }
}
