import { GECKO_BASE, geckoHeaders } from '../config/api'
import type { CGDerivativesExchange, CGDerivativeTicker, CGExchangeDetail } from '../types/coingecko'
import type { CoinGeckoMarketData } from '../types'

async function fetchGeckoJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: geckoHeaders() })
  if (!res.ok) throw new Error(`CoinGecko fetch failed: ${url} (${res.status})`)
  return res.json()
}

export async function fetchCGDerivativesExchanges(): Promise<CGDerivativesExchange[]> {
  try {
    return await fetchGeckoJSON<CGDerivativesExchange[]>(
      `${GECKO_BASE}/derivatives/exchanges?per_page=100&order=open_interest_btc_desc`
    )
  } catch {
    return []
  }
}

export async function fetchCGExchangeDetail(id: string): Promise<CGExchangeDetail | null> {
  try {
    return await fetchGeckoJSON<CGExchangeDetail>(
      `${GECKO_BASE}/derivatives/exchanges/${id}?include_tickers=all`
    )
  } catch {
    return null
  }
}

export async function fetchCGDerivativesTickers(): Promise<CGDerivativeTicker[]> {
  try {
    return await fetchGeckoJSON<CGDerivativeTicker[]>(
      `${GECKO_BASE}/derivatives`
    )
  } catch {
    return []
  }
}

export async function fetchBTCPrice(): Promise<number> {
  try {
    const data = await fetchGeckoJSON<{ bitcoin: { usd: number } }>(
      `${GECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`
    )
    return data.bitcoin.usd
  } catch {
    return 60000
  }
}

export async function fetchTopTokenPrices(geckoIds: string[]): Promise<CoinGeckoMarketData[]> {
  if (geckoIds.length === 0) return []
  const ids = geckoIds.slice(0, 50).join(',')
  try {
    return await fetchGeckoJSON<CoinGeckoMarketData[]>(
      `${GECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d,30d`
    )
  } catch {
    return []
  }
}

// Historical price + market cap chart
export async function fetchCoinMarketChart(geckoId: string, days = 365): Promise<{ prices: [number, number][]; market_caps: [number, number][] }> {
  try {
    return await fetchGeckoJSON<{ prices: [number, number][]; market_caps: [number, number][] }>(
      `${GECKO_BASE}/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`
    )
  } catch {
    return { prices: [], market_caps: [] }
  }
}

// Full coins list for symbol → id mapping (lightweight, ~500KB)
export interface CoinListEntry {
  id: string
  symbol: string
  name: string
}

export async function fetchCoinsList(): Promise<CoinListEntry[]> {
  try {
    return await fetchGeckoJSON<CoinListEntry[]>(
      `${GECKO_BASE}/coins/list`
    )
  } catch {
    return []
  }
}

// Cached version — stores in localStorage for 24h to avoid 500KB re-download
const COINS_CACHE_KEY = 'cg_coins_list'
const COINS_CACHE_TS_KEY = 'cg_coins_list_ts'
const COINS_CACHE_TTL = 86400000 // 24 hours

export async function fetchCachedCoinsList(): Promise<CoinListEntry[]> {
  try {
    const cached = localStorage.getItem(COINS_CACHE_KEY)
    const ts = localStorage.getItem(COINS_CACHE_TS_KEY)
    if (cached && ts && Date.now() - Number(ts) < COINS_CACHE_TTL) {
      return JSON.parse(cached)
    }
  } catch { /* localStorage unavailable or corrupt */ }

  const data = await fetchCoinsList()
  if (data.length > 0) {
    try {
      localStorage.setItem(COINS_CACHE_KEY, JSON.stringify(data))
      localStorage.setItem(COINS_CACHE_TS_KEY, String(Date.now()))
    } catch { /* quota exceeded */ }
  }
  return data
}

// Batch fetch market data including mcap (up to 250 IDs per call)
export async function fetchCoinMarkets(geckoIds: string[]): Promise<CoinGeckoMarketData[]> {
  if (geckoIds.length === 0) return []
  // CoinGecko supports up to 250 ids per request
  const results: CoinGeckoMarketData[] = []
  for (let i = 0; i < geckoIds.length; i += 250) {
    const batch = geckoIds.slice(i, i + 250).join(',')
    try {
      const data = await fetchGeckoJSON<CoinGeckoMarketData[]>(
        `${GECKO_BASE}/coins/markets?vs_currency=usd&ids=${batch}&order=market_cap_desc&per_page=250&page=1&sparkline=true&price_change_percentage=7d,30d`
      )
      results.push(...data)
    } catch {
      // continue with other batches
    }
  }
  return results
}

// Token details (supply, FDV, etc.)
export async function fetchCoinDetail(geckoId: string): Promise<any | null> {
  try {
    return await fetchGeckoJSON<any>(
      `${GECKO_BASE}/coins/${geckoId}?localization=false&tickers=false&community_data=false&developer_data=false`
    )
  } catch {
    return null
  }
}

export async function fetchGlobalData(): Promise<{ totalVolume: number; totalMcap: number; btcDominance: number } | null> {
  try {
    const res = await fetchGeckoJSON<any>(`${GECKO_BASE}/global`)
    const d = res?.data
    if (!d) return null
    return {
      totalVolume: d.total_volume?.usd || 0,
      totalMcap: d.total_market_cap?.usd || 0,
      btcDominance: d.market_cap_percentage?.btc || 0,
    }
  } catch {
    return null
  }
}
