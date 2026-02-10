/**
 * CoinGlass API service — provides CEX futures data.
 *
 * Endpoints used:
 *   - /futures/exchange-rank — current OI + volume snapshot per exchange
 *   - /futures/liquidation/aggregated-history — historical liquidation data
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

export interface LiquidationPoint {
  date: number
  longLiq: number
  shortLiq: number
  total: number
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
    aggregated_long_liquidation_usd: number | string
    aggregated_short_liquidation_usd: number | string
  }

  const data = await fetchCG<RawLiq[]>(
    '/futures/liquidation/aggregated-history',
    { symbol, interval, limit: String(limit) },
  )
  if (!data?.length) return null

  return data.map((d) => {
    const longLiq = Number(d.aggregated_long_liquidation_usd) || 0
    const shortLiq = Number(d.aggregated_short_liquidation_usd) || 0
    return {
      date: d.time,
      longLiq,
      shortLiq,
      total: longLiq + shortLiq,
    }
  })
}


