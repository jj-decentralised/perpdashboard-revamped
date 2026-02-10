import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { LiquidationPoint } from '../../services/coinglass'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: LiquidationPoint[]
}

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>{formatDateShort(label)}</p>
      <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>
        Long Liquidations: {formatUSD(d.longLiq, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.red, fontSize: 12 }}>
        Short Liquidations: {formatUSD(d.shortLiq, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12, fontWeight: 600 }}>
        Total: {formatUSD(d.total, true)}
      </p>
    </div>
  )
}

export function LiquidationChart({ data }: Props) {
  const [period, setPeriod] = useState('6m')

  const chartData = useMemo(() => {
    if (!data.length) return []
    // Show shorts as negative for diverging bar chart
    const mapped = data.map((d) => ({
      ...d,
      shortLiqNeg: -d.shortLiq,
    }))
    return filterDataByPeriod(mapped, period)
  }, [data, period])

  const stats = useMemo(() => {
    if (!chartData.length) return null
    const totalLiq = chartData.reduce((s, d) => s + d.total, 0)
    const totalLong = chartData.reduce((s, d) => s + d.longLiq, 0)
    const totalShort = chartData.reduce((s, d) => s + d.shortLiq, 0)
    const maxDay = chartData.reduce((max, d) => d.total > max.total ? d : max, chartData[0])
    return { totalLiq, totalLong, totalShort, longPct: (totalLong / totalLiq) * 100, maxDay }
  }, [chartData])

  if (chartData.length < 3) return null

  return (
    <div className="chart-container">
      <h3 className="chart-title">BTC Futures Liquidations</h3>
      <p className="chart-subtitle">
        Daily long and short liquidations across all CEX exchanges
      </p>

      <div className="flex items-center justify-between mb-3">
        <MetricInfo
          description="Shows daily BTC futures liquidation volume across all centralised exchanges. Long liquidations (green, upward) occur when the market drops and long positions are forcibly closed. Short liquidations (red, downward) occur when the market rises. Spikes indicate high-leverage flush events."
          source="CoinGlass aggregated liquidation data across all major CEX exchanges."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} periods={['1m', '3m', '6m', '1y']} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Total Liquidated</p>
            <p className="font-serif text-lg font-bold">{formatUSD(stats.totalLiq, true)}</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Long Liquidations</p>
            <p className="font-serif text-lg font-bold" style={{ color: COLORS.green }}>{stats.longPct.toFixed(0)}%</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Short Liquidations</p>
            <p className="font-serif text-lg font-bold" style={{ color: COLORS.red }}>{(100 - stats.longPct).toFixed(0)}%</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Largest Day</p>
            <p className="font-serif text-lg font-bold">{formatUSD(stats.maxDay.total, true)}</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} stackOffset="sign">
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
          <YAxis tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="longLiq" stackId="liq" fill={COLORS.green} fillOpacity={0.75} radius={[2, 2, 0, 0]}
            animationDuration={600} />
          <Bar dataKey="shortLiqNeg" stackId="liq" fill={COLORS.red} fillOpacity={0.75} radius={[0, 0, 2, 2]}
            animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-5 mt-2" style={{ fontFamily: AXIS_STYLE.fontFamily, fontSize: 12, color: COLORS.inkLight }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
          Long Liquidations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.red }} />
          Short Liquidations
        </span>
      </div>
    </div>
  )
}
