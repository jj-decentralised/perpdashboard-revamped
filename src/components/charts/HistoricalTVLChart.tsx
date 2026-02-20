import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { fetchProtocolTVL } from '../../services/defillama'
import type { ProtocolTVLPoint } from '../../services/defillama'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

const LINE_COLORS = [
  '#1a1a1a',
  '#2e5e8e',
  '#c1352d',
  '#2e7d4f',
  '#b8860b',
  '#64748b',
  '#94a3b8',
  '#475569',
]

// Jan 1 2023 in seconds
const SINCE_2023 = 1672531200

type SeriesView = 'usd' | 'pct'

interface TVLTimePoint {
  date: number
  [exchangeName: string]: number
}

interface Props {
  exchanges: EnrichedExchange[]
}

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function HistoricalTVLChart({ exchanges }: Props) {
  const [tvlData, setTvlData] = useState<{ name: string; tvl: ProtocolTVLPoint[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('1y')
  const [seriesView, setSeriesView] = useState<SeriesView>('usd')
  const fetchedRef = useRef(false)

  // Pick top 8 exchanges by TVL
  const topExchanges = useMemo(() => {
    return exchanges
      .filter((e) => e.tvl > 0 && e.venueType === 'defi')
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 8)
  }, [exchanges])

  useEffect(() => {
    if (fetchedRef.current || topExchanges.length === 0) return
    fetchedRef.current = true

    let cancelled = false

    async function loadAll() {
      setLoading(true)
      const results: { name: string; tvl: ProtocolTVLPoint[] }[] = []

      for (const ex of topExchanges) {
        if (cancelled) break
        try {
          const data = await fetchProtocolTVL(ex.slug)
          if (data.tvl.length > 0) {
            results.push({ name: ex.displayName || ex.name, tvl: data.tvl })
          }
        } catch {
          // Skip failed fetches
        }
        // Small delay between sequential requests to avoid rate limits
        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }

      if (!cancelled) {
        setTvlData(results)
        setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [topExchanges])

  // Build time-series from individual protocol TVL histories
  const { timeSeries, exchangeNames } = useMemo(() => {
    if (tvlData.length === 0) return { timeSeries: [] as TVLTimePoint[], exchangeNames: [] as string[] }

    const names = tvlData.map((d) => d.name)

    // Build per-exchange day maps (weekly sampling for performance)
    const exchangeDayMaps: Map<number, number>[] = tvlData.map((d) => {
      const dayMap = new Map<number, number>()
      for (let i = 0; i < d.tvl.length; i++) {
        const p = d.tvl[i]
        if (p.date < SINCE_2023) continue
        // Sample weekly (every 7th point) for performance, always include last point
        if (i % 7 !== 0 && i !== d.tvl.length - 1) continue
        const dayKey = Math.floor(p.date / 86400) * 86400
        dayMap.set(dayKey, p.totalLiquidityUSD)
      }
      return dayMap
    })

    // Collect all unique days
    const allDays = new Set<number>()
    for (const dayMap of exchangeDayMaps) {
      for (const day of dayMap.keys()) allDays.add(day)
    }
    const sortedDays = [...allDays].sort((a, b) => a - b)

    // Build series with forward-fill for missing days
    const lastValues = new Array(names.length).fill(0)
    const series: TVLTimePoint[] = sortedDays.map((day) => {
      const point: TVLTimePoint = { date: day * 1000 }
      for (let i = 0; i < names.length; i++) {
        const val = exchangeDayMaps[i].get(day)
        if (val !== undefined) lastValues[i] = val
        point[names[i]] = lastValues[i]
      }
      return point
    })

    return { timeSeries: series, exchangeNames: names }
  }, [tvlData])

  // Filter by period
  const filteredSeries = useMemo(() => {
    if (timeSeries.length === 0) return []
    const asHistorical = timeSeries.map((p) => ({ date: p.date, value: 0 }))
    const filtered = filterDataByPeriod(asHistorical, period)
    const startDate = filtered.length > 0 ? filtered[0].date : 0
    return timeSeries.filter((p) => p.date >= startDate)
  }, [timeSeries, period])

  // Compute % share version
  const pctSeries = useMemo(() => {
    if (filteredSeries.length === 0) return []
    return filteredSeries.map((point) => {
      const newPoint: TVLTimePoint = { date: point.date }
      let total = 0
      for (const n of exchangeNames) total += (point[n] as number) || 0
      for (const n of exchangeNames) {
        newPoint[n] = total > 0 ? (((point[n] as number) || 0) / total) * 100 : 0
      }
      return newPoint
    })
  }, [filteredSeries, exchangeNames])

  // CSV export
  const downloadCSV = useCallback(() => {
    const activeData = seriesView === 'usd' ? filteredSeries : pctSeries
    const header = ['Date', ...exchangeNames.map((n) => `${n} (${seriesView === 'usd' ? 'USD' : '%'})`)].join(',')
    const rows = activeData.map((point) => {
      const date = new Date(point.date).toISOString().split('T')[0]
      const cols = exchangeNames.map((n) => ((point[n] as number) || 0).toFixed(2))
      return [date, ...cols].join(',')
    })
    const csv = header + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tvl_history_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredSeries, pctSeries, exchangeNames, seriesView])

  if (topExchanges.length === 0) return null

  const activeData = seriesView === 'usd' ? filteredSeries : pctSeries

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <div>
          <h3 className="chart-title">Historical TVL by Exchange</h3>
          <p className="chart-subtitle">
            {seriesView === 'usd'
              ? 'Total value locked over time for top perpetual exchanges'
              : 'TVL market share (%) over time for top perpetual exchanges'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MetricInfo
            description="Historical TVL tracks capital deposited in each exchange's smart contracts over time. Rising TVL generally indicates growing trader confidence and deeper liquidity."
            source="Per-protocol TVL from DefiLlama. Only includes DeFi (on-chain) exchanges with TVL > 0. Weekly sampling."
          />
          <TimePeriodSelector selected={period} onChange={setPeriod} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-16 justify-center">
          <div className="loading-pulse h-64 w-full" />
        </div>
      )}

      {!loading && activeData.length === 0 && (
        <div className="border border-rule p-8 text-center">
          <p className="font-sans text-sm text-ink-muted">No historical TVL data available</p>
        </div>
      )}

      {!loading && activeData.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
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
              title="Download daily data as CSV"
            >
              Export CSV
            </button>
          </div>

          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={activeData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              {exchangeNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={800}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {exchangeNames.map((name, i) => (
              <div key={name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-0.5"
                  style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                <span className="font-sans text-[11px] text-ink-muted">{name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
