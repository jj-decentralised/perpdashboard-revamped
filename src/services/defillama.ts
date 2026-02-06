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
import { fetchCGDerivativesExchanges, fetchCGDerivativesTickers, fetchBTCPrice, fetchTopTokenPrices } from './coingecko'
import { buildCGExchangeMap, matchCGExchange } from '../utils/merge'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)
  return res.json()
}

export async function fetchDerivativesOverview(): Promise<DexOverview> {
  return fetchJSON<DexOverview>(
    `${LLAMA_BASE}/overview/derivatives`
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

export async function fetchDashboardData(): Promise<DashboardData> {
  const [derivativesOverview, protocols, feeOverview, cgExchanges, btcPrice, cgTickers] = await Promise.all([
    fetchDerivativesOverview(),
    fetchProtocols(),
    fetchFeeOverview(),
    fetchCGDerivativesExchanges(),
    fetchBTCPrice(),
    fetchCGDerivativesTickers(),
  ])

  // Build protocol lookup
  const protocolMap = new Map<string, ProtocolInfo>()
  const derivativeProtocols = protocols.filter(
    (p) => p.category === 'Derivatives' || p.category === 'Dexes' || p.category === 'Dexs'
  )
  for (const p of derivativeProtocols) {
    protocolMap.set(p.name.toLowerCase(), p)
    protocolMap.set(p.slug.toLowerCase(), p)
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

  let totalOpenInterest = 0

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
    const tvl = protInfo?.tvl || 0
    const vol24 = dex.total24h || 0
    const mcap = protInfo?.mcap || null

    const oiBtc = cgMatch?.open_interest_btc || 0
    const openInterest = oiBtc * btcPrice
    totalOpenInterest += openInterest

    const perpPairsCount = cgMatch?.number_of_perpetual_pairs ?? null
    const futuresPairsCount = cgMatch?.number_of_futures_pairs ?? null

    const fees24h = feeInfo?.total24h || 0
    const revenue24h = (feeInfo as any)?.revenue24h || fees24h * 0.3
    const annualizedFees = fees24h > 0 ? fees24h * 365 : null
    const annualizedRevenue = revenue24h > 0 ? revenue24h * 365 : null
    const peRatio = mcap && annualizedRevenue && annualizedRevenue > 0 ? mcap / annualizedRevenue : null
    const psRatio = mcap && annualizedFees && annualizedFees > 0 ? mcap / annualizedFees : null

    return {
      ...dex,
      hasToken,
      tokenSymbol: hasToken ? protInfo!.symbol : null,
      geckoId: protInfo?.gecko_id || null,
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
      peRatio,
      psRatio,
    }
  })

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

  // Process breakdown data for market share over time
  const topExchangeNames = enrichedExchanges.slice(0, 8).map((e) => e.name)
  const breakdownRaw = derivativesOverview.totalDataChartBreakdown || []

  // Sample every 7th point for performance (weekly resolution)
  const sampled = breakdownRaw.filter((_, i) => i % 7 === 0 || i === breakdownRaw.length - 1)

  const volumeShareHistory = sampled.map(([timestamp, breakdown]) => {
    const point: VolumeSharePoint = { date: timestamp * 1000 }

    // Sum all exchange volumes for this day
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
      for (const name of topExchangeNames) point[name] = 0
      point['Other'] = 0
      return point
    }

    let otherPct = 100
    for (const name of topExchangeNames) {
      const pct = ((exchangeVolumes[name] || 0) / totalDayVolume) * 100
      point[name] = Math.round(pct * 100) / 100
      otherPct -= point[name]
    }
    point['Other'] = Math.max(0, Math.round(otherPct * 100) / 100)

    return point
  })

  const geckoIds = tokenExchanges
    .filter((e) => e.geckoId)
    .slice(0, 30)
    .map((e) => e.geckoId!)

  const topTokenPrices = await fetchTopTokenPrices(geckoIds)

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
    volumeShareHistory,
    topExchangeNames,
  }
}
