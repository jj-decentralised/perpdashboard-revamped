/**
 * CoinGlass API service — provides CEX futures data.
 *
 * Endpoints used:
 *   - /futures/exchange-rank — current OI + volume snapshot per exchange
 *   - /futures/open-interest/exchange-history-chart — historical OI by exchange
 *   - /futures/liquidation/aggregated-history — historical liquidation data
 *   - /futures/global-long-short-account-ratio/history — long/short ratio
 */

import { COINGLASS_BASE, COINGLASS_ENABLED, coinglassHeaders } from '../config/api'

// --- Types ---

interface CGEnvelope<T> {
  code: string
  msg: string
  data: T
}

export interface CGExchangeRank {
  exchange: string
  open_interest_usd: number
  volume_usd: number
  liquidation_usd_24h: number
}

export interface OIExchangeHistoryData {
  time_list: number[]
  price_list: number[]
  data_map: Record<string, number[]>
}

export interface OIExchangePoint {
  date: number
  price: number
  exchanges: Record<string, number>
  total: number
}

export interface LiquidationPoint {
  date: number
  longLiq: number
  shortLiq: number
  total: number
}

export interface LongShortPoint {
  date: number
  longPct: number
  shortPct: number
  ratio: number
}

// --- Fetch helper ---

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
 * Fetch current CEX exchange rankings (24h snapshot).
 */
export async function fetchExchangeRankings(): Promise<CGExchangeRank[] | null> {
  return fetchCG<CGExchangeRank[]>('/futures/exchange-rank')
}

/**
 * Fetch total CEX 24h futures volume from exchange-rank.
 */
export async function fetchCEXCurrentTotal(): Promise<number | null> {
  const data = await fetchExchangeRankings()
  if (!data || data.length === 0) return null
  return data.reduce((sum, ex) => sum + (ex.volume_usd || 0), 0)
}

/**
 * Fetch historical OI broken down by exchange.
 * Returns up to 1 year of data with per-exchange OI values.
 */
export async function fetchOIExchangeHistory(
  symbol = 'BTC',
  range = '1y',
): Promise<OIExchangePoint[] | null> {
  const raw = await fetchCG<OIExchangeHistoryData>(
    '/futures/open-interest/exchange-history-chart',
    { symbol, range },
  )
  if (!raw?.time_list?.length) return null

  const exchanges = Object.keys(raw.data_map)
  return raw.time_list.map((ts, i) => {
    const exchangeVals: Record<string, number> = {}
    let total = 0
    for (const ex of exchanges) {
      const val = raw.data_map[ex]?.[i] || 0
      exchangeVals[ex] = val
      total += val
    }
    return {
      date: ts,
      price: raw.price_list?.[i] || 0,
      exchanges: exchangeVals,
      total,
    }
  })
}

/**
 * Get top N exchanges by average OI from OI history data.
 */
export function getTopOIExchanges(points: OIExchangePoint[], n = 8): string[] {
  const totals = new Map<string, number>()
  for (const pt of points) {
    for (const [ex, val] of Object.entries(pt.exchanges)) {
      totals.set(ex, (totals.get(ex) || 0) + val)
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name)
}

/**
 * Fetch aggregated liquidation history (across all exchanges) for a symbol.
 * Returns daily data with long/short breakdown.
 */
export async function fetchLiquidationHistory(
  symbol = 'BTC',
  interval = '24h',
  limit = 365,
): Promise<LiquidationPoint[] | null> {
  interface RawLiq {
    time: number
    liquidation_usd: number
    long_liquidation_usd: number
    short_liquidation_usd: number
  }

  const data = await fetchCG<RawLiq[]>(
    '/futures/liquidation/aggregated-history',
    { symbol, interval, limit: String(limit) },
  )
  if (!data?.length) return null

  return data.map((d) => ({
    date: d.time,
    longLiq: d.long_liquidation_usd || 0,
    shortLiq: d.short_liquidation_usd || 0,
    total: d.liquidation_usd || (d.long_liquidation_usd + d.short_liquidation_usd) || 0,
  }))
}

/**
 * Fetch global long/short account ratio history for a symbol on an exchange.
 */
export async function fetchLongShortHistory(
  exchange = 'Binance',
  symbol = 'BTCUSDT',
  interval = '24h',
  limit = 365,
): Promise<LongShortPoint[] | null> {
  interface RawLS {
    time: number
    longAccount: number
    shortAccount: number
    longShortRatio: number
  }

  const data = await fetchCG<RawLS[]>(
    '/futures/global-long-short-account-ratio/history',
    { exchange, symbol, interval, limit: String(limit) },
  )
  if (!data?.length) return null

  return data.map((d) => ({
    date: d.time,
    longPct: d.longAccount || 0,
    shortPct: d.shortAccount || 0,
    ratio: d.longShortRatio || 0,
  }))
}
