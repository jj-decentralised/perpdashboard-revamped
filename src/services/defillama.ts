import type {
  DexOverview,
  FeeOverview,
  ProtocolInfo,
  EnrichedExchange,
  TokenGroupStats,
  HistoricalDataPoint,
  DashboardData,
  VolumeSharePoint,
  FundingRateEntry,
  CarryPairData,
  BasisMetrics,
  AssetOIEntry,
  TreasuryAgg,
  FeeSharePoint,
  PerpFeeSharePoint,
} from '../types'
import type { DerivativesSummary } from '../types/profile'
import { LLAMA_BASE, YIELDS_BASE } from '../config/api'
import { fetchCGDerivativesExchanges, fetchCGDerivativesTickers, fetchBTCPrice, fetchTopTokenPrices, fetchCoinsList, fetchCachedCoinsList, fetchCoinMarkets, fetchGlobalData } from './coingecko'
import type { CoinListEntry } from './coingecko'
import { buildCGExchangeMap, matchCGExchange } from '../utils/merge'
import { classifyProtocol, classifyVenue } from '../utils/classification'

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

export async function fetchHoldersRevenueSummary(slug: string): Promise<any | null> {
  try {
    return await fetchJSON<any>(
      `${LLAMA_BASE}/summary/fees/${slug}?dataType=dailyHoldersRevenue`
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
    // Use median of exchanges with ≥$100K volume to avoid noise from tiny protocols
    avgChange1d: median(
      exchanges.filter((e) => e.change_1d != null && (e.total24h || 0) >= 100_000 && Math.abs(e.change_1d!) < 500).map((e) => e.change_1d!)
    ),
    avgChange7d: median(
      exchanges.filter((e) => e.change_7d != null && (e.total24h || 0) >= 100_000 && Math.abs(e.change_7d!) < 500).map((e) => e.change_7d!)
    ),
    avgChange1m: median(
      exchanges.filter((e) => e.change_1m != null && (e.total24h || 0) >= 100_000 && Math.abs(e.change_1m!) < 500).map((e) => e.change_1m!)
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
  const [derivativesOverview, protocols, feeOverview, cgExchanges, btcPrice, cgTickers, coinsList, oiOverview, fundingRateData, spotDexOverview, globalData] = await Promise.all([
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
    fetchGlobalData(),
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

    const hasTokenFromProtInfo = !!(
      protInfo &&
      protInfo.symbol &&
      protInfo.symbol !== '-' &&
      protInfo.symbol !== ''
    )
    // Fallback: if the slug is in our curated SLUG_TO_GECKO_TOKEN map, it has a token
    const slugLower = dex.slug?.toLowerCase() || ''
    const strippedSlug = slugLower.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
    const hasTokenFromMap = !!(SLUG_TO_GECKO_TOKEN[slugLower] || (strippedSlug !== slugLower && SLUG_TO_GECKO_TOKEN[strippedSlug]))
    const hasToken = hasTokenFromProtInfo || hasTokenFromMap

    // Resolve token symbol: prefer protInfo, fall back to CoinGecko coins list
    let tokenSymbol: string | null = hasTokenFromProtInfo ? protInfo!.symbol : null
    if (!tokenSymbol && hasTokenFromMap) {
      const geckoTokenId = SLUG_TO_GECKO_TOKEN[slugLower] || SLUG_TO_GECKO_TOKEN[strippedSlug]
      const coinEntry = coinsList.find((c) => c.id === geckoTokenId)
      if (coinEntry) tokenSymbol = coinEntry.symbol.toUpperCase()
    }
    const tvl = protInfo?.tvl || 0
    const vol24 = dex.total24h || 0

    const oiBtc = cgMatch?.open_interest_btc || 0
    const openInterest = oiBtc * btcPrice
    totalOpenInterest += openInterest

    const perpPairsCount = cgMatch?.number_of_perpetual_pairs ?? null
    const futuresPairsCount = cgMatch?.number_of_futures_pairs ?? null

    // Annualize fees: prefer trailing 30d × 12, fall back to 24h × 365
    const fees24h = feeInfo?.total24h || 0
    const fees30d = feeInfo?.total30d || 0
    const annualizedFees = fees30d > 0 ? fees30d * 12
      : fees24h > 0 ? fees24h * 365 : null
    const revenue30d = (feeInfo as any)?.revenue30d || fees30d * 0.3
    const revenue24h = (feeInfo as any)?.revenue24h || fees24h * 0.3
    const annualizedRevenue = revenue30d > 0 ? revenue30d * 12
      : revenue24h > 0 ? revenue24h * 365 : null

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
      venueType: classifyProtocol(dex.slug, dex.name, dex.chains || []),
      avgCarryYield: null,
      fundingSlope: null,
      oiHHI: null,
      effectiveAssetCount: null,
      holderYield: null,
      ttRevenue: null,
      ttEarnings: null,
      ttTokenIncentives: null,
      ttActiveUsers: null,
      ttPE: null,
      ttPS: null,
      ttCodeCommits7d: null,
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
      if (sibling.feeData?.total24h || sibling.feeData?.total30d) {
        primary.feeData = primary.feeData || {} as any
        if (sibling.feeData?.total24h) primary.feeData!.total24h = (primary.feeData?.total24h || 0) + sibling.feeData.total24h
        if (sibling.feeData?.total30d) primary.feeData!.total30d = (primary.feeData?.total30d || 0) + (sibling.feeData?.total30d || 0)
      }
    }

    // Recompute P/S, P/E with aggregated fees (prefer 30d × 12)
    const aggFees30d = primary.feeData?.total30d || 0
    const aggFees24h = primary.feeData?.total24h || 0
    if (aggFees30d > 0 || aggFees24h > 0) {
      primary.annualizedFees = aggFees30d > 0 ? aggFees30d * 12 : aggFees24h * 365
      primary.annualizedRevenue = (primary.annualizedFees || 0) * 0.3
      if (primary.mcap && primary.mcap > 0 && (primary.total24h || 0) > 0) {
        primary.psRatio = primary.mcap / primary.annualizedFees!
        primary.peRatio = primary.annualizedRevenue! > 0 ? primary.mcap / primary.annualizedRevenue! : null
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

  // ── PASS 4: Compute carry, basis, HHI from funding rate data ──

  // Build marketplace→exchange name lookup for matching
  const marketplaceToExchange = new Map<string, EnrichedExchange>()
  for (const ex of deduped) {
    const nameLower = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const slugBase = ex.slug.toLowerCase().replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?)/g, '')
    marketplaceToExchange.set(ex.name.toLowerCase(), ex)
    marketplaceToExchange.set(nameLower, ex)
    marketplaceToExchange.set(ex.slug.toLowerCase(), ex)
    if (slugBase !== ex.slug.toLowerCase()) marketplaceToExchange.set(slugBase, ex)
  }

  function resolveExchange(marketplace: string): EnrichedExchange | null {
    const lower = marketplace.toLowerCase()
    if (marketplaceToExchange.has(lower)) return marketplaceToExchange.get(lower)!
    const normalized = lower.replace(/[^a-z0-9]/g, '')
    if (marketplaceToExchange.has(normalized)) return marketplaceToExchange.get(normalized)!
    return null
  }

  // Carry metrics: top pairs by OI with annualized carry
  const carryMetrics: CarryPairData[] = []
  // Group funding data by marketplace for per-exchange carry/slope
  const exchangeFundingMap = new Map<string, { weightedCarry: number; totalOI: number; slopeSum: number; slopeCount: number }>()
  // For basis computation
  const basisByAsset = new Map<string, { weightedBasis: number; totalOI: number }>()
  // For HHI: marketplace → asset → OI
  const exchangeAssetOI = new Map<string, Map<string, number>>()
  // Global asset OI
  const globalAssetOI = new Map<string, number>()

  for (const entry of fundingRateData) {
    if (!entry.marketplace || !entry.baseAsset) continue
    const oi = entry.openInterest || 0

    // Carry computation
    if (entry.fundingRate && isFinite(entry.fundingRate)) {
      const annualizedCarry = entry.fundingRate * 3 * 365 * 100 // as percentage
      const slope = entry.fundingRate30dAverage != null
        ? (entry.fundingRate - entry.fundingRate30dAverage) * 3 * 365 * 100
        : 0

      if (oi > 100_000) {
        carryMetrics.push({
          asset: entry.baseAsset,
          marketplace: entry.marketplace,
          carry: annualizedCarry,
          oi,
          slope,
          currentRate: entry.fundingRate,
          avg7d: entry.fundingRate7dAverage,
          avg30d: entry.fundingRate30dAverage,
          venueType: entry.venueType,
        })
      }

      // Per-exchange aggregation
      const mpKey = entry.marketplace.toLowerCase()
      if (oi > 0) {
        const existing = exchangeFundingMap.get(mpKey) || { weightedCarry: 0, totalOI: 0, slopeSum: 0, slopeCount: 0 }
        existing.weightedCarry += annualizedCarry * oi
        existing.totalOI += oi
        if (entry.fundingRate30dAverage != null) {
          existing.slopeSum += slope
          existing.slopeCount++
        }
        exchangeFundingMap.set(mpKey, existing)
      }
    }

    // Basis computation
    if (entry.markPrice != null && entry.indexPrice != null && entry.indexPrice > 0) {
      const basisBps = ((entry.markPrice - entry.indexPrice) / entry.indexPrice) * 10000
      if (isFinite(basisBps) && Math.abs(basisBps) < 500) { // Filter outliers
        const asset = entry.baseAsset.toUpperCase()
        const existing = basisByAsset.get(asset) || { weightedBasis: 0, totalOI: 0 }
        const weight = oi > 0 ? oi : 1
        existing.weightedBasis += basisBps * weight
        existing.totalOI += weight
        basisByAsset.set(asset, existing)
      }
    }

    // HHI: accumulate OI by asset per exchange
    if (oi > 0) {
      const mpKey = entry.marketplace.toLowerCase()
      if (!exchangeAssetOI.has(mpKey)) exchangeAssetOI.set(mpKey, new Map())
      const assetMap = exchangeAssetOI.get(mpKey)!
      assetMap.set(entry.baseAsset, (assetMap.get(entry.baseAsset) || 0) + oi)
      globalAssetOI.set(entry.baseAsset, (globalAssetOI.get(entry.baseAsset) || 0) + oi)
    }
  }

  // Sort carry pairs by OI desc
  carryMetrics.sort((a, b) => b.oi - a.oi)
  const topCarryMetrics = carryMetrics.slice(0, 50)

  // Assign per-exchange carry yield and slope
  for (const ex of deduped) {
    const mpKey = ex.name.toLowerCase()
    const agg = exchangeFundingMap.get(mpKey) || exchangeFundingMap.get(ex.slug.toLowerCase().replace(/-(perps?|perpetuals?|v\d+)/g, ''))
    if (agg && agg.totalOI > 0) {
      ex.avgCarryYield = agg.weightedCarry / agg.totalOI
      ex.fundingSlope = agg.slopeCount > 0 ? agg.slopeSum / agg.slopeCount : null
    }
  }

  // Compute basis metrics
  const btcBasis = basisByAsset.get('BTC')
  const ethBasis = basisByAsset.get('ETH')
  let marketWideBasisNum = 0, marketWideBasisDen = 0
  const basisTopAssets: BasisMetrics['topAssets'] = []
  for (const [asset, data] of basisByAsset) {
    const avgBasis = data.totalOI > 0 ? data.weightedBasis / data.totalOI : 0
    basisTopAssets.push({ asset, basisBps: avgBasis, oi: data.totalOI })
    marketWideBasisNum += data.weightedBasis
    marketWideBasisDen += data.totalOI
  }
  basisTopAssets.sort((a, b) => b.oi - a.oi)

  const basisMetrics: BasisMetrics = {
    btcBasisBps: btcBasis && btcBasis.totalOI > 0 ? btcBasis.weightedBasis / btcBasis.totalOI : null,
    ethBasisBps: ethBasis && ethBasis.totalOI > 0 ? ethBasis.weightedBasis / ethBasis.totalOI : null,
    marketWideBasisBps: marketWideBasisDen > 0 ? marketWideBasisNum / marketWideBasisDen : null,
    topAssets: basisTopAssets.slice(0, 20),
  }

  // Compute HHI per exchange and assign to deduped
  for (const ex of deduped) {
    const mpKey = ex.name.toLowerCase()
    const assetMap = exchangeAssetOI.get(mpKey) || exchangeAssetOI.get(ex.slug.toLowerCase().replace(/-(perps?|perpetuals?|v\d+)/g, ''))
    if (assetMap && assetMap.size > 0) {
      const totalExOI = Array.from(assetMap.values()).reduce((s, v) => s + v, 0)
      if (totalExOI > 0) {
        let hhi = 0
        for (const oi of assetMap.values()) {
          const share = oi / totalExOI
          hhi += share * share
        }
        ex.oiHHI = hhi
        ex.effectiveAssetCount = Math.round(1 / hhi)
      }
    }
  }

  // Global asset OI breakdown
  const totalGlobalOI = Array.from(globalAssetOI.values()).reduce((s, v) => s + v, 0)
  const assetOIBreakdown: AssetOIEntry[] = Array.from(globalAssetOI.entries())
    .map(([asset, oi]) => ({ asset, totalOI: oi, share: totalGlobalOI > 0 ? (oi / totalGlobalOI) * 100 : 0 }))
    .sort((a, b) => b.totalOI - a.totalOI)
    .slice(0, 30)

  // Global crypto context
  const globalContext = globalData ? {
    totalCryptoVolume: globalData.totalVolume,
    totalCryptoMcap: globalData.totalMcap,
    btcDominance: globalData.btcDominance,
    perpsShare: globalData.totalVolume > 0 ? (derivativesOverview.total24h / globalData.totalVolume) * 100 : 0,
    oiToMcapRatio: globalData.totalMcap > 0 ? (totalOpenInterest / globalData.totalMcap) * 100 : 0,
  } : null

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
    volumeShareHistory: [] as VolumeSharePoint[],
    topExchangeNames,
    historicalOI,
    fundingRateData,
    spotVolume24h: spotDexOverview.total24h,
    spotVolume7d: spotDexOverview.total7d,
    spotVolumeHistory: [],
    carryMetrics: topCarryMetrics,
    basisMetrics,
    globalContext,
    assetOIBreakdown,
    treasuryData: [], // Populated lazily
    perpFeeBreakdown: [], // Populated lazily
    perpFeeBreakdownNames: [],
    perpFeeShareHistory: [], // Populated lazily
    ttAggregate: null, // Populated lazily via Token Terminal
    solanaGrowthHistory: [], // Populated lazily
    liquidationHistory: [], // Populated lazily via CoinGlass
  }
}

// Fetch historical OI time series
export async function fetchOIOverview(): Promise<{ totalDataChart: [number, number][]; protocols: any[] }> {
  try {
    return await fetchJSON<any>(`${LLAMA_BASE}/overview/open-interest?excludeTotalDataChartBreakdown=true`)
  } catch {
    return { totalDataChart: [], protocols: [] }
  }
}

// Fetch funding rate data from yields endpoint, classify venues
export async function fetchFundingRates(): Promise<FundingRateEntry[]> {
  try {
    const data = await fetchJSON<any>(`${YIELDS_BASE}/perps`)
    const raw = data?.data || []
    return raw.map((d: any) => ({
      marketplace: d.marketplace || '',
      market: d.market || '',
      baseAsset: d.baseAsset || '',
      fundingRate: d.fundingRate ?? 0,
      fundingRate7dAverage: d.fundingRate7dAverage ?? null,
      fundingRate30dAverage: d.fundingRate30dAverage ?? null,
      openInterest: d.openInterest ?? null,
      indexPrice: d.indexPrice ?? null,
      markPrice: d.markPrice ?? null,
      venueType: classifyVenue(d.marketplace || ''),
    }))
  } catch {
    return []
  }
}

// Fetch spot DEX overview for perps vs spot comparison
export async function fetchSpotDexOverview(): Promise<{ total24h: number; total7d: number; total30d: number }> {
  try {
    const data = await fetchJSON<any>(`${LLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`)
    return { total24h: data.total24h || 0, total7d: data.total7d || 0, total30d: data.total30d || 0 }
  } catch {
    return { total24h: 0, total7d: 0, total30d: 0 }
  }
}

// Fetch historical spot DEX volume for perps/spot ratio time series (lazy loaded)
export async function fetchSpotVolumeHistory(): Promise<HistoricalDataPoint[]> {
  try {
    const data = await fetchJSON<any>(`${LLAMA_BASE}/overview/dexs?excludeTotalDataChartBreakdown=true`)
    return (data.totalDataChart || []).map(([date, value]: [number, number]) => ({
      date: date * 1000,
      value,
    }))
  } catch {
    return []
  }
}

// Batch-fetch holder yield for top token exchanges (Phase 2 lazy load)
// Only attempt for protocols known to report dailyHoldersRevenue on DefiLlama
const HOLDER_REVENUE_SLUGS = new Set([
  'gmx', 'synthetix', 'dydx-v4', 'dydx', 'gains-network', 'jupiter-perpetual-exchange',
  'vertex-protocol', 'drift-trade', 'aevo-perps', 'kwenta', 'perpetual-protocol',
  'level-finance', 'gains-network-perps', 'mux-protocol',
])

export async function fetchHolderYieldBatch(exchanges: EnrichedExchange[]): Promise<Map<string, number>> {
  const tokenExchanges = exchanges
    .filter(e => e.hasToken && e.mcap && e.mcap > 0 && HOLDER_REVENUE_SLUGS.has(e.slug?.toLowerCase()))
    .slice(0, 20)
  const results = await Promise.all(
    tokenExchanges.map(async (ex) => {
      const data = await fetchHoldersRevenueSummary(ex.slug).catch(() => null)
      const daily = data?.total24h || 0
      if (daily > 0 && ex.mcap && ex.mcap > 0) {
        return { slug: ex.slug, yield: (daily * 365 / ex.mcap) * 100 }
      }
      return null
    })
  )
  const map = new Map<string, number>()
  for (const r of results) {
    if (r) map.set(r.slug, r.yield)
  }
  return map
}

// ── Treasury caching ──
const TREASURY_CACHE_KEY = 'treasury_batch'
const TREASURY_CACHE_TS_KEY = 'treasury_batch_ts'
const TREASURY_CACHE_TTL = 3600000 // 1 hour

/** Read cached treasury data from localStorage (instant, no network). */
export function getCachedTreasury(): TreasuryAgg[] {
  try {
    const cached = localStorage.getItem(TREASURY_CACHE_KEY)
    const ts = localStorage.getItem(TREASURY_CACHE_TS_KEY)
    if (cached && ts && Date.now() - Number(ts) < TREASURY_CACHE_TTL) {
      return JSON.parse(cached)
    }
  } catch { /* localStorage unavailable or corrupt */ }
  return []
}

// Known protocols with treasury data on DefiLlama (use base slug, not perp variant)
const TREASURY_SLUGS = new Set([
  'gmx', 'synthetix', 'dydx', 'gains-network', 'jupiter', 'vertex-protocol',
  'drift', 'aevo', 'kwenta', 'perpetual-protocol', 'level-finance',
  'mux-protocol', 'rabbitx', 'bluefin',
])

function getBaseTreasurySlug(slug: string): string | null {
  const lower = slug?.toLowerCase() || ''
  if (TREASURY_SLUGS.has(lower)) return lower
  // Strip perp-specific suffixes to find the base protocol
  const stripped = lower.replace(/-(perps?|perpetuals?|v\d+(-perps?)?|trade|exchange|pro|omni|digital)$/i, '').trim()
  if (stripped !== lower && TREASURY_SLUGS.has(stripped)) return stripped
  return null
}

// Batch-fetch treasury data for top token exchanges (Phase 2 lazy load)
export async function fetchTreasuryBatch(exchanges: EnrichedExchange[]): Promise<TreasuryAgg[]> {
  // Only attempt for protocols known to have treasury data, deduplicate base slugs
  const seen = new Set<string>()
  const candidates: { ex: EnrichedExchange; treasurySlug: string }[] = []
  for (const ex of exchanges) {
    if (!ex.hasToken) continue
    const ts = getBaseTreasurySlug(ex.slug)
    if (ts && !seen.has(ts)) {
      seen.add(ts)
      candidates.push({ ex, treasurySlug: ts })
    }
    if (candidates.length >= 20) break
  }

  const results = await Promise.all(
    candidates.map(async ({ ex, treasurySlug }) => {
      const raw = await fetchTreasury(treasurySlug).catch(() => null)
      if (!raw) return null
      const ownTokens = raw.ownTokens || 0
      const stablecoins = raw.stablecoins || 0
      const majors = raw.majors || 0
      const others = raw.others || 0
      const totalUsd = ownTokens + stablecoins + majors + others
      if (totalUsd <= 0 && !raw.tvl) return null
      return {
        slug: ex.slug,
        name: ex.displayName || ex.name,
        totalUsd: totalUsd || raw.tvl || 0,
        ownTokenUsd: ownTokens,
        stablecoinsUsd: stablecoins,
        majorsUsd: majors,
        othersUsd: others,
        warChestRatio: ex.mcap && ex.mcap > 0 ? (stablecoins + majors) / ex.mcap : null,
      } as TreasuryAgg
    })
  )
  const fresh = results.filter(Boolean) as TreasuryAgg[]

  // Persist to localStorage for instant display on next visit
  if (fresh.length > 0) {
    try {
      localStorage.setItem(TREASURY_CACHE_KEY, JSON.stringify(fresh))
      localStorage.setItem(TREASURY_CACHE_TS_KEY, String(Date.now()))
    } catch { /* quota exceeded */ }
  }

  return fresh
}

// ── Historical fee data for perp revenue charts (Phase 2 lazy load) ──

interface FeeOverviewFull {
  totalDataChart: [number, number][]
  totalDataChartBreakdown: [number, Record<string, Record<string, number> | number>][]
  protocols: Array<{ name: string; slug: string; category?: string }>
  total24h: number
}

const FEE_HISTORY_CACHE_KEY = 'fee_history'
const FEE_HISTORY_CACHE_TS_KEY = 'fee_history_ts'
const FEE_HISTORY_CACHE_TTL = 3600000 // 1 hour

export function getCachedFeeHistory(): {
  perpFeeBreakdown: FeeSharePoint[]
  perpFeeBreakdownNames: string[]
  perpFeeShareHistory: PerpFeeSharePoint[]
} {
  try {
    const cached = localStorage.getItem(FEE_HISTORY_CACHE_KEY)
    const ts = localStorage.getItem(FEE_HISTORY_CACHE_TS_KEY)
    if (cached && ts && Date.now() - Number(ts) < FEE_HISTORY_CACHE_TTL) {
      return JSON.parse(cached)
    }
  } catch { /* localStorage unavailable or corrupt */ }
  return { perpFeeBreakdown: [], perpFeeBreakdownNames: [], perpFeeShareHistory: [] }
}

export async function fetchHistoricalFeeData(
  perpSlugs: Set<string>,
): Promise<{
  perpFeeBreakdown: FeeSharePoint[]
  perpFeeBreakdownNames: string[]
  perpFeeShareHistory: PerpFeeSharePoint[]
}> {
  const empty = { perpFeeBreakdown: [] as FeeSharePoint[], perpFeeBreakdownNames: [] as string[], perpFeeShareHistory: [] as PerpFeeSharePoint[] }

  try {
    // Fetch full fee overview WITH historical chart data
    const feeData = await fetchJSON<FeeOverviewFull>(
      `${LLAMA_BASE}/overview/fees`
    )

    const chartRaw = feeData.totalDataChart || []
    const breakdownRaw = feeData.totalDataChartBreakdown || []

    if (chartRaw.length === 0) return empty

    // Build set of perp protocol names (lowercase) from the fee protocols list
    const perpNameSet = new Set<string>()
    for (const p of feeData.protocols) {
      const slug = p.slug?.toLowerCase() || ''
      const name = p.name?.toLowerCase() || ''
      if (perpSlugs.has(slug) || perpSlugs.has(name)) {
        perpNameSet.add(p.name)
      }
    }

    // Filter to data from 2022 onwards, sample monthly
    const startTs = new Date('2022-01-01').getTime() / 1000

    // ── Chart 2: Perps % of total DeFi fees (use totalDataChart + breakdown) ──
    // Build a map of timestamp → perp fees from breakdown
    const perpFeesMap = new Map<number, number>()
    for (const [ts, breakdown] of breakdownRaw) {
      if (ts < startTs) continue
      let perpTotal = 0
      for (const [name, chains] of Object.entries(breakdown)) {
        if (!perpNameSet.has(name)) continue
        const val = typeof chains === 'number'
          ? chains
          : Object.values(chains).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
        perpTotal += val
      }
      perpFeesMap.set(ts, perpTotal)
    }

    // Monthly sample for the time series
    const perpFeeShareHistory: PerpFeeSharePoint[] = []
    const monthBuckets = new Map<string, { perpFees: number; totalFees: number; ts: number }>()

    for (const [ts, totalFees] of chartRaw) {
      if (ts < startTs || totalFees <= 0) continue
      const d = new Date(ts * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      const existing = monthBuckets.get(key)
      const perpFees = perpFeesMap.get(ts) || 0
      if (!existing) {
        monthBuckets.set(key, { perpFees, totalFees, ts })
      } else {
        existing.perpFees += perpFees
        existing.totalFees += totalFees
      }
    }

    for (const [, bucket] of [...monthBuckets.entries()].sort((a, b) => a[1].ts - b[1].ts)) {
      perpFeeShareHistory.push({
        date: bucket.ts * 1000,
        perpFees: bucket.perpFees,
        totalFees: bucket.totalFees,
        perpShare: bucket.totalFees > 0 ? (bucket.perpFees / bucket.totalFees) * 100 : 0,
      })
    }

    // ── Chart 1: Per-protocol revenue breakdown (top 8 perp protocols + Other) ──
    // Aggregate monthly fees per perp protocol
    const protocolMonthlyFees = new Map<string, Map<string, number>>() // monthKey → { protocolName → fees }
    const protocolTotals = new Map<string, number>() // protocolName → total fees

    for (const [ts, breakdown] of breakdownRaw) {
      if (ts < startTs) continue
      const d = new Date(ts * 1000)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`

      for (const [name, chains] of Object.entries(breakdown)) {
        if (!perpNameSet.has(name)) continue
        const val = typeof chains === 'number'
          ? chains
          : Object.values(chains).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
        if (val <= 0) continue

        if (!protocolMonthlyFees.has(monthKey)) protocolMonthlyFees.set(monthKey, new Map())
        const month = protocolMonthlyFees.get(monthKey)!
        month.set(name, (month.get(name) || 0) + val)

        protocolTotals.set(name, (protocolTotals.get(name) || 0) + val)
      }
    }

    // Top 8 protocols by total fees
    const topProtocols = [...protocolTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)
    const perpFeeBreakdownNames = [...topProtocols, 'Other']

    // Build chart data points
    const sortedMonths = [...protocolMonthlyFees.keys()].sort()
    const perpFeeBreakdown: FeeSharePoint[] = sortedMonths.map(monthKey => {
      const monthData = protocolMonthlyFees.get(monthKey)!
      const [year, month] = monthKey.split('-').map(Number)
      const date = new Date(year, month, 1).getTime()

      // Total perp fees this month
      let totalPerpFees = 0
      for (const val of monthData.values()) totalPerpFees += val

      if (totalPerpFees === 0) {
        const point: FeeSharePoint = { date }
        for (const n of perpFeeBreakdownNames) point[n] = 0
        return point
      }

      const point: FeeSharePoint = { date }
      let otherPct = 100
      for (const name of topProtocols) {
        const pct = ((monthData.get(name) || 0) / totalPerpFees) * 100
        point[name] = Math.round(pct * 100) / 100
        otherPct -= point[name]
      }
      point['Other'] = Math.max(0, Math.round(otherPct * 100) / 100)
      return point
    })

    const result = { perpFeeBreakdown, perpFeeBreakdownNames, perpFeeShareHistory }

    // Cache for instant loading next visit
    try {
      localStorage.setItem(FEE_HISTORY_CACHE_KEY, JSON.stringify(result))
      localStorage.setItem(FEE_HISTORY_CACHE_TS_KEY, String(Date.now()))
    } catch { /* quota exceeded */ }

    return result
  } catch {
    return empty
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

// Known Solana-native perp protocols (lowercase for matching)
const SOLANA_PERP_PROTOCOLS = new Set([
  'drift', 'drift protocol', 'drift-protocol',
  'jupiter perps', 'jupiter-perps',
  'flash trade', 'flash-trade',
  'zeta', 'zeta markets', 'zeta-markets',
  'adrena', 'adrena-protocol',
  'backpack',
  'mango', 'mango markets', 'mango-markets',
  'parcl',
  'phoenix',
  'hxro',
  '01', 'cypher',
  'orderly network', 'orderly-network',
  'goosefx',
  'surfx',
])

function isSolanaPerp(name: string): boolean {
  const lower = name.toLowerCase().trim()
  if (SOLANA_PERP_PROTOCOLS.has(lower)) return true
  for (const known of SOLANA_PERP_PROTOCOLS) {
    if (lower.startsWith(known)) return true
  }
  return false
}

// Solana chain growth — tracks Solana's share of DEX perp volume over time
export async function fetchSolanaChainGrowth(): Promise<import('../types').SolanaGrowthPoint[]> {
  try {
    const overview = await fetchDerivativesOverview(false)
    const breakdownRaw = overview.totalDataChartBreakdown || []
    const sampled = breakdownRaw.filter((_, i) => i % 7 === 0 || i === breakdownRaw.length - 1)

    return sampled.map(([timestamp, breakdown]) => {
      let solanaVol = 0
      let totalDexVol = 0

      for (const [name, chains] of Object.entries(breakdown)) {
        if (classifyVenue(name) !== 'defi') continue

        // Handle both shapes: flat number or { chain: volume } object
        const vol = typeof chains === 'number'
          ? chains
          : Object.values(chains as Record<string, number>).reduce((s, v) => s + (Number(v) || 0), 0)

        totalDexVol += vol

        // Check by protocol name first (covers flat-number entries)
        if (isSolanaPerp(name)) {
          solanaVol += vol
        } else if (typeof chains !== 'number') {
          // For multi-chain protocols, add only their Solana chain volume
          const chainEntries = chains as Record<string, number>
          const solVol = chainEntries['Solana'] || 0
          if (solVol > 0) solanaVol += solVol
        }
      }

      return {
        date: timestamp * 1000,
        solanaVol,
        totalDexVol,
        solanaPct: totalDexVol > 0 ? (solanaVol / totalDexVol) * 100 : 0,
      }
    })
  } catch {
    return []
  }
}

export interface BuilderVolumePoint {
  date: number
  [builder: string]: number
}

/**
 * Extract per-builder volume on Hyperliquid chain from derivatives overview breakdown.
 * Returns weekly-sampled data with top builders + "Other" bucket.
 */
interface HLBuilderResult {
  data: BuilderVolumePoint[]
  builders: string[]
  builderSharePct: Array<{ date: number; pct: number }>
  cumulativeIncome: Array<{ date: number; income: number }>
}

export async function fetchHLBuilderVolume(): Promise<HLBuilderResult> {
  const empty: HLBuilderResult = { data: [], builders: [], builderSharePct: [], cumulativeIncome: [] }
  try {
    const overview = await fetchDerivativesOverview(false)
    const breakdownRaw = overview.totalDataChartBreakdown || []

    // Sample weekly for performance
    const sampled = breakdownRaw.filter((_, i) => i % 7 === 0 || i === breakdownRaw.length - 1)

    // First pass: aggregate total volume per builder on HL chain to find top builders
    const builderTotals = new Map<string, number>()
    for (const [, breakdown] of sampled) {
      for (const [protocolName, chains] of Object.entries(breakdown)) {
        if (typeof chains === 'number') continue
        const hlVol = chains['Hyperliquid L1'] || chains['Hyperliquid'] || chains['hyperliquid'] || 0
        if (hlVol <= 0) continue
        const nameLower = protocolName.toLowerCase()
        if (nameLower === 'hyperliquid' || nameLower === 'hyperliquid perps' || nameLower === 'hyperliquid-perps') continue
        builderTotals.set(protocolName, (builderTotals.get(protocolName) || 0) + hlVol)
      }
    }

    if (builderTotals.size === 0) return empty

    // Top 8 builders by total volume
    const sorted = [...builderTotals.entries()].sort((a, b) => b[1] - a[1])
    const topBuilders = sorted.slice(0, 8).map(([name]) => name)
    let hasOther = false

    // Second pass: build time series + compute share % and cumulative income
    const data: BuilderVolumePoint[] = []
    const builderSharePct: Array<{ date: number; pct: number }> = []
    const cumulativeIncome: Array<{ date: number; income: number }> = []
    let runningIncome = 0

    for (const [timestamp, breakdown] of sampled) {
      const point: BuilderVolumePoint = { date: timestamp * 1000 }
      let totalBuilderVol = 0
      let otherVol = 0
      let hlNativeVol = 0

      for (const [protocolName, chains] of Object.entries(breakdown)) {
        if (typeof chains === 'number') continue
        const hlVol = chains['Hyperliquid L1'] || chains['Hyperliquid'] || chains['hyperliquid'] || 0
        if (hlVol <= 0) continue
        const nameLower = protocolName.toLowerCase()

        // HL's own native volume
        if (nameLower === 'hyperliquid' || nameLower === 'hyperliquid perps' || nameLower === 'hyperliquid-perps') {
          hlNativeVol += hlVol
          continue
        }

        totalBuilderVol += hlVol
        if (topBuilders.includes(protocolName)) {
          point[protocolName] = hlVol
        } else {
          otherVol += hlVol
        }
      }

      for (const b of topBuilders) {
        if (point[b] == null) point[b] = 0
      }
      if (otherVol > 0) {
        point['Other'] = otherVol
        hasOther = true
      }

      data.push(point)

      // Builder share of total HL volume (builder + native)
      const totalHlVol = totalBuilderVol + hlNativeVol
      if (totalHlVol > 0) {
        builderSharePct.push({ date: timestamp * 1000, pct: (totalBuilderVol / totalHlVol) * 100 })
      }

      // Cumulative estimated income at ~1bp referral rate
      runningIncome += totalBuilderVol * 0.0001
      cumulativeIncome.push({ date: timestamp * 1000, income: runningIncome })
    }

    const builders = hasOther ? [...topBuilders, 'Other'] : topBuilders
    return { data, builders, builderSharePct, cumulativeIncome }
  } catch {
    return empty
  }
}
