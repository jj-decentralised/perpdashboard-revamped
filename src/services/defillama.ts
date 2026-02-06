import type {
  DexOverview,
  FeeOverview,
  ProtocolInfo,
  EnrichedExchange,
  TokenGroupStats,
  HistoricalDataPoint,
  DashboardData,
  VolumeSharePoint,
} from '../types'
import type { DerivativesSummary } from '../types/profile'
import { LLAMA_BASE } from '../config/api'
import { fetchCGDerivativesExchanges, fetchCGDerivativesTickers, fetchBTCPrice, fetchTopTokenPrices, fetchCoinsList, fetchCachedCoinsList, fetchCoinMarkets } from './coingecko'
import type { CoinListEntry } from './coingecko'
import { buildCGExchangeMap, matchCGExchange } from '../utils/merge'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)
  return res.json()
}

export async function fetchDerivativesOverview(excludeBreakdown = false): Promise<DexOverview> {
  const params = excludeBreakdown ? '?excludeTotalDataChartBreakdown=true' : ''
  return fetchJSON<DexOverview>(
    `${LLAMA_BASE}/overview/derivatives${params}`
  )
}

export async function fetchProtocols(): Promise<ProtocolInfo[]> {
  return fetchJSON<ProtocolInfo[]>(`${LLAMA_BASE}/protocols`)
}

export async function fetchFeeOverview(): Promise<FeeOverview> {
  return fetchJSON<FeeOverview>(
    `${LLAMA_BASE}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
  )
}

export async function fetchDerivativesSummary(slug: string): Promise<DerivativesSummary> {
  return fetchJSON<DerivativesSummary>(
    `${LLAMA_BASE}/summary/derivatives/${slug}?excludeTotalDataChartBreakdown=true`
  )
}

export async function fetchFeeSummary(slug: string): Promise<any | null> {
  try {
    return await fetchJSON<any>(
      `${LLAMA_BASE}/summary/fees/${slug}?dataType=dailyFees`
    )
  } catch {
    return null
  }
}

export async function fetchRevenueSummary(slug: string): Promise<any | null> {
  try {
    return await fetchJSON<any>(
      `${LLAMA_BASE}/summary/fees/${slug}?dataType=dailyRevenue`
    )
  } catch {
    return null
  }
}

export async function fetchTreasury(slug: string): Promise<any | null> {
  try {
    return await fetchJSON<any>(
      `${LLAMA_BASE}/treasury/${slug}`
    )
  } catch {
    return null
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function buildGroupStats(
  label: string,
  exchanges: EnrichedExchange[]
): TokenGroupStats {
  const withVolume = exchanges.filter((e) => e.total24h && e.total24h > 0)
  return {
    label,
    count: exchanges.length,
    totalVolume24h: exchanges.reduce((s, e) => s + (e.total24h || 0), 0),
    totalVolume30d: exchanges.reduce((s, e) => s + (e.total30d || 0), 0),
    totalTvl: exchanges.reduce((s, e) => s + (e.tvl || 0), 0),
    totalMcap: exchanges
      .filter((e) => e.mcap)
      .reduce((s, e) => s + (e.mcap || 0), 0),
    avgChange1d: avg(
      exchanges.filter((e) => e.change_1d != null).map((e) => e.change_1d!)
    ),
    avgChange7d: avg(
      exchanges.filter((e) => e.change_7d != null).map((e) => e.change_7d!)
    ),
    avgChange1m: avg(
      exchanges.filter((e) => e.change_1m != null).map((e) => e.change_1m!)
    ),
    avgChainCount: avg(exchanges.map((e) => e.chainCount)),
    medianVolume24h: median(withVolume.map((e) => e.total24h!)),
    totalFees24h: exchanges.reduce(
      (s, e) => s + (e.feeData?.total24h || 0),
      0
    ),
    avgVolumeToTvl: avg(
      exchanges
        .filter((e) => e.volumeToTvl != null && isFinite(e.volumeToTvl!))
        .map((e) => e.volumeToTvl!)
    ),
    totalOI: exchanges.reduce((s, e) => s + (e.openInterest || 0), 0),
    avgVolumeToOI: avg(
      exchanges
        .filter((e) => e.volumeToOI != null && isFinite(e.volumeToOI!))
        .map((e) => e.volumeToOI!)
    ),
    exchanges,
  }
}

// Manual mapping: DefiLlama exchange slug → CoinGecko TOKEN id
// This bridges the gap when DefiLlama /protocols has no gecko_id
export const SLUG_TO_GECKO_TOKEN: Record<string, string> = {
  'hyperliquid': 'hyperliquid',
  'dydx': 'dydx-chain',
  'dydx-v4': 'dydx-chain',
  'jupiter-perps': 'jupiter-exchange-solana',
  'jupiter-perpetual-exchange': 'jupiter-exchange-solana',
  'gmx': 'gmx',
  'gmx-v2': 'gmx',
  'vertex-protocol': 'vertex-protocol',
  'aevo': 'aevo-exchange',
  'drift-protocol': 'drift-protocol',
  'kwenta': 'kwenta',
  'gains-network': 'gains-network',
  'synthetix': 'havven',
  'bluefin': 'bluefin',
  'mux-protocol': 'mux-protocol',
  'apollox': 'apollox-2',
  'flash-trade': 'flash-trade',
  'flashtrade': 'flash-trade',
  'merkle-trade': 'merkle-trade',
  'polynomial-trade': 'polynomial-protocol',
  'kiloex': 'kiloex',
  'myx-finance': 'myx-finance',
  'storm-trade': 'storm-trade',
  'apex-protocol': 'apex-protocol-2',
  'orderly-network': 'orderly-network',
  'vest-exchange': 'vest-exchange',
  'levana-perps': 'levana-protocol',
  'tlx-finance': 'tlx',
  'avantis': 'avantis',
  'aster-perps': 'aster-2',
  'backpack-perps': 'backpack-exchange',
  'nether-fi': 'nether-fi',
  'holdstation-defutures': 'holdstation-2',
  'zeta': 'zeta-markets',
  'vela-exchange': 'vela-token',
  'tradoor': 'tradoor',
  'adrena-protocol': 'adrena-protocol',
  'flex-perpetuals': 'flex-crypto',
  'tea-rex': 'tea-rex',
  'cyberperp': 'cyberperp',
  'metavault-trade': 'metavault-trade',
  'amped-finance': 'amped-finance',
  'xena-finance': 'xena-finance',
  'ostium': 'ostium',
  'paradex': 'paradex',
  'd8x': 'd8x',
  'derive': 'derive-2',
}

export async function fetchDashboardData(): Promise<DashboardData> {
  // Phase 1: Fetch all data sources in parallel
  // Use lightweight overview (exclude breakdown) for enrichment — breakdown fetched lazily
  const [derivativesOverview, protocols, feeOverview, cgExchanges, btcPrice, cgTickers, coinsList] = await Promise.all([
    fetchDerivativesOverview(true),
    fetchProtocols(),
    fetchFeeOverview(),
    fetchCGDerivativesExchanges(),
    fetchBTCPrice(),
    fetchCGDerivativesTickers(),
    fetchCachedCoinsList(),
  ])

  // Build symbol → geckoId map from CoinGecko coins list
  // For duplicate symbols, keep all entries to try matching by name later
  const symbolToCoinMap = new Map<string, CoinListEntry[]>()
  for (const coin of coinsList) {
    const sym = coin.symbol.toLowerCase()
    if (!symbolToCoinMap.has(sym)) symbolToCoinMap.set(sym, [])
    symbolToCoinMap.get(sym)!.push(coin)
  }

  // Build protocol lookup — use ALL protocols so mcap matching is broad
  const protocolMap = new Map<string, ProtocolInfo>()
  const derivativeProtocols = protocols.filter(
    (p) => p.category === 'Derivatives' || p.category === 'Dexes' || p.category === 'Dexs'
  )

  // Insert all protocols, preferring entries with mcap data
  for (const p of protocols) {
    const keys = [p.name.toLowerCase(), p.slug.toLowerCase()]

    const strippedName = p.name.toLowerCase()
      .replace(/\s+(bridge|perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|network)$/i, '')
      .trim()
    if (strippedName && strippedName !== p.name.toLowerCase()) keys.push(strippedName)

    const strippedSlug = p.slug.toLowerCase()
      .replace(/-(bridge|perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?)$/i, '')
      .trim()
    if (strippedSlug && strippedSlug !== p.slug.toLowerCase()) keys.push(strippedSlug)

    for (const key of keys) {
      if (!key) continue
      const existing = protocolMap.get(key)
      if (!existing || (p.mcap && p.mcap > 0 && (!existing.mcap || p.mcap > existing.mcap))) {
        protocolMap.set(key, p)
      }
    }
  }

  // Build fee lookup
  const feeMap = new Map<string, FeeOverview['protocols'][0]>()
  for (const f of feeOverview.protocols || []) {
    if (f.name) feeMap.set(f.name.toLowerCase(), f)
    if (f.slug) feeMap.set(f.slug.toLowerCase(), f)
  }

  // Build CoinGecko exchange map
  const cgMap = buildCGExchangeMap(cgExchanges)

  // Top funding rate tickers
  const topFundingRates = cgTickers
    .filter((t) => t.contract_type === 'perpetual' && t.funding_rate != null)
    .sort((a, b) => Math.abs(b.funding_rate) - Math.abs(a.funding_rate))
    .slice(0, 30)

  const allProtocols = derivativesOverview.protocols || []

  // Helper: resolve CoinGecko token ID from multiple sources
  function resolveGeckoTokenId(slug: string, name: string, protInfo: ProtocolInfo | undefined, tokenSymbol: string | null): string | null {
    // 1. From DefiLlama protocol match
    if (protInfo?.gecko_id) return protInfo.gecko_id
    // 2. From manual map
    const slugLower = slug?.toLowerCase() || ''
    if (SLUG_TO_GECKO_TOKEN[slugLower]) return SLUG_TO_GECKO_TOKEN[slugLower]
    // Stripped slug
    const stripped = slugLower.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?)$/i, '').trim()
    if (stripped !== slugLower && SLUG_TO_GECKO_TOKEN[stripped]) return SLUG_TO_GECKO_TOKEN[stripped]
    // 3. From CoinGecko coins list by symbol + name similarity
    if (tokenSymbol && symbolToCoinMap.has(tokenSymbol.toLowerCase())) {
      const candidates = symbolToCoinMap.get(tokenSymbol.toLowerCase())!
      if (candidates.length === 1) return candidates[0].id
      // Try matching by name similarity
      const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const nameMatch = candidates.find((c) => {
        const coinName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        return coinName.includes(nameLower) || nameLower.includes(coinName) || c.id.toLowerCase().includes(slugLower)
      })
      if (nameMatch) return nameMatch.id
      // Fall back to first candidate with a reasonable name
      return candidates[0].id
    }
    return null
  }

  // ── PASS 1: Build initial enriched data and collect gecko IDs ──

  let totalOpenInterest = 0
  const geckoIdCollector: string[] = []

  const enrichedExchanges: EnrichedExchange[] = allProtocols.map((dex) => {
    const protInfo =
      protocolMap.get(dex.name.toLowerCase()) ||
      protocolMap.get(dex.slug?.toLowerCase())
    const feeInfo =
      feeMap.get(dex.name.toLowerCase()) ||
      feeMap.get(dex.slug?.toLowerCase())

    const cgMatch = matchCGExchange(dex.slug, dex.name, cgMap)

    const hasToken = !!(
      protInfo &&
      protInfo.symbol &&
      protInfo.symbol !== '-' &&
      protInfo.symbol !== ''
    )
    const tokenSymbol = hasToken ? protInfo!.symbol : null
    const tvl = protInfo?.tvl || 0
    const vol24 = dex.total24h || 0

    const oiBtc = cgMatch?.open_interest_btc || 0
    const openInterest = oiBtc * btcPrice
    totalOpenInterest += openInterest

    const perpPairsCount = cgMatch?.number_of_perpetual_pairs ?? null
    const futuresPairsCount = cgMatch?.number_of_futures_pairs ?? null

    const fees24h = feeInfo?.total24h || 0
    const revenue24h = (feeInfo as any)?.revenue24h || fees24h * 0.3
    const annualizedFees = fees24h > 0 ? fees24h * 365 : null
    const annualizedRevenue = revenue24h > 0 ? revenue24h * 365 : null

    // Resolve geckoId from all sources
    const geckoId = hasToken ? resolveGeckoTokenId(dex.slug, dex.name, protInfo, tokenSymbol) : null
    if (geckoId) geckoIdCollector.push(geckoId)

    // Use DefiLlama mcap if available; CoinGecko mcap filled in Pass 2
    const mcap = protInfo?.mcap || null

    return {
      ...dex,
      hasToken,
      tokenSymbol,
      geckoId,
      tvl,
      mcap,
      chainCount: dex.chains?.length || 1,
      volumeToTvl: tvl > 0 ? vol24 / tvl : null,
      feeData: feeInfo || undefined,
      openInterest,
      perpPairsCount,
      futuresPairsCount,
      cgExchangeId: cgMatch?.id || null,
      volumeToOI: openInterest > 0 ? vol24 / openInterest : null,
      annualizedFees,
      annualizedRevenue,
      peRatio: null, // Computed in Pass 2
      psRatio: null,
    }
  })

  // ── Phase 2: Batch fetch mcap from CoinGecko for ALL token exchanges ──

  const uniqueGeckoIds = [...new Set(geckoIdCollector)]
  const cgMarketData = uniqueGeckoIds.length > 0
    ? await fetchCoinMarkets(uniqueGeckoIds)
    : []

  // Build geckoId → market data lookup
  const cgMcapMap = new Map<string, { mcap: number; fdv: number | null }>()
  for (const coin of cgMarketData) {
    if (coin.market_cap > 0) {
      cgMcapMap.set(coin.id, {
        mcap: coin.market_cap,
        fdv: (coin as any).fully_diluted_valuation || null,
      })
    }
  }

  // ── PASS 2: Fill mcap from CoinGecko and compute P/S, P/E ──

  for (const ex of enrichedExchanges) {
    // Fill mcap from CoinGecko if DefiLlama didn't have it
    if (!ex.mcap && ex.geckoId) {
      const cgData = cgMcapMap.get(ex.geckoId)
      if (cgData) {
        ex.mcap = cgData.mcap
      }
    }

    // Compute P/S and P/E with (now hopefully available) mcap
    if (ex.mcap && ex.mcap > 0) {
      if (ex.annualizedFees && ex.annualizedFees > 0) {
        ex.psRatio = ex.mcap / ex.annualizedFees
      }
      if (ex.annualizedRevenue && ex.annualizedRevenue > 0) {
        ex.peRatio = ex.mcap / ex.annualizedRevenue
      }
    }
  }

  enrichedExchanges.sort(
    (a, b) => (b.total24h || 0) - (a.total24h || 0)
  )

  const tokenExchanges = enrichedExchanges.filter((e) => e.hasToken)
  const noTokenExchanges = enrichedExchanges.filter((e) => !e.hasToken)

  const tokenGroup = buildGroupStats('With Token', tokenExchanges)
  const noTokenGroup = buildGroupStats('Without Token', noTokenExchanges)

  const historicalVolume: HistoricalDataPoint[] = (
    derivativesOverview.totalDataChart || []
  ).map(([date, value]) => ({ date: date * 1000, value }))

  const topExchangeNames = enrichedExchanges.slice(0, 8).map((e) => e.name)

  // Use cgMarketData for sparkline token prices too
  const topTokenPrices = cgMarketData

  return {
    dexOverview: derivativesOverview,
    protocols: derivativeProtocols,
    feeOverview,
    enrichedExchanges,
    tokenGroup,
    noTokenGroup,
    historicalVolume,
    topTokenPrices,
    totalOpenInterest,
    topFundingRates,
    volumeShareHistory: [] as VolumeSharePoint[], // Populated lazily via fetchVolumeShareData
    topExchangeNames,
  }
}

// Separate call for breakdown data (5-10MB) — loaded lazily after initial render
export async function fetchVolumeShareData(topNames: string[]): Promise<VolumeSharePoint[]> {
  try {
    const overview = await fetchDerivativesOverview(false) // Full breakdown
    const breakdownRaw = overview.totalDataChartBreakdown || []

    const sampled = breakdownRaw.filter((_, i) => i % 7 === 0 || i === breakdownRaw.length - 1)

    return sampled.map(([timestamp, breakdown]) => {
      const point: VolumeSharePoint = { date: timestamp * 1000 }

      let totalDayVolume = 0
      const exchangeVolumes: Record<string, number> = {}

      for (const [exchangeName, chains] of Object.entries(breakdown)) {
        const vol = typeof chains === 'number'
          ? chains
          : Object.values(chains).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
        exchangeVolumes[exchangeName] = vol
        totalDayVolume += vol
      }

      if (totalDayVolume === 0) {
        for (const name of topNames) point[name] = 0
        point['Other'] = 0
        return point
      }

      let otherPct = 100
      for (const name of topNames) {
        const pct = ((exchangeVolumes[name] || 0) / totalDayVolume) * 100
        point[name] = Math.round(pct * 100) / 100
        otherPct -= point[name]
      }
      point['Other'] = Math.max(0, Math.round(otherPct * 100) / 100)

      return point
    })
  } catch {
    return []
  }
}
