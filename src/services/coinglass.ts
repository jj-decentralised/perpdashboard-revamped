/**
 * CoinGlass API service — provides accurate CEX futures volume data.
 *
 * Strategy: CoinGlass has no single "total CEX volume" history endpoint.
 * Instead we:
 *   1. Fetch /futures/exchange-rank for current total CEX 24h volume
 *   2. Fetch aggregated taker buy+sell history for BTC + ETH + SOL (daily, 365d)
 *   3. Compute scaleFactor = totalCEXCurrent / latestProxyVolume
 *   4. Apply scale factor to all historical points → estimated total CEX volume
 *
 * Falls back gracefully: returns null if API unavailable.
 */

import { COINGLASS_BASE, COINGLASS_ENABLED, coinglassHeaders } from '../config/api'

// --- Types ---

interface CGEnvelope<T> {
  code: string
  msg: string
  data: T
}

interface CGExchangeRank {
  exchange: string
  open_interest_usd: number
  volume_usd: number
  liquidation_usd_24h: number
}

interface CGTakerVolumePoint {
  time: number // ms timestamp
  aggregated_buy_volume_usd: number
  aggregated_sell_volume_usd: number
}

export interface CEXVolumePoint {
  date: number // ms timestamp (start of day)
  cexVol: number
}

// --- localStorage cache helpers ---

const LS_KEY = 'cg_cex_volume_history'
const LS_TTL = 60 * 60 * 1000 // 1 hour

function getCachedCEXVolume(): CEXVolumePoint[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > LS_TTL) {
      localStorage.removeItem(LS_KEY)
      return null
    }
    return data as CEXVolumePoint[]
  } catch {
    return null
  }
}

function setCachedCEXVolume(data: CEXVolumePoint[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch { /* quota exceeded — ignore */ }
}

// --- Fetch helpers ---

async function fetchCG<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  if (!COINGLASS_ENABLED) return null

  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const url = `${COINGLASS_BASE}${path}${qs}`

  try {
    const res = await fetch(url, { headers: coinglassHeaders() })
    if (!res.ok) {
      console.warn(`[coinglass] ${res.status} for ${path}`)
      return null
    }
    const json: CGEnvelope<T> = await res.json()
    if (json.code !== '0') {
      console.warn(`[coinglass] API error ${json.code}: ${json.msg}`)
      return null
    }
    return json.data
  } catch (err) {
    console.warn(`[coinglass] fetch failed for ${path}:`, err)
    return null
  }
}

// --- Public API ---

/**
 * Fetch current CEX exchange volumes (24h).
 * Returns total across all exchanges.
 */
async function fetchExchangeRankTotal(): Promise<number | null> {
  const data = await fetchCG<CGExchangeRank[]>('/futures/exchange-rank')
  if (!data || data.length === 0) return null
  return data.reduce((sum, ex) => sum + (ex.volume_usd || 0), 0)
}

/**
 * Fetch aggregated taker buy+sell volume history for a symbol.
 * Returns daily data points with total volume (buy + sell).
 */
async function fetchTakerVolumeHistory(
  symbol: string,
  limit = 4500,
): Promise<{ time: number; vol: number }[] | null> {
  const data = await fetchCG<CGTakerVolumePoint[]>(
    '/futures/aggregated-taker-buy-sell-volume/history',
    { symbol, interval: '1d', limit: String(limit) },
  )
  if (!data || data.length === 0) return null
  return data.map((p) => ({
    time: p.time,
    vol: (p.aggregated_buy_volume_usd || 0) + (p.aggregated_sell_volume_usd || 0),
  }))
}

// Top symbols by CEX futures volume — more symbols = better proxy coverage
const PROXY_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'SUI']

/**
 * Build estimated total CEX futures volume history.
 *
 * 1. Fetches exchange-rank for current total CEX 24h volume
 * 2. Fetches aggregated taker history for top 10 symbols (daily, full history)
 * 3. Computes scaleFactor = totalCEXCurrent / latestProxyVolume
 * 4. Applies scale factor to all historical points
 *
 * Returns null if CoinGlass is unavailable.
 */
export async function fetchCEXVolumeHistory(): Promise<CEXVolumePoint[] | null> {
  const cached = getCachedCEXVolume()
  if (cached) return cached

  if (!COINGLASS_ENABLED) return null

  // Fetch exchange-rank + all symbol histories in parallel
  const [totalCurrent, ...symbolHistories] = await Promise.all([
    fetchExchangeRankTotal(),
    ...PROXY_SYMBOLS.map((sym) => fetchTakerVolumeHistory(sym)),
  ])

  if (!totalCurrent) {
    console.warn('[coinglass] Missing exchange-rank data')
    return null
  }

  // BTC is required as the backbone timeline
  const btcHist = symbolHistories[0]
  if (!btcHist || btcHist.length === 0) {
    console.warn('[coinglass] Missing BTC taker volume history')
    return null
  }

  // Build lookup maps for all other symbols
  const symbolMaps = symbolHistories.slice(1).map((hist) =>
    hist ? new Map(hist.map((p) => [p.time, p.vol])) : new Map<number, number>()
  )

  // Sum all symbols per day, using BTC as timeline backbone
  const proxyPoints = btcHist.map((btc) => {
    let proxyVol = btc.vol
    for (const sMap of symbolMaps) {
      proxyVol += sMap.get(btc.time) || 0
    }
    return { time: btc.time, proxyVol }
  })

  if (proxyPoints.length === 0) return null

  // Scale factor: actual total CEX current ÷ latest proxy volume
  const latestProxy = proxyPoints[proxyPoints.length - 1].proxyVol
  if (latestProxy <= 0) return null

  const scaleFactor = totalCurrent / latestProxy

  const result: CEXVolumePoint[] = proxyPoints.map((p) => ({
    date: normalizeToDay(p.time),
    cexVol: p.proxyVol * scaleFactor,
  }))

  setCachedCEXVolume(result)
  return result
}

/** Normalize a ms timestamp to start of UTC day */
function normalizeToDay(ms: number): number {
  const d = new Date(ms)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}
