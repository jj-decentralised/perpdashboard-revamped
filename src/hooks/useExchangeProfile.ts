import { useState, useEffect, useRef } from 'react'
import type { ExchangeProfileData, TokenInfo, HistoricalPEPoint, QuarterlyData, TreasuryInfo, ComparableExchange, HoldersRevenueData, MarketSharePoint, BuilderVolumeData } from '../types/profile'
import type { HistoricalDataPoint, EnrichedExchange } from '../types'
import { fetchDerivativesSummary, fetchExchangeVolumeFromOverview, fetchFeeSummary, fetchRevenueSummary, fetchTreasury, fetchHoldersRevenueSummary, fetchDerivativesOverview, fetchFeeOverview, fetchHLBuilderVolume, SLUG_TO_GECKO_TOKEN, getBaseTreasurySlug } from '../services/defillama'
import { fetchCGExchangeDetail, fetchCGDerivativesExchanges, fetchCoinMarketChart, fetchCoinDetail, fetchCachedCoinsList, fetchCoinMarkets, fetchBTCPrice } from '../services/coingecko'
import type { CoinListEntry } from '../services/coingecko'
import { buildCGExchangeMap, matchCGExchange } from '../utils/merge'

interface UseExchangeProfileReturn {
  data: ExchangeProfileData | null
  loading: boolean
  error: string | null
}

function buildTokenInfo(coinData: any): TokenInfo | null {
  if (!coinData?.market_data) return null
  const md = coinData.market_data
  return {
    symbol: (coinData.symbol || '').toUpperCase(),
    name: coinData.name || '',
    currentPrice: md.current_price?.usd || 0,
    marketCap: md.market_cap?.usd || 0,
    fdv: md.fully_diluted_valuation?.usd || 0,
    circulatingSupply: md.circulating_supply || 0,
    totalSupply: md.total_supply || 0,
    maxSupply: md.max_supply || null,
    priceChange24h: md.price_change_percentage_24h || 0,
    priceChange7d: md.price_change_percentage_7d || 0,
    priceChange30d: md.price_change_percentage_30d || 0,
    ath: md.ath?.usd || 0,
    athDate: md.ath_date?.usd || '',
    atl: md.atl?.usd || 0,
    atlDate: md.atl_date?.usd || '',
  }
}

function buildHistoricalPE(
  mcapHistory: [number, number][],
  feeHistory: HistoricalDataPoint[],
  revenueHistory: HistoricalDataPoint[],
  priceHistory: [number, number][]
): HistoricalPEPoint[] {
  if (mcapHistory.length === 0) return []

  // Build fee/revenue lookup by date (rounded to day)
  const feeMap = new Map<number, number>()
  for (const f of feeHistory) {
    const dayKey = Math.floor(f.date / 86400000) * 86400000
    feeMap.set(dayKey, f.value)
  }
  const revMap = new Map<number, number>()
  for (const r of revenueHistory) {
    const dayKey = Math.floor(r.date / 86400000) * 86400000
    revMap.set(dayKey, r.value)
  }

  // Build price lookup
  const priceMap = new Map<number, number>()
  for (const [ts, price] of priceHistory) {
    const dayKey = Math.floor(ts / 86400000) * 86400000
    priceMap.set(dayKey, price)
  }

  // Sample weekly for performance
  const sampled = mcapHistory.filter((_, i) => i % 7 === 0 || i === mcapHistory.length - 1)

  return sampled
    .map(([ts, mcap]) => {
      const dayKey = Math.floor(ts / 86400000) * 86400000
      const dailyFee = feeMap.get(dayKey) || 0
      const dailyRev = revMap.get(dayKey) || 0
      const price = priceMap.get(dayKey) || 0

      const annualizedFees = dailyFee * 365
      const annualizedRev = dailyRev > 0 ? dailyRev * 365 : annualizedFees * 0.3

      return {
        date: ts,
        pe: mcap > 0 && annualizedRev > 0 ? mcap / annualizedRev : null,
        ps: mcap > 0 && annualizedFees > 0 ? mcap / annualizedFees : null,
        price,
        mcap,
      }
    })
    .filter((p) => p.mcap > 0)
}

function buildQuarterlyData(
  volumeHistory: HistoricalDataPoint[],
  feeHistory: HistoricalDataPoint[]
): QuarterlyData[] {
  if (volumeHistory.length === 0) return []

  const feeMap = new Map<number, number>()
  for (const f of feeHistory) {
    const dayKey = Math.floor(f.date / 86400000) * 86400000
    feeMap.set(dayKey, f.value)
  }

  // Group by quarter
  const quarters = new Map<string, { volumes: number[]; fees: number[] }>()

  for (const point of volumeHistory) {
    const d = new Date(point.date)
    const q = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    if (!quarters.has(q)) quarters.set(q, { volumes: [], fees: [] })
    const bucket = quarters.get(q)!
    bucket.volumes.push(point.value)
    const dayKey = Math.floor(point.date / 86400000) * 86400000
    bucket.fees.push(feeMap.get(dayKey) || 0)
  }

  const result: QuarterlyData[] = []
  let prevVolume: number | null = null

  for (const [quarter, { volumes, fees }] of quarters) {
    const totalVolume = volumes.reduce((s, v) => s + v, 0)
    const totalFees = fees.reduce((s, v) => s + v, 0)
    const growthVsLast = prevVolume != null && prevVolume > 0
      ? ((totalVolume - prevVolume) / prevVolume) * 100
      : null

    result.push({
      quarter,
      totalVolume,
      avgDailyVolume: volumes.length > 0 ? totalVolume / volumes.length : 0,
      totalFees,
      estimatedRevenue: totalFees * 0.3,
      peakDailyVolume: Math.max(...volumes),
      growthVsLast,
    })

    prevVolume = totalVolume
  }

  return result
}

function buildTreasury(treasuryData: any): TreasuryInfo | null {
  if (!treasuryData) return null

  // DefiLlama treasury format: { id, name, tokenBreakdowns, ownTokens, stablecoins, majors, others }
  const ownToken = treasuryData.ownTokens || treasuryData.ownTokenTreasury || 0
  const stablecoins = treasuryData.stablecoins || 0
  const majors = treasuryData.majors || 0
  const others = treasuryData.others || 0
  const total = ownToken + stablecoins + majors + others

  if (total === 0) {
    // Try alternative structure
    if (treasuryData.tvl != null) {
      return {
        totalUsd: treasuryData.tvl,
        ownTokenUsd: 0,
        stablecoinsUsd: 0,
        majorsUsd: 0,
        othersUsd: treasuryData.tvl,
      }
    }
    return null
  }

  return {
    totalUsd: total,
    ownTokenUsd: ownToken,
    stablecoinsUsd: stablecoins,
    majorsUsd: majors,
    othersUsd: others,
  }
}

// Resolve geckoId for a comparable exchange slug
function resolveCompGeckoId(compSlug: string): string | null {
  const s = compSlug?.toLowerCase() || ''
  if (SLUG_TO_GECKO_TOKEN[s]) return SLUG_TO_GECKO_TOKEN[s]
  const stripped = s.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
  if (stripped !== s && SLUG_TO_GECKO_TOKEN[stripped]) return SLUG_TO_GECKO_TOKEN[stripped]
  return null
}

function buildComparables(
  slug: string,
  chains: string[],
  volume24h: number,
  mcap: number | null,
  allProtocols: any[],
  feeMap: Map<string, any>,
  mcapMap: Map<string, number>
): ComparableExchange[] {
  const comparables: ComparableExchange[] = []
  const chainsSet = new Set(chains.map((c) => c.toLowerCase()))

  for (const dex of allProtocols) {
    if ((dex.slug || dex.name)?.toLowerCase() === slug?.toLowerCase()) continue
    if (!dex.total24h || dex.total24h <= 0) continue

    const reasons: string[] = []

    // Same chain match
    const dexChains = (dex.chains || []).map((c: string) => c.toLowerCase())
    const sharedChains = dexChains.filter((c: string) => chainsSet.has(c))
    if (sharedChains.length > 0) reasons.push(`Same chain: ${sharedChains.join(', ')}`)

    // Similar volume (0.3x to 3x)
    if (volume24h > 0) {
      const ratio = dex.total24h / volume24h
      if (ratio >= 0.3 && ratio <= 3) reasons.push('Similar volume')
    }

    // Resolve token + mcap for this comparable
    const compGeckoId = resolveCompGeckoId(dex.slug)
    const dexMcap = compGeckoId ? (mcapMap.get(compGeckoId) || null) : null
    const hasToken = !!compGeckoId

    // Similar valuation
    if (mcap && dexMcap && mcap > 0) {
      const valRatio = dexMcap / mcap
      if (valRatio >= 0.2 && valRatio <= 5) reasons.push('Similar valuation')
    }

    if (reasons.length === 0) continue

    const feeInfo = feeMap.get(dex.name?.toLowerCase()) || feeMap.get(dex.slug?.toLowerCase())
    const fees24h = feeInfo?.total24h || 0

    const annualFees = fees24h * 365
    const annualRev = annualFees * 0.3

    // Derive token symbol from geckoId slug (best effort)
    let tokenSymbol: string | null = null
    if (hasToken && compGeckoId) {
      // Use the fee/protocol info if available, otherwise derive from slug
      tokenSymbol = feeInfo?.tokenSymbol || null
    }

    comparables.push({
      name: dex.displayName || dex.name,
      slug: dex.slug || '',
      volume24h: dex.total24h,
      openInterest: 0,
      chains: dex.chains || [],
      hasToken,
      tokenSymbol,
      mcap: dexMcap,
      peRatio: dexMcap && annualRev > 0 ? dexMcap / annualRev : null,
      psRatio: dexMcap && annualFees > 0 ? dexMcap / annualFees : null,
      change1d: dex.change_1d ?? null,
      matchReason: reasons.join(' · '),
    })
  }

  // Sort by number of match reasons, then by volume
  comparables.sort((a, b) => {
    const aReasons = a.matchReason.split(' · ').length
    const bReasons = b.matchReason.split(' · ').length
    if (bReasons !== aReasons) return bReasons - aReasons
    return b.volume24h - a.volume24h
  })

  return comparables.slice(0, 10)
}

function buildMarketShareHistory(
  exchangeVolume: HistoricalDataPoint[],
  marketTotalChart: [number, number][],
  hlChart: [number, number][],
  isHyperliquid: boolean
): MarketSharePoint[] {
  if (exchangeVolume.length === 0 || marketTotalChart.length === 0) return []

  // Build lookup maps by day key (ms)
  const marketMap = new Map<number, number>()
  for (const [ts, vol] of marketTotalChart) {
    const dayKey = Math.floor((ts * 1000) / 86400000) * 86400000
    marketMap.set(dayKey, vol)
  }

  const hlMap = new Map<number, number>()
  if (!isHyperliquid) {
    for (const [ts, vol] of hlChart) {
      const dayKey = Math.floor((ts * 1000) / 86400000) * 86400000
      hlMap.set(dayKey, vol)
    }
  }

  // Compute raw daily share
  const raw: { date: number; marketPct: number; hlPct: number | null }[] = []
  for (const point of exchangeVolume) {
    const dayKey = Math.floor(point.date / 86400000) * 86400000
    const marketVol = marketMap.get(dayKey)
    if (!marketVol || marketVol <= 0) continue

    const marketPct = (point.value / marketVol) * 100

    let hlPct: number | null = null
    if (!isHyperliquid) {
      const hlVol = hlMap.get(dayKey)
      if (hlVol && hlVol > 0) {
        hlPct = (point.value / hlVol) * 100
      }
    }

    raw.push({ date: point.date, marketPct, hlPct })
  }

  if (raw.length < 7) return raw

  // 7-day rolling average for smoothing
  const smoothed: MarketSharePoint[] = []
  for (let i = 6; i < raw.length; i++) {
    let sumMarket = 0
    let sumHl = 0
    let hlCount = 0
    for (let j = i - 6; j <= i; j++) {
      sumMarket += raw[j].marketPct
      if (raw[j].hlPct != null) {
        sumHl += raw[j].hlPct!
        hlCount++
      }
    }
    smoothed.push({
      date: raw[i].date,
      marketPct: sumMarket / 7,
      hlPct: hlCount > 0 ? sumHl / hlCount : null,
    })
  }

  return smoothed
}

export function useExchangeProfile(
  slug: string | undefined,
  cgId: string | null
): UseExchangeProfileReturn {
  const [data, setData] = useState<ExchangeProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) return
    if (fetchedRef.current === slug) return
    fetchedRef.current = slug

    let cancelled = false

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setError('Request timed out — this exchange may not exist or the data source is unavailable.')
        setLoading(false)
        cancelled = true
      }
    }, 15000)

    async function load() {
      try {
        setLoading(true)
        setError(null)

        // Phase 1: Core data (parallel)
        // Use lightweight derivatives overview (excludeBreakdown) for comparables — saves ~7MB vs old approach
        const isHyperliquid = slug!.toLowerCase() === 'hyperliquid-perps'
        const treasurySlug = getBaseTreasurySlug(slug!)
        const [summary, cgDetailDirect, feeSummary, revenueSummary, treasuryData, holdersRevRaw, derivativesOverview, feeOverview, cgExchangesList, btcPrice, hlSummary] = await Promise.all([
          fetchDerivativesSummary(slug!).catch(() => null),
          cgId ? fetchCGExchangeDetail(cgId).catch(() => null) : Promise.resolve(null),
          fetchFeeSummary(slug!).catch(() => null),
          fetchRevenueSummary(slug!).catch(() => null),
          treasurySlug ? fetchTreasury(treasurySlug).catch(() => null) : Promise.resolve(null),
          fetchHoldersRevenueSummary(slug!).catch(() => null),
          fetchDerivativesOverview(true).catch(() => null),
          fetchFeeOverview().catch(() => null),
          !cgId ? fetchCGDerivativesExchanges().catch(() => []) : Promise.resolve([]),
          fetchBTCPrice().catch(() => 60000),
          !isHyperliquid ? fetchDerivativesSummary('hyperliquid-perps').catch(() => null) : Promise.resolve(null),
        ])

        if (cancelled) return

        // If no direct cgId, try to find matching CG exchange by name/slug
        let cgDetail = cgDetailDirect
        if (!cgDetail && cgExchangesList.length > 0) {
          const cgMap = buildCGExchangeMap(cgExchangesList)
          const exchangeName = summary?.name || slug || ''
          const matched = matchCGExchange(slug!, exchangeName, cgMap)
          if (matched) {
            cgDetail = await fetchCGExchangeDetail(matched.id).catch(() => null)
          }
        }

        // Historical volume — prefer Pro API summary, fallback to free overview breakdown
        let volumeChart = summary?.totalDataChart || []
        if (volumeChart.length === 0 && slug) {
          volumeChart = await fetchExchangeVolumeFromOverview(slug)
        }
        const historicalVolume: HistoricalDataPoint[] = volumeChart
          .filter((entry): entry is [number, number] => Array.isArray(entry) && entry.length === 2)
          .map(([date, value]) => ({ date: date * 1000, value }))

        const tickers = cgDetail?.tickers || []

        // Fee/revenue history
        const feeHistory: HistoricalDataPoint[] = (feeSummary?.totalDataChart || [])
          .filter((entry: any): entry is [number, number] => Array.isArray(entry) && entry.length === 2)
          .map(([date, value]: [number, number]) => ({ date: date * 1000, value }))

        const revenueHistory: HistoricalDataPoint[] = (revenueSummary?.totalDataChart || [])
          .filter((entry: any): entry is [number, number] => Array.isArray(entry) && entry.length === 2)
          .map(([date, value]: [number, number]) => ({ date: date * 1000, value }))

        // Phase 2: Resolve gecko token ID from multiple sources
        // Priority: 1) manual map (curated), 2) stripped slug map, 3) summary.gecko_id, 4) coins list
        const slugLower = slug!.toLowerCase()
        let geckoId: string | null = null

        // 1. Manual map — highest priority, curated and verified
        if (SLUG_TO_GECKO_TOKEN[slugLower]) {
          geckoId = SLUG_TO_GECKO_TOKEN[slugLower]
        }
        // 2. Stripped slug fallback (e.g. "drift-trade" → "drift", "bluefin-pro" → "bluefin")
        if (!geckoId) {
          const stripped = slugLower.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|defutures?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
          if (stripped !== slugLower && SLUG_TO_GECKO_TOKEN[stripped]) {
            geckoId = SLUG_TO_GECKO_TOKEN[stripped]
          }
        }
        // 3. DefiLlama summary gecko_id (sometimes wrong, so after manual map)
        if (!geckoId && summary?.gecko_id) {
          geckoId = summary.gecko_id
        }
        // 4. CoinGecko coins list — strict matching only (exact id or exact name)
        if (!geckoId) {
          try {
            const coinsList = await fetchCachedCoinsList()
            const exchangeName = (summary?.name || slug || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            // Only match on exact ID or exact normalized name (no substring matching)
            const match = coinsList.find((c: CoinListEntry) => {
              const coinName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '')
              return c.id.toLowerCase() === slugLower || coinName === exchangeName
            })
            if (match) geckoId = match.id
          } catch { /* coins list unavailable */ }
        }

        let tokenInfo: TokenInfo | null = null
        let priceHistory: [number, number][] = []
        let mcapHistory: [number, number][] = []

        if (geckoId) {
          const [coinDetail, marketChart] = await Promise.all([
            fetchCoinDetail(geckoId).catch(() => null),
            fetchCoinMarketChart(geckoId, 730).catch(() => ({ prices: [], market_caps: [] })),
          ])

          if (!cancelled) {
            tokenInfo = buildTokenInfo(coinDetail)
            priceHistory = marketChart.prices || []
            mcapHistory = marketChart.market_caps || []
          }
        }

        if (cancelled) return

        // Compute derived data
        const historicalPE = buildHistoricalPE(mcapHistory, feeHistory, revenueHistory, priceHistory)
        const quarterlyData = buildQuarterlyData(historicalVolume, feeHistory)
        const treasury = buildTreasury(treasuryData)

        // Build comparables with fee + mcap data
        const allDerivProtocols = derivativesOverview?.protocols || []
        const chains = summary?.chains || []
        const vol24h = allDerivProtocols.find(
          (p: any) => p.slug?.toLowerCase() === slug!.toLowerCase() || p.name?.toLowerCase() === slug!.toLowerCase()
        )?.total24h || 0
        const currentMcap = tokenInfo?.marketCap || null

        // Build fee lookup from fee overview
        const compFeeMap = new Map<string, any>()
        for (const f of feeOverview?.protocols || []) {
          if (f.name) compFeeMap.set(f.name.toLowerCase(), f)
          if (f.slug) compFeeMap.set(f.slug.toLowerCase(), f)
        }

        // Collect geckoIds from comparable candidates so we can batch-fetch mcap
        const compGeckoIds = new Set<string>()
        for (const dex of allDerivProtocols) {
          if ((dex.slug || dex.name)?.toLowerCase() === slug!.toLowerCase()) continue
          if (!dex.total24h || dex.total24h <= 0) continue
          const gid = resolveCompGeckoId(dex.slug)
          if (gid) compGeckoIds.add(gid)
        }
        // Also include main exchange's geckoId (already fetched)
        if (geckoId) compGeckoIds.delete(geckoId) // don't re-fetch

        // Batch fetch mcap for comparable exchanges
        const compMarketData = compGeckoIds.size > 0
          ? await fetchCoinMarkets([...compGeckoIds]).catch(() => [])
          : []

        // Build geckoId → mcap lookup (include main exchange's mcap too)
        const compMcapMap = new Map<string, number>()
        for (const coin of compMarketData) {
          if (coin.market_cap > 0) compMcapMap.set(coin.id, coin.market_cap)
        }
        if (geckoId && tokenInfo?.marketCap) compMcapMap.set(geckoId, tokenInfo.marketCap)

        const comparables = buildComparables(
          slug!,
          chains,
          vol24h,
          currentMcap,
          allDerivProtocols,
          compFeeMap,
          compMcapMap
        )

        // Build holders revenue data
        let holdersRevenue: HoldersRevenueData | null = null
        if (holdersRevRaw) {
          const hrChart: HistoricalDataPoint[] = (holdersRevRaw.totalDataChart || [])
            .filter((entry: any): entry is [number, number] => Array.isArray(entry) && entry.length === 2)
            .map(([date, value]: [number, number]) => ({ date: date * 1000, value }))
          const hrDaily = holdersRevRaw.total24h ?? null
          const hrTotal30d = holdersRevRaw.total30d ?? null
          if (hrDaily != null || hrChart.length > 0) {
            holdersRevenue = { daily: hrDaily, total30d: hrTotal30d, history: hrChart }
          }
        }

        // Compute market share history (7-day rolling average)
        const marketShareHistory = buildMarketShareHistory(
          historicalVolume,
          derivativesOverview?.totalDataChart || [],
          hlSummary?.totalDataChart || [],
          isHyperliquid
        )

        // Builder volume data — only for Hyperliquid, fetched lazily after initial render
        let builderVolume: BuilderVolumeData | null = null

        const profileData: ExchangeProfileData = {
          summary: summary || null,
          historicalVolume,
          tickers,
          exchange: cgDetail || null,
          tokenInfo,
          priceHistory,
          mcapHistory,
          historicalPE,
          quarterlyData,
          treasury,
          comparables,
          feeHistory,
          revenueHistory,
          btcPrice,
          holdersRevenue,
          marketShareHistory,
          builderVolume,
        }

        setData(profileData)

        // Lazy Phase 3: Fetch builder volume for Hyperliquid (heavy ~7MB call)
        if (isHyperliquid && !cancelled) {
          fetchHLBuilderVolume().then((bv) => {
            if (!cancelled && bv.data.length > 0) {
              setData((prev) => prev ? { ...prev, builderVolume: bv } : prev)
            }
          }).catch(() => {})
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch exchange data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load().finally(() => clearTimeout(timeout))
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [slug, cgId])

  return { data, loading, error }
}
