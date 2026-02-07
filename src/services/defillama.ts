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

// Winsorized mean: cap values at 1st and 99th percentile to remove outlier influence
function winsorizedMean(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length < 5) return avg(values) // too few to winsorize
  const sorted = [...values].sort((a, b) => a - b)
  const low = sorted[Math.floor(sorted.length * 0.01)]
  const high = sorted[Math.floor(sorted.length * 0.99)]
  const clamped = values.map((v) => Math.max(low, Math.min(high, v)))
  return clamped.reduce((a, b) => a + b, 0) / clamped.length
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
    avgChange1d: winsorizedMean(
      exchanges.filter((e) => e.change_1d != null).map((e) => e.change_1d!)
    ),
    avgChange7d: winsorizedMean(
      exchanges.filter((e) => e.change_7d != null).map((e) => e.change_7d!)
    ),
    avgChange1m: winsorizedMean(
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
// Keys include ACTUAL DefiLlama derivatives slugs (e.g. "hyperliquid-perps")
// plus base names for slug-stripping fallback (e.g. "hyperliquid")
// Only includes CoinGecko IDs that have been verified to exist
export const SLUG_TO_GECKO_TOKEN: Record<string, string> = {
  // ── Top exchanges (actual DefiLlama slugs + base names) ──
  'hyperliquid-perps': 'hyperliquid',
  'hyperliquid': 'hyperliquid',
  'aster-perps': 'aster-2',
  'aster': 'aster-2',
  'jupiter-perpetual-exchange': 'jupiter-exchange-solana',
  'jupiter-perps': 'jupiter-exchange-solana',
  'jupiter': 'jupiter-exchange-solana',
  'dydx-v4': 'dydx-chain',
  'dydx': 'dydx-chain',
  'gmx-v2-perps': 'gmx',
  'gmx-v2': 'gmx',
  'gmx': 'gmx',
  'drift-trade': 'drift-protocol',
  'drift': 'drift-protocol',
  'paradex-perps': 'paradex',
  'orderly-perps': 'orderly-network',
  'orderly': 'orderly-network',
  'gains-network': 'gains-network',
  'gains': 'gains-network',
  'aevo-perps': 'aevo-exchange',
  'aevo': 'aevo-exchange',
  'bluefin-pro': 'bluefin',
  'bluefin': 'bluefin',
  'vertex-protocol': 'vertex-protocol',
  'vertex': 'vertex-protocol',
  'myx-finance': 'myx-finance',
  'avantis': 'avantis',
  'kiloex': 'kiloex',
  'flex-perpetuals': 'flex-2',
  'flex': 'flex-2',
  'flashtrade': 'flash-trade',
  'flash-trade': 'flash-trade',
  'merkle-trade': 'merkle-trade',
  'polynomial-trade': 'polynomial-protocol',
  'polynomial': 'polynomial-protocol',
  'kwenta': 'kwenta',
  'synthetix': 'havven',
  'apollox': 'apollox-2',
  'holdstation-defutures': 'holdstation-2',
  'holdstation': 'holdstation-2',
  'zeta': 'zeta-markets',
  'cyberperp': 'cyberperp',
  'metavault-trade': 'metavault-trade',
  'metavault': 'metavault-trade',
  'amped-finance': 'amped-finance',
  'xena-finance': 'xena-finance',
  'derive-v2': 'derive',
  'derive': 'derive',
  'adrena-protocol': 'adrena',
  'adrena': 'adrena',
  'injective-perps': 'injective-protocol',
  'injective': 'injective-protocol',
  'symmio': 'symmio',
  'synfutures-v3': 'synfutures',
  'synfutures': 'synfutures',
  'pancakeswap-perps': 'pancakeswap-token',
  'pancakeswap': 'pancakeswap-token',
  'apex-omni': 'apex-protocol-2',
  'apex': 'apex-protocol-2',
  'lighter-perps': 'lighter',
  'lighter': 'lighter',
}

export async function fetchDashboardData(): Promise<DashboardData> {
  // Phase 1: Fetch all data sources in parallel
  // Use lightweight overview (exclude breakdown) for enrichment — breakdown fetched lazily
  const [derivativesOverview, protocols, feeOverview, cgExchanges, btcPrice, cgTickers, coinsList, oiOverview, fundingRateData, spotDexOverview] = await Promise.all([
    fetchDerivativesOverview(true),
    fetchProtocols(),
    fetchFeeOverview(),
    fetchCGDerivativesExchanges(),
    fetchBTCPrice(),
    fetchCGDerivativesTickers(),
    fetchCachedCoinsList(),
    fetchOIOverview(),
    fetchFundingRates(),
    fetchSpotDexOverview(),
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
      .replace(/\s+(bridge|perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|network|trade|pro|omni|markets?)$/i, '')
      .trim()
    if (strippedName && strippedName !== p.name.toLowerCase()) keys.push(strippedName)

    const strippedSlug = p.slug.toLowerCase()
      .replace(/-(bridge|perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '')
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

  // Top funding rate tickers — filter outliers (|rate| > 1% is garbage data)
  const topFundingRates = cgTickers
    .filter((t) =>
      t.contract_type === 'perpetual' &&
      t.funding_rate != null &&
      isFinite(t.funding_rate) &&
      Math.abs(t.funding_rate) <= 1 &&
      t.symbol &&
      t.market
    )
    .sort((a, b) => Math.abs(b.funding_rate) - Math.abs(a.funding_rate))
    .slice(0, 30)

  const allProtocols = derivativesOverview.protocols || []

  // Helper: resolve CoinGecko token ID from multiple sources
  function resolveGeckoTokenId(slug: string, name: string, protInfo: ProtocolInfo | undefined, tokenSymbol: string | null): string | null {
    // 1. From manual map (highest priority — curated, correct)
    const slugLower = slug?.toLowerCase() || ''
    if (SLUG_TO_GECKO_TOKEN[slugLower]) return SLUG_TO_GECKO_TOKEN[slugLower]
    // Stripped slug (remove common suffixes: -perps, -trade, -pro, -omni, -markets, etc.)
    const stripped = slugLower.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
    if (stripped !== slugLower && SLUG_TO_GECKO_TOKEN[stripped]) return SLUG_TO_GECKO_TOKEN[stripped]
    // 2. From DefiLlama protocol match
    if (protInfo?.gecko_id) return protInfo.gecko_id
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
    // Only compute if exchange has meaningful volume (not dead)
    if (ex.mcap && ex.mcap > 0 && (ex.total24h || 0) > 0) {
      if (ex.annualizedFees && ex.annualizedFees > 0) {
        ex.psRatio = ex.mcap / ex.annualizedFees
      }
      if (ex.annualizedRevenue && ex.annualizedRevenue > 0) {
        ex.peRatio = ex.mcap / ex.annualizedRevenue
      }
    }
  }

  // ── PASS 3: Deduplicate exchanges sharing the same token (geckoId) ──
  // e.g. dYdX V4 + dYdX V3, GMX V2 + GMX V1, Synthetix v1+v2 + V3
  // Keep the highest-volume version, aggregate volumes from siblings

  const geckoIdGroups = new Map<string, EnrichedExchange[]>()
  const deduped: EnrichedExchange[] = []

  for (const ex of enrichedExchanges) {
    if (ex.geckoId) {
      if (!geckoIdGroups.has(ex.geckoId)) geckoIdGroups.set(ex.geckoId, [])
      geckoIdGroups.get(ex.geckoId)!.push(ex)
    } else {
      deduped.push(ex)
    }
  }

  for (const [, group] of geckoIdGroups) {
    // Sort by 24h volume desc — primary is the most active version
    group.sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
    const primary = { ...group[0] }

    // Aggregate volumes and fees from all versions
    for (let i = 1; i < group.length; i++) {
      const sibling = group[i]
      primary.total24h = (primary.total24h || 0) + (sibling.total24h || 0)
      primary.total7d = (primary.total7d || 0) + (sibling.total7d || 0)
      primary.total30d = (primary.total30d || 0) + (sibling.total30d || 0)
      if (sibling.openInterest > (primary.openInterest || 0)) {
        primary.openInterest = sibling.openInterest
      }
      if (sibling.perpPairsCount != null) {
        primary.perpPairsCount = (primary.perpPairsCount || 0) + sibling.perpPairsCount
      }
      if (sibling.feeData?.total24h) {
        primary.feeData = primary.feeData || {} as any
        primary.feeData!.total24h = (primary.feeData?.total24h || 0) + sibling.feeData.total24h
      }
    }

    // Recompute P/S, P/E with aggregated fees
    const aggFees24h = primary.feeData?.total24h || 0
    if (aggFees24h > 0) {
      primary.annualizedFees = aggFees24h * 365
      primary.annualizedRevenue = aggFees24h * 0.3 * 365
      if (primary.mcap && primary.mcap > 0 && (primary.total24h || 0) > 0) {
        primary.psRatio = primary.mcap / primary.annualizedFees!
        primary.peRatio = primary.mcap / primary.annualizedRevenue!
      }
    }

    // Recompute volume ratios
    const vol24 = primary.total24h || 0
    primary.volumeToTvl = primary.tvl && primary.tvl > 0 ? vol24 / primary.tvl : null
    primary.volumeToOI = primary.openInterest > 0 ? vol24 / primary.openInterest : null

    deduped.push(primary)
  }

  deduped.sort(
    (a, b) => (b.total24h || 0) - (a.total24h || 0)
  )

  const tokenExchanges = deduped.filter((e) => e.hasToken)
  const noTokenExchanges = deduped.filter((e) => !e.hasToken)

  const tokenGroup = buildGroupStats('With Token', tokenExchanges)
  const noTokenGroup = buildGroupStats('Without Token', noTokenExchanges)

  const historicalVolume: HistoricalDataPoint[] = (
    derivativesOverview.totalDataChart || []
  ).map(([date, value]) => ({ date: date * 1000, value }))

  const topExchangeNames = deduped.slice(0, 8).map((e) => e.name)

  // Use cgMarketData for sparkline token prices too
  const topTokenPrices = cgMarketData

  const historicalOI: HistoricalDataPoint[] = (
    oiOverview.totalDataChart || []
  ).map(([date, value]: [number, number]) => ({ date: date * 1000, value }))

  return {
    dexOverview: derivativesOverview,
    protocols: derivativeProtocols,
    feeOverview,
    enrichedExchanges: deduped,
    tokenGroup,
    noTokenGroup,
    historicalVolume,
    topTokenPrices,
    totalOpenInterest,
    topFundingRates,
    volumeShareHistory: [] as VolumeSharePoint[], // Populated lazily via fetchVolumeShareData
    topExchangeNames,
    historicalOI,
    fundingRateData: fundingRateData as any[],
    spotVolume24h: spotDexOverview.total24h,
    spotVolume7d: spotDexOverview.total7d,
  }
}

// Fetch historical OI time series
export async function fetchOIOverview(): Promise<{ totalDataChart: [number, number][]; protocols: any[] }> {
  try {
    return await fetchJSON<any>('https://api.llama.fi/overview/open-interest?excludeTotalDataChartBreakdown=true')
  } catch {
    return { totalDataChart: [], protocols: [] }
  }
}

// Fetch funding rate data from yields endpoint
export async function fetchFundingRates(): Promise<any[]> {
  try {
    const data = await fetchJSON<any>('https://yields.llama.fi/perps')
    return data?.data || []
  } catch {
    return []
  }
}

// Fetch spot DEX overview for perps vs spot comparison
export async function fetchSpotDexOverview(): Promise<{ total24h: number; total7d: number; total30d: number }> {
  try {
    const data = await fetchJSON<any>('https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true')
    return { total24h: data.total24h || 0, total7d: data.total7d || 0, total30d: data.total30d || 0 }
  } catch {
    return { total24h: 0, total7d: 0, total30d: 0 }
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
