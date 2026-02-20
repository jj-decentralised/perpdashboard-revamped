import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { fetchDerivativesOverview, fetchDerivativesSummaryWithBreakdown, SLUG_TO_GECKO_TOKEN } from '../services/defillama'
import type { DexProtocol, DexOverview } from '../types'
import type { DerivativesSummary } from '../types/profile'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../utils/chartTheme'
import { formatUSD, formatPercent, classNames, percentClass, formatDateShort } from '../utils/format'
import { LoadingSkeleton, ErrorDisplay } from '../components/LoadingSkeleton'

// Extended palette for pie chart slices and line series
const PIE_COLORS = [
  '#1a1a1a',
  '#2e5e8e',
  '#c1352d',
  '#2e7d4f',
  '#b8860b',
  '#64748b',
  '#94a3b8',
  '#475569',
  '#6b7280',
  '#cbd5e1',
  '#9ca3af',
  '#78716c',
]

interface ChainExchangeData {
  name: string
  slug: string
  volume: number
  share: number
  change1d: number | null
  change7d: number | null
  chains: string[]
  hasToken: boolean
}

// Each day's data point for the time-series
interface ChainTimeSeriesPoint {
  date: number
  [exchangeName: string]: number // raw volume or pct share
}

function protocolHasToken(slug: string): boolean {
  const s = slug?.toLowerCase() || ''
  if (SLUG_TO_GECKO_TOKEN[s]) return true
  const stripped = s.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
  if (stripped !== s && SLUG_TO_GECKO_TOKEN[stripped]) return true
  return false
}

// Popular chains sorted by typical volume
const TOP_CHAINS = [
  'Solana',
  'Arbitrum',
  'Base',
  'Ethereum',
  'BSC',
  'Blast',
  'Polygon',
  'Optimism',
  'Avalanche',
  'Sui',
]

// Jan 1 2023 in seconds
const SINCE_2023 = 1672531200

function getChainVolume(protocol: DexProtocol, chain: string): number {
  // Method 1: Use breakdown24h for precise per-chain volume
  if (protocol.breakdown24h && Object.keys(protocol.breakdown24h).length > 0) {
    let chainVol = 0
    for (const [key, subValues] of Object.entries(protocol.breakdown24h)) {
      if (key.toLowerCase() === chain.toLowerCase()) {
        chainVol += Object.values(subValues).reduce((sum, v) => sum + (v || 0), 0)
      }
    }
    if (chainVol > 0) return chainVol
  }

  // Method 2: If exchange only operates on this chain, use full volume
  if (protocol.chains?.length === 1 && protocol.chains[0].toLowerCase() === chain.toLowerCase()) {
    return protocol.total24h || 0
  }

  // Method 3: Split evenly across chains as fallback
  if (protocol.chains?.some((c) => c.toLowerCase() === chain.toLowerCase())) {
    return (protocol.total24h || 0) / (protocol.chains.length || 1)
  }

  return 0
}

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

type SeriesView = 'usd' | 'pct'

export default function ChainBreakdownPage() {
  const [overview, setOverview] = useState<DexOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChain, setSelectedChain] = useState('Solana')
  const [hideNoToken, setHideNoToken] = useState(false)
  const [seriesView, setSeriesView] = useState<SeriesView>('usd')
  const [seriesLoading, setSeriesLoading] = useState(false)
  // Per-protocol historical summaries keyed by slug
  const [protocolSummaries, setProtocolSummaries] = useState<Map<string, DerivativesSummary>>(new Map())
  const fetchedRef = useRef(false)
  const seriesFetchedForChain = useRef<string | null>(null)

  // Phase 1: Load lightweight overview
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchDerivativesOverview(true)
        if (!cancelled) {
          setOverview(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Phase 2: Fetch individual protocol summaries when chain changes
  // Each protocol summary (~50-200KB) includes totalDataChart + chain breakdown
  useEffect(() => {
    if (!overview || seriesFetchedForChain.current === selectedChain) return
    seriesFetchedForChain.current = selectedChain

    let cancelled = false

    async function loadSeries() {
      if (!overview) return
      setSeriesLoading(true)

      // Find top protocols on this chain by 24h volume
      const chainProtocols = overview.protocols
        .filter((p) => p.chains?.some((c) => c.toLowerCase() === selectedChain.toLowerCase()))
        .filter((p) => (p.total24h || 0) > 0)
        .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
        .slice(0, 10) // Top 10 is enough for meaningful line charts

      // Fetch summaries in parallel (each is small, ~50-200KB)
      const results = await Promise.allSettled(
        chainProtocols.map((p) =>
          fetchDerivativesSummaryWithBreakdown(p.slug)
            .then((summary) => ({ slug: p.slug, name: p.displayName || p.name, summary }))
        )
      )

      if (cancelled) return

      const newMap = new Map<string, DerivativesSummary>()
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { slug, summary } = result.value
          newMap.set(slug, summary)
        }
      }

      setProtocolSummaries(newMap)
      setSeriesLoading(false)
    }

    loadSeries()
    return () => { cancelled = true }
  }, [overview, selectedChain])

  // Build list of all chains sorted by total volume
  const allChains = useMemo(() => {
    if (!overview) return []

    const chainVolumes: Record<string, number> = {}
    for (const protocol of overview.protocols) {
      if (!protocol.chains) continue
      for (const chain of protocol.chains) {
        const vol = getChainVolume(protocol, chain)
        chainVolumes[chain] = (chainVolumes[chain] || 0) + vol
      }
    }

    return Object.entries(chainVolumes)
      .sort(([, a], [, b]) => b - a)
      .map(([chain]) => chain)
  }, [overview])

  // Compute exchange breakdown for selected chain (snapshot)
  const { exchangeData, totalChainVolume, hhi } = useMemo(() => {
    if (!overview) return { exchangeData: [], totalChainVolume: 0, hhi: 0 }

    const exchanges: ChainExchangeData[] = []

    for (const protocol of overview.protocols) {
      if (!protocol.chains?.some((c) => c.toLowerCase() === selectedChain.toLowerCase())) continue

      const vol = getChainVolume(protocol, selectedChain)
      if (vol <= 0) continue

      const hasToken = protocolHasToken(protocol.slug)
      if (hideNoToken && !hasToken) continue

      exchanges.push({
        name: protocol.displayName || protocol.name,
        slug: protocol.slug,
        volume: vol,
        share: 0,
        change1d: protocol.change_1d,
        change7d: protocol.change_7d,
        chains: protocol.chains || [],
        hasToken,
      })
    }

    exchanges.sort((a, b) => b.volume - a.volume)
    const totalChainVolume = exchanges.reduce((sum, e) => sum + e.volume, 0)
    for (const ex of exchanges) {
      ex.share = totalChainVolume > 0 ? (ex.volume / totalChainVolume) * 100 : 0
    }
    const hhi = exchanges.reduce((sum, ex) => sum + ex.share ** 2, 0)
    return { exchangeData: exchanges, totalChainVolume, hhi }
  }, [overview, selectedChain, hideNoToken])

  // ── Historical time-series from individual protocol summaries ──
  // Each protocol's summary has totalDataChart (daily [timestamp, volume])
  // and optionally totalDataChartBreakdown for per-chain volume
  const { timeSeries, timeSeriesNames } = useMemo(() => {
    if (protocolSummaries.size === 0) return { timeSeries: [] as ChainTimeSeriesPoint[], timeSeriesNames: [] as string[] }

    const chainLower = selectedChain.toLowerCase()

    // For each protocol, extract daily volume for the selected chain
    // Structure: { protocolName: Map<dayKey, volume> }
    const protocolDailyMaps: { name: string; dayMap: Map<number, number>; total: number }[] = []

    for (const [slug, summary] of protocolSummaries) {
      const name = summary.name || slug
      const isSingleChain = summary.chains?.length === 1 &&
        summary.chains[0].toLowerCase() === chainLower
      const isOnChain = summary.chains?.some((c) => c.toLowerCase() === chainLower)

      if (!isOnChain) continue

      const dayMap = new Map<number, number>()
      let total = 0

      for (const entry of summary.totalDataChart || []) {
        const [ts, vol] = entry
        if (ts < SINCE_2023) continue

        let chainVol = vol // Default: use full volume

        // For multi-chain protocols, try to extract per-chain volume from breakdown
        if (!isSingleChain && summary.totalDataChartBreakdown) {
          // totalDataChartBreakdown is array indexed same as totalDataChart
          // but since we filtered by SINCE_2023, we need the matching index
          // Actually, breakdown is keyed differently — it's a separate array
          // For per-protocol summary, breakdown keys are chain names
          // Let's find matching breakdown entry
          const idx = (summary.totalDataChart || []).indexOf(entry)
          const bdEntry = summary.totalDataChartBreakdown?.[idx]
          if (bdEntry) {
            let found = 0
            for (const [chainKey, subMap] of Object.entries(bdEntry)) {
              if (chainKey.toLowerCase() === chainLower) {
                found += typeof subMap === 'number' ? subMap : Object.values(subMap).reduce((s, v) => s + (Number(v) || 0), 0)
              }
            }
            if (found > 0) chainVol = found
            else chainVol = 0 // Has breakdown but chain not present → zero
          }
        }

        if (chainVol > 0) {
          const dayKey = Math.floor(ts / 86400) * 86400
          dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + chainVol)
          total += chainVol
        }
      }

      if (dayMap.size > 0) {
        protocolDailyMaps.push({ name, dayMap, total })
      }
    }

    if (protocolDailyMaps.length === 0) return { timeSeries: [] as ChainTimeSeriesPoint[], timeSeriesNames: [] as string[] }

    // Sort by total volume and pick top 8
    protocolDailyMaps.sort((a, b) => b.total - a.total)
    const topProtocols = protocolDailyMaps.slice(0, 8)
    const topNames = topProtocols.map((p) => p.name)

    // Collect all unique day keys
    const allDays = new Set<number>()
    for (const { dayMap } of topProtocols) {
      for (const day of dayMap.keys()) allDays.add(day)
    }
    const sortedDays = [...allDays].sort((a, b) => a - b)

    // Build time-series points
    const series: ChainTimeSeriesPoint[] = sortedDays.map((day) => {
      const point: ChainTimeSeriesPoint = { date: day * 1000 }
      for (const p of topProtocols) {
        point[p.name] = p.dayMap.get(day) || 0
      }
      return point
    })

    return { timeSeries: series, timeSeriesNames: topNames }
  }, [protocolSummaries, selectedChain])

  // Compute % share version of time-series
  const timeSeriesPct = useMemo(() => {
    if (timeSeries.length === 0) return []
    const names = timeSeriesNames.filter((n) => n !== 'date')

    return timeSeries.map((point) => {
      const newPoint: ChainTimeSeriesPoint = { date: point.date }
      let total = 0
      for (const n of names) total += (point[n] as number) || 0
      for (const n of names) {
        newPoint[n] = total > 0 ? (((point[n] as number) || 0) / total) * 100 : 0
      }
      return newPoint
    })
  }, [timeSeries, timeSeriesNames])

  // CSV export — daily, all exchanges, both raw and pct
  const downloadCSV = useCallback(() => {
    const names = timeSeriesNames
    const header = ['Date', ...names.map((n) => `${n} (USD)`), ...names.map((n) => `${n} (%)`)].join(',')

    const rows = timeSeries.map((point, i) => {
      const date = new Date(point.date).toISOString().split('T')[0]
      const pctPoint = timeSeriesPct[i]
      const usdCols = names.map((n) => ((point[n] as number) || 0).toFixed(2))
      const pctCols = names.map((n) => ((pctPoint?.[n] as number) || 0).toFixed(2))
      return [date, ...usdCols, ...pctCols].join(',')
    })

    const csv = header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chain_breakdown_${selectedChain.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [timeSeries, timeSeriesPct, timeSeriesNames, selectedChain])

  // Pie chart data — top 8 + "Others"
  const pieData = useMemo(() => {
    if (exchangeData.length === 0) return []
    const top = exchangeData.slice(0, 8)
    const others = exchangeData.slice(8)
    const othersVolume = others.reduce((sum, e) => sum + e.volume, 0)
    const slices = top.map((e) => ({ name: e.name, value: e.volume, share: e.share }))
    if (othersVolume > 0) {
      slices.push({
        name: `Others (${others.length})`,
        value: othersVolume,
        share: (othersVolume / totalChainVolume) * 100,
      })
    }
    return slices
  }, [exchangeData, totalChainVolume])

  // Bar chart data — top 15
  const barData = useMemo(() => {
    return exchangeData.slice(0, 15).map((e) => ({
      name: e.name,
      volume: e.volume,
      share: e.share,
    }))
  }, [exchangeData])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorDisplay message={error} />
  if (!overview) return <ErrorDisplay message="No data available" />

  // Chain selector tabs
  const visibleChains = TOP_CHAINS.filter((c) => allChains.includes(c))
  const otherChains = allChains.filter((c) => !TOP_CHAINS.includes(c))
  const showDropdown = otherChains.length > 0 || !visibleChains.includes(selectedChain)

  const concentrationLabel = hhi > 5000
    ? 'Highly concentrated'
    : hhi > 2500
      ? 'Moderately concentrated'
      : hhi > 1500
        ? 'Moderately competitive'
        : 'Competitive'

  const activeSeriesData = seriesView === 'usd' ? timeSeries : timeSeriesPct

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-2">
          <Link
            to="/"
            className="font-sans text-xs uppercase tracking-wider hover:underline"
            style={{ color: COLORS.blue }}
          >
            &larr; Dashboard
          </Link>
        </div>

        <div className="border-b-2 border-ink pb-4 mb-6">
          <h1 className="font-serif text-3xl font-bold text-ink">
            Chain Volume Breakdown
          </h1>
          <p className="font-sans text-sm text-ink-muted mt-1">
            Market share of perpetual exchanges by blockchain network
          </p>
        </div>

        {/* Chain selector + filters */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleChains.map((chain) => (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={classNames(
                  'px-4 py-2 border font-sans text-sm transition-colors',
                  selectedChain === chain
                    ? 'bg-ink text-paper border-ink font-semibold'
                    : 'bg-paper text-ink-muted border-rule hover:border-ink hover:text-ink'
                )}
              >
                {chain}
              </button>
            ))}
            {showDropdown && (
              <select
                value={otherChains.includes(selectedChain) ? selectedChain : ''}
                onChange={(e) => {
                  if (e.target.value) setSelectedChain(e.target.value)
                }}
                className="px-3 py-2 border border-rule bg-paper font-sans text-sm text-ink-muted hover:border-ink cursor-pointer"
              >
                <option value="">More chains...</option>
                {otherChains.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain}
                  </option>
                ))}
              </select>
            )}

            <span className="mx-2 hidden sm:inline" style={{ color: COLORS.rule }}>|</span>

            <label className="flex items-center gap-1.5 font-sans text-sm text-ink-muted cursor-pointer px-3 py-2 border border-rule hover:border-ink transition-colors">
              <input
                type="checkbox"
                checked={hideNoToken}
                onChange={(e) => setHideNoToken(e.target.checked)}
                className="accent-ink"
              />
              Token projects only
            </label>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="border border-rule p-4">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Total 24h Volume
            </p>
            <p className="font-mono text-lg font-bold text-ink">
              {formatUSD(totalChainVolume, true)}
            </p>
          </div>
          <div className="border border-rule p-4">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Active Exchanges
            </p>
            <p className="font-mono text-lg font-bold text-ink">
              {exchangeData.length}
            </p>
          </div>
          <div className="border border-rule p-4">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Top Exchange Share
            </p>
            <p className="font-mono text-lg font-bold text-ink">
              {exchangeData.length > 0 ? `${exchangeData[0].share.toFixed(1)}%` : '—'}
            </p>
            {exchangeData.length > 0 && (
              <p className="font-sans text-xs text-ink-muted mt-0.5">
                {exchangeData[0].name}
              </p>
            )}
          </div>
          <div className="border border-rule p-4">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
              Market Concentration
            </p>
            <p className="font-mono text-lg font-bold text-ink">
              {hhi.toFixed(0)} HHI
            </p>
            <p className="font-sans text-xs text-ink-muted mt-0.5">
              {concentrationLabel}
            </p>
          </div>
        </div>

        {exchangeData.length === 0 ? (
          <div className="border border-rule p-12 text-center">
            <p className="font-serif text-lg text-ink-muted">
              No perpetual exchanges found on {selectedChain}
            </p>
          </div>
        ) : (
          <>
            {/* Charts row: Pie + Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Pie chart */}
              <div className="chart-container">
                <h3 className="chart-title">Market Share</h3>
                <p className="chart-subtitle">
                  24h volume distribution on {selectedChain}
                </p>
                <ResponsiveContainer width="100%" height={360}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={130}
                      innerRadius={60}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={1}
                      animationDuration={600}
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          stroke={COLORS.paper}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                            <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                              Volume: {formatUSD(d.value, true)}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                              Share: {d.share.toFixed(1)}%
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  {pieData.map((slice, i) => (
                    <div key={slice.name} className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="font-sans text-xs text-ink truncate">
                        {slice.name}{' '}
                        <span className="text-ink-muted">{slice.share.toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart */}
              <div className="chart-container">
                <h3 className="chart-title">Volume Rankings</h3>
                <p className="chart-subtitle">
                  Top {Math.min(15, barData.length)} exchanges on {selectedChain}
                </p>
                <ResponsiveContainer width="100%" height={Math.max(360, barData.length * 28 + 30)}>
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke={GRID_STYLE.stroke}
                      strokeDasharray={GRID_STYLE.strokeDasharray}
                    />
                    <XAxis
                      type="number"
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.rule }}
                      tickFormatter={fmtAxis}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ ...AXIS_STYLE, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                            <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                              Volume: {formatUSD(d.volume, true)}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                              Share: {d.share.toFixed(1)}%
                            </p>
                          </div>
                        )
                      }}
                      cursor={{ fill: COLORS.paperAlt }}
                    />
                    <Bar
                      dataKey="volume"
                      fill={COLORS.ink}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={22}
                      animationDuration={600}
                    >
                      {barData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Historical Line Series ── */}
            {seriesLoading && activeSeriesData.length === 0 && (
              <div className="chart-container mb-8">
                <h3 className="chart-title">Historical Volume by Exchange</h3>
                <p className="chart-subtitle">Loading historical breakdown data...</p>
                <div className="loading-pulse h-96" />
              </div>
            )}
            {activeSeriesData.length > 0 && (
              <div className="chart-container mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
                  <div>
                    <h3 className="chart-title">Historical Volume by Exchange</h3>
                    <p className="chart-subtitle">
                      {seriesView === 'usd'
                        ? `Daily volume per exchange on ${selectedChain} since Jan 2023`
                        : `Daily market share (%) per exchange on ${selectedChain} since Jan 2023`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {(['usd', 'pct'] as SeriesView[]).map((v) => (
                        <button
                          key={v}
                          onClick={() => setSeriesView(v)}
                          className={v === seriesView
                            ? 'px-2.5 py-1 border bg-ink text-paper border-ink font-semibold font-sans text-xs'
                            : 'px-2.5 py-1 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
                          type="button"
                        >
                          {v === 'usd' ? 'USD' : '% Share'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={downloadCSV}
                      className="font-sans text-[11px] text-ink-muted border border-rule px-2.5 py-1 hover:bg-paper-alt transition-colors cursor-pointer"
                      title="Download daily data as CSV (includes both USD and % columns)"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={440}>
                  <LineChart data={activeSeriesData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                    <XAxis
                      dataKey="date"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      scale="time"
                      tickFormatter={formatDateShort}
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.rule }}
                      minTickGap={60}
                    />
                    <YAxis
                      tickFormatter={seriesView === 'usd' ? fmtAxis : (v: number) => `${v.toFixed(0)}%`}
                      tick={AXIS_STYLE}
                      tickLine={false}
                      axisLine={false}
                      width={seriesView === 'usd' ? 62 : 42}
                      domain={seriesView === 'pct' ? [0, 100] : undefined}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
                        return (
                          <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.4, maxWidth: 280 }}>
                            <p style={TOOLTIP_STYLE.labelStyle}>
                              {label ? formatDateShort(label) : ''}
                            </p>
                            {sorted.map((entry: any) => (
                              <div
                                key={entry.name}
                                style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: COLORS.inkLight, padding: '1px 0' }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ display: 'inline-block', width: 10, height: 2, backgroundColor: entry.color, flexShrink: 0 }} />
                                  {entry.name}
                                </span>
                                <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                                  {seriesView === 'usd'
                                    ? formatUSD(entry.value, true)
                                    : `${(entry.value || 0).toFixed(1)}%`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                      cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
                    />
                    {timeSeriesNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
                        strokeWidth={name === 'Other' ? 1 : 2}
                        dot={false}
                        animationDuration={800}
                        connectNulls
                        strokeDasharray={name === 'Other' ? '4 3' : undefined}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {timeSeriesNames.map((name, i) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-4 h-0.5"
                        style={{
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          ...(name === 'Other' ? { borderTop: '1px dashed', borderColor: PIE_COLORS[i % PIE_COLORS.length] } : {}),
                        }}
                      />
                      <span className="font-sans text-[11px] text-ink-muted">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full rankings table */}
            <div className="section-rule-heavy">
              <h3 className="font-serif text-xl font-bold text-ink mb-1">
                All Exchanges on {selectedChain}
              </h3>
              <p className="font-sans text-sm text-ink-muted mb-4">
                {exchangeData.length} perpetual exchanges ranked by 24h volume
              </p>
              <div className="overflow-x-auto border border-rule bg-paper">
                <table className="data-table w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky top-0 bg-paper z-10">#</th>
                      <th className="sticky top-0 bg-paper z-10">Exchange</th>
                      <th className="text-right sticky top-0 bg-paper z-10">24h Volume</th>
                      <th className="text-right sticky top-0 bg-paper z-10">Market Share</th>
                      <th className="text-right sticky top-0 bg-paper z-10">1d %</th>
                      <th className="text-right sticky top-0 bg-paper z-10">7d %</th>
                      <th className="text-right sticky top-0 bg-paper z-10">Chains</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exchangeData.map((ex, i) => (
                      <tr
                        key={ex.slug}
                        className={i % 2 === 1 ? 'bg-paper-warm' : undefined}
                      >
                        <td className="text-ink-muted w-10">{i + 1}</td>
                        <td className="font-sans text-sm font-medium whitespace-nowrap">
                          <Link
                            to={`/exchange/${ex.slug}`}
                            className="hover:underline"
                            style={{ color: COLORS.blue }}
                          >
                            {ex.name}
                          </Link>
                          {ex.hasToken && (
                            <span className="ml-1.5 font-mono text-[9px] uppercase px-1 py-0.5 border border-rule text-ink-muted">
                              TOKEN
                            </span>
                          )}
                        </td>
                        <td className="text-right">{formatUSD(ex.volume, true)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="h-2 rounded-sm"
                              style={{
                                width: `${Math.max(4, Math.min(60, ex.share * 1.5))}px`,
                                backgroundColor: COLORS.ink,
                                opacity: 0.3,
                              }}
                            />
                            <span className="font-mono text-xs">
                              {ex.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className={classNames('text-right', percentClass(ex.change1d))}>
                          {formatPercent(ex.change1d)}
                        </td>
                        <td className={classNames('text-right', percentClass(ex.change7d))}>
                          {formatPercent(ex.change7d)}
                        </td>
                        <td className="text-right font-sans text-xs text-ink-muted">
                          {ex.chains.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="border-t border-rule mt-12 pt-4 pb-8">
          <p className="font-mono text-xs text-ink-muted text-center">
            Volume breakdown uses on-chain data from DefiLlama.
            Historical series from Jan 2023 with daily granularity.
            Multi-chain exchanges show per-chain volume where available.
          </p>
        </footer>
      </div>
    </div>
  )
}
