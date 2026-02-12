import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { HistoricalDataPoint } from '../../types'
import type { CEXVolumePoint } from '../../services/coinglass'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  dexPerpVolume: HistoricalDataPoint[]
  dexSpotVolume: HistoricalDataPoint[]
  cexFuturesVolume: CEXVolumePoint[]
  cexSpotVolume: CEXVolumePoint[]
}

function formatBillions(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

type Mode = 'perps' | 'spot' | 'total'

export function DEXvsCEXChart({ dexPerpVolume, dexSpotVolume, cexFuturesVolume, cexSpotVolume }: Props) {
  const [period, setPeriod] = useState('1y')
  const [mode, setMode] = useState<Mode>('perps')

  const chartData = useMemo(() => {
    // Build lookup maps by day
    const cexFutMap = new Map<number, number>()
    for (const d of cexFuturesVolume) {
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      cexFutMap.set(dayKey, (cexFutMap.get(dayKey) || 0) + d.volume)
    }

    const cexSpotMap = new Map<number, number>()
    for (const d of cexSpotVolume) {
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      cexSpotMap.set(dayKey, (cexSpotMap.get(dayKey) || 0) + d.volume)
    }

    const dexSpotMap = new Map<number, number>()
    for (const d of dexSpotVolume) {
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      dexSpotMap.set(dayKey, d.value)
    }

    // Use DEX perp volume as the base timeline (most complete)
    const source = mode === 'spot' ? dexSpotVolume : dexPerpVolume
    const merged = source.map((p) => {
      const dayKey = Math.floor(p.date / 86400000) * 86400000
      const dexPerp = mode === 'spot' ? 0 : p.value
      const dexSpot = mode === 'perps' ? 0 : (dexSpotMap.get(dayKey) || 0)
      const cexFut = mode === 'spot' ? 0 : (cexFutMap.get(dayKey) || 0)
      const cexSpot = mode === 'perps' ? 0 : (cexSpotMap.get(dayKey) || 0)

      const dexTotal = dexPerp + dexSpot
      const cexTotal = cexFut + cexSpot
      const total = dexTotal + cexTotal
      const dexShare = total > 0 ? (dexTotal / total) * 100 : 0

      return { date: p.date, dex: dexTotal, cex: cexTotal, total, dexShare }
    }).filter((d) => {
      // Only show where we have CEX data
      if (mode === 'perps') return d.cex > 0
      if (mode === 'spot') return d.cex > 0
      return d.cex > 0
    })

    // 7-day rolling average for smoother share line
    if (merged.length < 7) return merged
    const smoothed = []
    for (let i = 6; i < merged.length; i++) {
      let sumShare = 0
      for (let j = i - 6; j <= i; j++) sumShare += merged[j].dexShare
      smoothed.push({ ...merged[i], dexShare: sumShare / 7 })
    }

    return filterDataByPeriod(smoothed, period)
  }, [dexPerpVolume, dexSpotVolume, cexFuturesVolume, cexSpotVolume, period, mode])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const monthAgo = chartData.length > 30 ? chartData[chartData.length - 31] : chartData[0]
    return {
      dexShare: latest.dexShare,
      shareChange: latest.dexShare - monthAgo.dexShare,
      dexVol: latest.dex,
      cexVol: latest.cex,
    }
  }, [chartData])

  const modeLabels: Record<Mode, string> = {
    perps: 'Perps',
    spot: 'Spot',
    total: 'Total',
  }

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">DEX vs CEX Volume</h3>
        <p className="chart-subtitle">Loading CoinGlass CEX volume data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">DEX vs CEX Volume</h3>
      <p className="chart-subtitle">
        On-chain DEX market share of {modeLabels[mode].toLowerCase()} trading volume (7d rolling average)
      </p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MetricInfo
            description="Compares decentralized exchange (DEX) volume against centralized exchange (CEX) volume. Rising DEX share indicates growing on-chain adoption. CEX futures volume is from CoinGlass aggregated taker data; DEX volume is from DefiLlama."
            source="DEX perp + spot volume from DefiLlama. CEX futures + spot volume from CoinGlass aggregated taker buy/sell history."
          />
          <div className="flex gap-1">
            {(['perps', 'spot', 'total'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-xs font-sans rounded transition-colors ${
                  mode === m
                    ? 'bg-ink text-paper'
                    : 'bg-paper-alt text-ink-muted hover:text-ink'
                }`}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">DEX Market Share (7d avg)</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.dexShare.toFixed(2)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.shareChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.shareChange >= 0 ? '+' : ''}{stats.shareChange.toFixed(2)}pp
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">DEX {modeLabels[mode]} Vol</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.dexVol, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">CEX {modeLabels[mode]} Vol</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.cexVol, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
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
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={{ ...AXIS_STYLE, fill: COLORS.green }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 5)]}
          />
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color: CHART_PALETTE[0], fontSize: 12 }}>
                    DEX Vol: {formatUSD(d.dex, true)}
                  </p>
                  <p style={{ margin: 0, color: CHART_PALETTE[1], fontSize: 12 }}>
                    CEX Vol: {formatUSD(d.cex, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.green, fontSize: 12, fontWeight: 600 }}>
                    DEX Share: {d.dexShare.toFixed(2)}%
                  </p>
                  {d.total > 0 && (
                    <p style={{ margin: '4px 0 0', borderTop: `1px solid ${COLORS.rule}`, paddingTop: 4, color: COLORS.ink, fontSize: 12 }}>
                      Total: {formatUSD(d.total, true)}
                    </p>
                  )}
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Bar
            yAxisId="vol"
            dataKey="cex"
            name="CEX Volume"
            fill={CHART_PALETTE[1]}
            fillOpacity={0.5}
            stackId="vol"
            animationDuration={800}
          />
          <Bar
            yAxisId="vol"
            dataKey="dex"
            name="DEX Volume"
            fill={CHART_PALETTE[0]}
            fillOpacity={0.85}
            stackId="vol"
            animationDuration={800}
            radius={[2, 2, 0, 0]}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="dexShare"
            name="DEX Share %"
            stroke={COLORS.green}
            strokeWidth={2}
            dot={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_PALETTE[0], opacity: 0.85 }} />
          <span className="font-sans text-[11px] text-ink-muted">DEX Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_PALETTE[1], opacity: 0.5 }} />
          <span className="font-sans text-[11px] text-ink-muted">CEX Volume</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.green }} />
          <span className="font-sans text-[11px] text-ink-muted">DEX Market Share %</span>
        </span>
      </div>
    </div>
  )
}
