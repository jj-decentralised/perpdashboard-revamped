/**
 * Caching proxy middleware.
 * - Caches responses in memory with configurable TTL
 * - Request coalescing: concurrent requests for the same URL share one upstream fetch
 * - Negative cache (circuit breaker): after a 429, blocks all requests to that URL
 *   for 30 seconds so we stop hammering the upstream during rate limiting
 */

import { cacheGet, cacheSet } from './cache.js'

const GECKO_KEY = process.env.VITE_COINGECKO_API_KEY || process.env.COINGECKO_API_KEY || ''
const TT_KEY = process.env.VITE_TT_API_KEY || process.env.TT_API_KEY || ''
const CG_KEY = process.env.COINGLASS_API_KEY || process.env.VITE_COINGLASS_API_KEY || ''

const TARGETS = {
  '/api/llama': 'https://api.llama.fi',
  '/api/gecko': GECKO_KEY
    ? 'https://pro-api.coingecko.com/api/v3'
    : 'https://api.coingecko.com/api/v3',
  '/api/yields': 'https://yields.llama.fi',
  '/api/emissions': 'https://api.llama.fi',
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

// Request coalescing: concurrent requests for the same URL share one upstream fetch
const inflight = new Map()

// Negative cache / circuit breaker: URL → timestamp when we'll allow requests again.
// When a 429 is received, the URL is blocked for RATE_LIMIT_COOLDOWN_MS.
// This prevents ALL callers (warmup retries + client requests) from hammering
// the upstream during rate limiting.
const rateLimitedUntil = new Map()
const RATE_LIMIT_COOLDOWN_MS = 30_000 // 30 seconds

export async function proxyRequest(reqPath, reqQuery) {
  const resolved = resolveTarget(reqPath)
  if (!resolved) return null

  // Build the full external URL
  const queryString = new URLSearchParams(reqQuery).toString()
  const externalUrl = `${resolved.target}${resolved.path}${queryString ? '?' + queryString : ''}`

  // Check cache first
  const cacheKey = externalUrl
  const cached = cacheGet(cacheKey)
  if (cached) {
    return { data: cached, fromCache: true }
  }

  // Check negative cache (circuit breaker) — don't hit upstream during cooldown
  const blockedUntil = rateLimitedUntil.get(cacheKey)
  if (blockedUntil && Date.now() < blockedUntil) {
    const remaining = Math.ceil((blockedUntil - Date.now()) / 1000)
    throw new Error(`Rate limited (cooling down ${remaining}s): ${externalUrl}`)
  }

  // Request coalescing: if this URL is already being fetched, wait for it
  if (inflight.has(cacheKey)) {
    const data = await inflight.get(cacheKey)
    return { data, fromCache: true }
  }

  // Build headers
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

  // Start the upstream fetch and register it as in-flight
  const fetchPromise = (async () => {
    const res = await fetch(externalUrl, { headers })
    if (!res.ok) {
      // On 429, activate the circuit breaker for this URL
      if (res.status === 429) {
        rateLimitedUntil.set(cacheKey, Date.now() + RATE_LIMIT_COOLDOWN_MS)
      }
      throw new Error(`Upstream ${res.status}: ${externalUrl}`)
    }
    const data = await res.text()
    const ttl = getTTL(resolved.path)
    cacheSet(cacheKey, data, ttl)
    // Clear any lingering rate limit on success
    rateLimitedUntil.delete(cacheKey)
    return data
  })()

  inflight.set(cacheKey, fetchPromise)

  try {
    const data = await fetchPromise
    return { data, fromCache: false }
  } finally {
    inflight.delete(cacheKey)
  }
}
