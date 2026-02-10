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
import type { SolanaGrowthPoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: SolanaGrowthPoint[]
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

export function SolanaChainGrowthChart({ data }: Props) {
  const [period, setPeriod] = useState('1y')

  const chartData = useMemo(() => {
    if (!data.length) return []
    const window = Math.min(4, data.length)
    const smoothed = []
    for (let i = window - 1; i < data.length; i++) {
      let sumPct = 0
      for (let j = i - window + 1; j <= i; j++) sumPct += data[j].solanaPct
      smoothed.push({ ...data[i], solanaPct: sumPct / window })
    }
    return filterDataByPeriod(smoothed, period)
  }, [data, period])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const monthAgo = chartData.length > 4 ? chartData[chartData.length - 5] : chartData[0]
    return {
      currentPct: latest.solanaPct,
      monthChange: latest.solanaPct - monthAgo.solanaPct,
      solanaVol: latest.solanaVol,
      totalDexVol: latest.totalDexVol,
    }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Solana Perp Volume Share</h3>
        <p className="chart-subtitle">Loading chain breakdown data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Solana Perp Volume Share</h3>
      <p className="chart-subtitle">
        Solana's share of on-chain perpetual futures volume across all DEX protocols
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Tracks Solana's share of on-chain perpetual futures volume. Includes Jupiter Perps, Drift, Flash Trade, Zeta Markets, and other Solana-native protocols. A rising share indicates growing adoption of Solana as infrastructure for derivatives trading."
          source="DefiLlama derivatives overview with per-chain breakdown. Only counts DEX (on-chain) protocols."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Solana Share</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.currentPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.monthChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.monthChange >= 0 ? '+' : ''}{stats.monthChange.toFixed(1)}pp
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Solana Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.solanaVol, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total DEX Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.totalDexVol, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="solanaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9945FF" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#9945FF" stopOpacity={0.01} />
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
            tick={{ ...AXIS_STYLE, fill: '#9945FF' }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, (dataMax: number) => Math.min(100, Math.ceil(dataMax * 1.2))]}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color: '#9945FF', fontSize: 12 }}>
                    Solana Vol: {formatUSD(d.solanaVol, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.ink, fontSize: 12 }}>
                    Total DEX Vol: {formatUSD(d.totalDexVol, true)}
                  </p>
                  <p style={{ margin: 0, color: '#9945FF', fontSize: 12, fontWeight: 600 }}>
                    Solana Share: {d.solanaPct.toFixed(1)}%
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="solanaVol"
            stroke="#9945FF"
            strokeWidth={1}
            fill="url(#solanaFill)"
            animationDuration={800}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="solanaPct"
            stroke="#9945FF"
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: '#9945FF', opacity: 0.4 }} />
          <span className="font-sans text-[11px] text-ink-muted">Solana Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#9945FF' }} />
          <span className="font-sans text-[11px] text-ink-muted">Solana Share %</span>
        </span>
      </div>

      <p className="font-sans text-[10px] text-ink-muted mt-3 italic">
        Based on DefiLlama per-chain breakdown for on-chain derivatives protocols only.
      </p>
    </div>
  )
}
