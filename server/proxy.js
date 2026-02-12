/**
 * Caching proxy middleware.
 * Proxies requests to external APIs with request coalescing + stale-while-revalidate.
 */

import { cacheGetOrFetch } from './cache.js'

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
  { pattern: /\/futures\/liquidation/, ttl: 10 * 60 * 1000 }, // CoinGlass liquidations: 10 min
  { pattern: /\/taker-buy-sell-volume/, ttl: 15 * 60 * 1000 }, // CoinGlass taker volume history: 15 min
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

function buildHeaders(target) {
  const headers = {}
  if (GECKO_KEY && target.includes('coingecko')) {
    headers['x-cg-pro-api-key'] = GECKO_KEY
  }
  if (TT_KEY && target.includes('tokenterminal')) {
    headers['Authorization'] = `Bearer ${TT_KEY}`
  }
  if (CG_KEY && target.includes('coinglass')) {
    headers['CG-API-KEY'] = CG_KEY
  }
  return headers
}

export async function proxyRequest(reqPath, reqQuery) {
  const resolved = resolveTarget(reqPath)
  if (!resolved) return null

  // Build the full external URL
  const queryString = new URLSearchParams(reqQuery).toString()
  const externalUrl = `${resolved.target}${resolved.path}${queryString ? '?' + queryString : ''}`

  const ttl = getTTL(resolved.path)
  const headers = buildHeaders(resolved.target)

  // Use coalescing cache: deduplicates concurrent requests + stale-while-revalidate
  return cacheGetOrFetch(externalUrl, async () => {
    const res = await fetch(externalUrl, { headers })
    if (!res.ok) {
      throw new Error(`Upstream ${res.status}: ${externalUrl}`)
    }
    return res.text()
  }, ttl)
}
