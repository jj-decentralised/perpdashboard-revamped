import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { HistoricalDataPoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  perpVolume: HistoricalDataPoint[]
  spotVolume: HistoricalDataPoint[]
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

export function PerpsDominanceChart({ perpVolume, spotVolume }: Props) {
  const [period, setPeriod] = useState('1y')

  const chartData = useMemo(() => {
    if (!perpVolume.length || !spotVolume.length) return []

    // Build spot volume lookup by day
    const spotMap = new Map<number, number>()
    for (const s of spotVolume) {
      const dayKey = Math.floor(s.date / 86400000) * 86400000
      spotMap.set(dayKey, s.value)
    }

    // Merge and compute ratio — sample weekly for smoother chart
    const merged = perpVolume
      .map((p) => {
        const dayKey = Math.floor(p.date / 86400000) * 86400000
        const spot = spotMap.get(dayKey) || 0
        const total = p.value + spot
        return {
          date: p.date,
          perp: p.value,
          spot,
          total,
          dominance: total > 0 ? (p.value / total) * 100 : 0,
        }
      })
      .filter((d) => d.spot > 0) // only show where we have both

    // 7-day rolling average for smoother dominance line
    if (merged.length < 7) return merged
    const smoothed = []
    for (let i = 6; i < merged.length; i++) {
      let sumDom = 0
      for (let j = i - 6; j <= i; j++) sumDom += merged[j].dominance
      smoothed.push({ ...merged[i], dominance: sumDom / 7 })
    }

    return filterDataByPeriod(smoothed, period)
  }, [perpVolume, spotVolume, period])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const monthAgo = chartData.length > 30 ? chartData[chartData.length - 31] : chartData[0]
    return {
      currentDominance: latest.dominance,
      currentPerp: latest.perp,
      currentSpot: latest.spot,
      dominanceChange: latest.dominance - monthAgo.dominance,
    }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Perps vs Spot Dominance</h3>
        <p className="chart-subtitle">Loading spot DEX volume data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Perps vs Spot Volume</h3>
      <p className="chart-subtitle">
        Perpetual derivatives volume share of total on-chain trading (7d rolling average)
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="The perps dominance ratio (perp volume / total on-chain volume) shows how much speculative activity dominates over spot trading. Rising dominance indicates increasing leverage appetite. Historically, extreme perps dominance has coincided with overheated markets and potential reversals."
          source="DeFiLlama derivatives overview for perp volume and DEX overview for spot volume, merged by date."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Perps Dominance (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.currentDominance.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.dominanceChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.dominanceChange >= 0 ? '+' : ''}{stats.dominanceChange.toFixed(1)}pp
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">24h Perp Vol</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.currentPerp, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">24h Spot Vol</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.currentSpot, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="perpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.ink} stopOpacity={0.08} />
              <stop offset="100%" stopColor={COLORS.ink} stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="spotFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.08} />
              <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(v: number) => formatDateShort(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            minTickGap={60}
          />
          <YAxis
            yAxisId="vol"
            tickFormatter={formatBillions}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ ...AXIS_STYLE, fill: COLORS.green }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, 100]}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color: COLORS.ink, fontSize: 12 }}>
                    Perp Vol: {formatUSD(d.perp, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>
                    Spot Vol: {formatUSD(d.spot, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
                    Perps Dominance: {d.dominance.toFixed(1)}%
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="perp"
            stroke={COLORS.ink}
            strokeWidth={1}
            fill="url(#perpFill)"
            animationDuration={800}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="spot"
            stroke={COLORS.blue}
            strokeWidth={1}
            fill="url(#spotFill)"
            animationDuration={800}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="dominance"
            stroke={COLORS.green}
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.ink, opacity: 0.3 }} />
          <span className="font-sans text-[11px] text-ink-muted">Perp Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.blue, opacity: 0.3 }} />
          <span className="font-sans text-[11px] text-ink-muted">Spot Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.green }} />
          <span className="font-sans text-[11px] text-ink-muted">Perps Dominance %</span>
        </span>
      </div>
    </div>
  )
}
