import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { CGDerivativeTicker } from '../../types/coingecko'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatFundingRate } from '../../utils/format'

interface Props {
  tickers: CGDerivativeTicker[]
}

interface ChartRow {
  label: string
  rate: number
  rateDisplay: number
  market: string
  symbol: string
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
}) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.symbol}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        Market: {d.market}
      </p>
      <p style={{ margin: 0, color: d.rate >= 0 ? COLORS.green : COLORS.red, fontSize: 12 }}>
        Funding Rate: {formatFundingRate(d.rate)}
      </p>
    </div>
  )
}

export function FundingRateChart({ tickers }: Props) {
  const chartData = useMemo<ChartRow[]>(() => {
    if (!tickers || tickers.length === 0) return []

    return tickers
      .filter((t) => t.funding_rate != null && t.contract_type === 'perpetual')
      .sort((a, b) => Math.abs(b.funding_rate) - Math.abs(a.funding_rate))
      .slice(0, 20)
      .map((t) => ({
        label: `${t.symbol.split('_')[0] || t.base} / ${t.market}`,
        rate: t.funding_rate,
        rateDisplay: t.funding_rate * 100,
        market: t.market,
        symbol: t.symbol,
      }))
      .reverse()
  }, [tickers])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null
    const rates = chartData.map((d) => d.rate)
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length
    const maxPositive = Math.max(...rates)
    const maxNegative = Math.min(...rates)
    const positiveCount = rates.filter((r) => r >= 0).length
    return { avg, maxPositive, maxNegative, positiveCount, total: rates.length }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Funding Rates</h3>
        <p className="chart-subtitle">
          Current perpetual funding rates across top markets
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          Funding rate data unavailable. CoinGecko API may be rate-limited.
        </p>
      </div>
    )
  }

  const chartHeight = Math.max(400, chartData.length * 24)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Funding Rates</h3>
      <p className="chart-subtitle">
        Current perpetual funding rates — positive means longs pay shorts
      </p>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v.toFixed(3)}%`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine x={0} stroke={COLORS.ink} strokeWidth={1} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: COLORS.paperAlt }} />
          <Bar dataKey="rateDisplay" radius={[0, 2, 2, 0]} animationDuration={800}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.rate >= 0 ? COLORS.green : COLORS.red}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {stats && (
        <div className="border-t border-rule mt-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-sans text-xs text-ink-muted">Avg Funding Rate</p>
              <p className="font-mono text-sm font-bold text-ink">
                {formatFundingRate(stats.avg)}
              </p>
            </div>
            <div>
              <p className="font-sans text-xs text-ink-muted">Most Positive</p>
              <p className="font-mono text-sm font-bold" style={{ color: COLORS.green }}>
                {formatFundingRate(stats.maxPositive)}
              </p>
            </div>
            <div>
              <p className="font-sans text-xs text-ink-muted">Most Negative</p>
              <p className="font-mono text-sm font-bold" style={{ color: COLORS.red }}>
                {formatFundingRate(stats.maxNegative)}
              </p>
            </div>
          </div>
          <p className="font-sans text-[11px] text-ink-muted mt-2">
            {stats.positiveCount} of {stats.total} pairs have positive funding (longs pay shorts)
          </p>
        </div>
      )}
    </div>
  )
}
