import { useState, useEffect, useRef, useMemo } from 'react'
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
} from 'recharts'
import { fetchDerivativesOverview } from '../services/defillama'
import type { DexProtocol, DexOverview } from '../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../utils/chartTheme'
import { formatUSD, formatPercent, classNames, percentClass } from '../utils/format'
import { LoadingSkeleton, ErrorDisplay } from '../components/LoadingSkeleton'

// Extended palette for pie chart slices
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

function getChainVolume(protocol: DexProtocol, chain: string): number {
  // Method 1: Use breakdown24h for precise per-chain volume
  if (protocol.breakdown24h && Object.keys(protocol.breakdown24h).length > 0) {
    let chainVol = 0
    for (const [key, subValues] of Object.entries(protocol.breakdown24h)) {
      // breakdown24h keys can be chain names at top level
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

export default function ChainBreakdownPage() {
  const [overview, setOverview] = useState<DexOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChain, setSelectedChain] = useState('Solana')
  const fetchedRef = useRef(false)

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

  // Compute exchange breakdown for selected chain
  const { exchangeData, totalChainVolume, hhi } = useMemo(() => {
    if (!overview) return { exchangeData: [], totalChainVolume: 0, hhi: 0 }

    const exchanges: ChainExchangeData[] = []

    for (const protocol of overview.protocols) {
      if (!protocol.chains?.some((c) => c.toLowerCase() === selectedChain.toLowerCase())) continue

      const vol = getChainVolume(protocol, selectedChain)
      if (vol <= 0) continue

      exchanges.push({
        name: protocol.displayName || protocol.name,
        slug: protocol.slug,
        volume: vol,
        share: 0, // filled below
        change1d: protocol.change_1d,
        change7d: protocol.change_7d,
        chains: protocol.chains || [],
      })
    }

    // Sort by volume desc
    exchanges.sort((a, b) => b.volume - a.volume)

    const totalChainVolume = exchanges.reduce((sum, e) => sum + e.volume, 0)

    // Compute shares
    for (const ex of exchanges) {
      ex.share = totalChainVolume > 0 ? (ex.volume / totalChainVolume) * 100 : 0
    }

    // Compute HHI (Herfindahl-Hirschman Index) for concentration
    const hhi = exchanges.reduce((sum, ex) => sum + ex.share ** 2, 0)

    return { exchangeData: exchanges, totalChainVolume, hhi }
  }, [overview, selectedChain])

  // Pie chart data — top 8 + "Others"
  const pieData = useMemo(() => {
    if (exchangeData.length === 0) return []

    const top = exchangeData.slice(0, 8)
    const others = exchangeData.slice(8)
    const othersVolume = others.reduce((sum, e) => sum + e.volume, 0)

    const slices = top.map((e) => ({
      name: e.name,
      value: e.volume,
      share: e.share,
    }))

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

  // Chain selector tabs: show TOP_CHAINS that exist + others via dropdown
  const visibleChains = TOP_CHAINS.filter((c) => allChains.includes(c))
  const otherChains = allChains.filter((c) => !TOP_CHAINS.includes(c))
  const showDropdown = otherChains.length > 0 || !visibleChains.includes(selectedChain)

  // Concentration label
  const concentrationLabel = hhi > 5000
    ? 'Highly concentrated'
    : hhi > 2500
      ? 'Moderately concentrated'
      : hhi > 1500
        ? 'Moderately competitive'
        : 'Competitive'

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

        {/* Chain selector */}
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
                      tickFormatter={(v: number) => {
                        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
                        if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
                        if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
                        return `$${v.toFixed(0)}`
                      }}
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
            Multi-chain exchanges show estimated per-chain volume.
          </p>
        </footer>
      </div>
    </div>
  )
}
