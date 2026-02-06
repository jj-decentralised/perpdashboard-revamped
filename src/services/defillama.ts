import type {
  DexOverview,
  FeeOverview,
  ProtocolInfo,
  EnrichedExchange,
  TokenGroupStats,
  HistoricalDataPoint,
  DashboardData,
  CoinGeckoMarketData,
} from '../types'

const LLAMA_BASE = 'https://api.llama.fi'
const GECKO_BASE = 'https://api.coingecko.com/api/v3'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)
  return res.json()
}

export async function fetchDexOverview(): Promise<DexOverview> {
  return fetchJSON<DexOverview>(
    `${LLAMA_BASE}/overview/dexs?excludeTotalDataChartBreakdown=true`
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

export async function fetchTopTokenPrices(
  geckoIds: string[]
): Promise<CoinGeckoMarketData[]> {
  if (geckoIds.length === 0) return []
  const ids = geckoIds.slice(0, 50).join(',')
  try {
    return await fetchJSON<CoinGeckoMarketData[]>(
      `${GECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d,30d`
    )
  } catch {
    return []
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
    exchanges,
  }
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [dexOverview, protocols, feeOverview] = await Promise.all([
    fetchDexOverview(),
    fetchProtocols(),
    fetchFeeOverview(),
  ])

  // Build protocol lookup by name (lowercase)
  const protocolMap = new Map<string, ProtocolInfo>()
  const dexProtocols = protocols.filter(
    (p) => p.category === 'Dexes' || p.category === 'Dexs'
  )
  for (const p of dexProtocols) {
    protocolMap.set(p.name.toLowerCase(), p)
    protocolMap.set(p.slug.toLowerCase(), p)
  }

  // Build fee lookup
  const feeMap = new Map<string, (typeof feeOverview.protocols)[0]>()
  for (const f of (feeOverview.protocols || [])) {
    if (f.name) feeMap.set(f.name.toLowerCase(), f)
    if (f.slug) feeMap.set(f.slug.toLowerCase(), f)
  }

  // Filter to actual DEXes and enrich
  const dexOnly = (dexOverview.protocols || []).filter(
    (p) => p.category === 'Dexs' || p.category === 'Dexes'
  )

  const enrichedExchanges: EnrichedExchange[] = dexOnly.map((dex) => {
    const protInfo =
      protocolMap.get(dex.name.toLowerCase()) ||
      protocolMap.get(dex.slug?.toLowerCase())
    const feeInfo =
      feeMap.get(dex.name.toLowerCase()) ||
      feeMap.get(dex.slug?.toLowerCase())

    const hasToken = !!(
      protInfo &&
      protInfo.symbol &&
      protInfo.symbol !== '-' &&
      protInfo.symbol !== ''
    )
    const tvl = protInfo?.tvl || 0
    const vol24 = dex.total24h || 0

    return {
      ...dex,
      hasToken,
      tokenSymbol: hasToken ? protInfo!.symbol : null,
      geckoId: protInfo?.gecko_id || null,
      tvl,
      mcap: protInfo?.mcap || null,
      chainCount: dex.chains?.length || 1,
      volumeToTvl: tvl > 0 ? vol24 / tvl : null,
      feeData: feeInfo || undefined,
    }
  })

  // Sort by 24h volume
  enrichedExchanges.sort(
    (a, b) => (b.total24h || 0) - (a.total24h || 0)
  )

  const tokenExchanges = enrichedExchanges.filter((e) => e.hasToken)
  const noTokenExchanges = enrichedExchanges.filter((e) => !e.hasToken)

  const tokenGroup = buildGroupStats('With Token', tokenExchanges)
  const noTokenGroup = buildGroupStats('Without Token', noTokenExchanges)

  // Parse historical volume
  const historicalVolume: HistoricalDataPoint[] = (
    dexOverview.totalDataChart || []
  ).map(([date, value]) => ({ date: date * 1000, value }))

  // Get gecko IDs for top token exchanges
  const geckoIds = tokenExchanges
    .filter((e) => e.geckoId)
    .slice(0, 30)
    .map((e) => e.geckoId!)

  const topTokenPrices = await fetchTopTokenPrices(geckoIds)

  return {
    dexOverview,
    protocols: dexProtocols,
    feeOverview,
    enrichedExchanges,
    tokenGroup,
    noTokenGroup,
    historicalVolume,
    topTokenPrices,
  }
}
