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
import type { DexCexSharePoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: DexCexSharePoint[]
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

export function DexCexShareChart({ data }: Props) {
  const [period, setPeriod] = useState('1y')

  const chartData = useMemo(() => {
    if (!data.length) return []

    // 7-day rolling average for smoother DEX share line (data is weekly-sampled, so use 4-point window)
    const smoothed = []
    const window = Math.min(4, data.length)
    for (let i = window - 1; i < data.length; i++) {
      let sumPct = 0
      for (let j = i - window + 1; j <= i; j++) sumPct += data[j].dexPct
      smoothed.push({ ...data[i], dexPct: sumPct / window })
    }

    return filterDataByPeriod(smoothed, period)
  }, [data, period])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const monthAgo = chartData.length > 4 ? chartData[chartData.length - 5] : chartData[0]
    const yearAgo = chartData.length > 52 ? chartData[chartData.length - 53] : chartData[0]
    return {
      currentDexPct: latest.dexPct,
      currentDexVol: latest.dexVol,
      currentCexVol: latest.cexVol,
      monthChange: latest.dexPct - monthAgo.dexPct,
      yearChange: latest.dexPct - yearAgo.dexPct,
    }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Decentralised vs Centralised Perp Volume</h3>
        <p className="chart-subtitle">Loading volume breakdown data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Decentralised vs Centralised Perp Volume</h3>
      <p className="chart-subtitle">
        Share of perpetual futures volume from on-chain (DEX) vs off-chain (CEX) exchanges
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Tracks what proportion of perpetual futures trading volume occurs on decentralised exchanges (Hyperliquid, dYdX, GMX, etc.) versus centralised exchanges (Binance, Bybit, OKX, etc.). A rising DEX share indicates growing adoption of on-chain derivatives infrastructure."
          source="DefiLlama derivatives overview. Covers major tracked exchanges only — does not represent the entire derivatives market."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">DEX Share</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.currentDexPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.monthChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.monthChange >= 0 ? '+' : ''}{stats.monthChange.toFixed(1)}pp
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">DEX Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.currentDexVol, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">CEX Vol (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.currentCexVol, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="dexFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.12} />
              <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="cexFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.ink} stopOpacity={0.06} />
              <stop offset="100%" stopColor={COLORS.ink} stopOpacity={0.01} />
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
                  <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>
                    DEX Vol: {formatUSD(d.dexVol, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.ink, fontSize: 12 }}>
                    CEX Vol: {formatUSD(d.cexVol, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
                    DEX Share: {d.dexPct.toFixed(1)}%
                  </p>
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="dexVol"
            stroke={COLORS.blue}
            strokeWidth={1}
            fill="url(#dexFill)"
            stackId="vol"
            animationDuration={800}
          />
          <Area
            yAxisId="vol"
            type="monotone"
            dataKey="cexVol"
            stroke={COLORS.ink}
            strokeWidth={1}
            fill="url(#cexFill)"
            stackId="vol"
            animationDuration={800}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="dexPct"
            stroke={COLORS.green}
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.blue, opacity: 0.4 }} />
          <span className="font-sans text-[11px] text-ink-muted">DEX Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.ink, opacity: 0.2 }} />
          <span className="font-sans text-[11px] text-ink-muted">CEX Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.green }} />
          <span className="font-sans text-[11px] text-ink-muted">DEX Share %</span>
        </span>
      </div>

      <p className="font-sans text-[10px] text-ink-muted mt-3 italic">
        Based on major exchanges tracked by DefiLlama. Does not represent the full derivatives market.
      </p>
    </div>
  )
}
