/**
 * Caching proxy middleware.
 * Proxies requests to external APIs and caches responses.
 * Includes request coalescing to prevent thundering herd on cold cache.
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

// In-flight request map for coalescing concurrent requests to the same URL.
// Prevents thundering herd: if 4 callers request the same URL before the cache
// is populated, only 1 upstream fetch happens and all 4 share the result.
const inflight = new Map()

export async function proxyRequest(reqPath, reqQuery) {
  const resolved = resolveTarget(reqPath)
  if (!resolved) return null

  // Build the full external URL
  const queryString = new URLSearchParams(reqQuery).toString()
  const externalUrl = `${resolved.target}${resolved.path}${queryString ? '?' + queryString : ''}`

  // Check cache
  const cacheKey = externalUrl
  const cached = cacheGet(cacheKey)
  if (cached) {
    return { data: cached, fromCache: true }
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
      throw new Error(`Upstream ${res.status}: ${externalUrl}`)
    }
    const data = await res.text()
    const ttl = getTTL(resolved.path)
    cacheSet(cacheKey, data, ttl)
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
