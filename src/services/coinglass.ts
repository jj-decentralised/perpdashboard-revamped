/**
 * CoinGlass API service — provides CEX futures data.
 *
 * Currently used for: exchange-rank (current OI + volume snapshot).
 * Historical volume endpoints are per-symbol only and don't aggregate
 * to accurate totals, so we don't use them for volume history.
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
 * Returns per-exchange OI, volume, and liquidations.
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
