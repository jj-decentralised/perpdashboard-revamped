import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { OIExchangePoint } from '../../services/coinglass'
import { getTopOIExchanges } from '../../services/coinglass'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  data: OIExchangePoint[]
}

const OI_PALETTE = [
  '#1a1a1a', '#2e5e8e', '#64748b', '#94a3b8', '#c1352d',
  '#2e7d4f', '#b8860b', '#7c3aed',
]

function fmtAxis(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: '0 0 4px' }}>{formatDateShort(label)}</p>
      {sorted.map((entry: any) => (
        entry.value > 0 && (
          <p key={entry.dataKey} style={{ margin: 0, fontSize: 11, color: entry.color }}>
            {entry.dataKey}: {formatUSD(entry.value, true)}
          </p>
        )
      ))}
    </div>
  )
}

export function CEXOIChart({ data }: Props) {
  const { chartData, topExchanges } = useMemo(() => {
    if (!data.length) return { chartData: [], topExchanges: [] }

    const top = getTopOIExchanges(data, 8)

    const mapped = data.map((pt) => {
      const row: Record<string, number> = { date: pt.date }
      let otherOI = 0
      for (const [ex, val] of Object.entries(pt.exchanges)) {
        if (top.includes(ex)) {
          row[ex] = val
        } else {
          otherOI += val
        }
      }
      if (otherOI > 0) row['Other'] = otherOI
      return row
    })

    return { chartData: mapped, topExchanges: [...top, 'Other'] }
  }, [data])

  const stats = useMemo(() => {
    if (!data.length) return null
    const latest = data[data.length - 1]
    const first = data[0]
    const change = latest.total > 0 && first.total > 0
      ? ((latest.total - first.total) / first.total) * 100
      : 0
    return { totalOI: latest.total, change }
  }, [data])

  if (chartData.length < 3) return null

  return (
    <div className="chart-container">
      <h3 className="chart-title">CEX Open Interest by Exchange</h3>
      <p className="chart-subtitle">
        BTC futures open interest distribution across major centralised exchanges
      </p>

      <div className="flex items-center justify-between mb-3">
        <MetricInfo
          description="Shows how BTC futures open interest is distributed across the largest centralised exchanges over the past year. Rising total OI indicates increasing leverage in the system, while shifts between exchanges reflect migration of trading activity."
          source="CoinGlass open interest data across all major CEX exchanges."
        />
        {stats && (
          <div className="text-right">
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Current Total OI</p>
            <p className="font-serif text-lg font-bold">{formatUSD(stats.totalOI, true)}</p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
          <YAxis tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
          <Tooltip content={<CustomTooltip />} />
          {topExchanges.map((ex, i) => (
            <Area
              key={ex}
              type="monotone"
              dataKey={ex}
              stackId="oi"
              stroke={OI_PALETTE[i % OI_PALETTE.length]}
              fill={OI_PALETTE[i % OI_PALETTE.length]}
              fillOpacity={0.6}
              strokeWidth={0}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2" style={{ fontFamily: AXIS_STYLE.fontFamily, fontSize: 11, color: COLORS.inkLight }}>
        {topExchanges.map((ex, i) => (
          <span key={ex} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: OI_PALETTE[i % OI_PALETTE.length] }} />
            {ex}
          </span>
        ))}
      </div>
    </div>
  )
}
