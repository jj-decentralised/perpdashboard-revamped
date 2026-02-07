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
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ChartRow {
  name: string
  openInterest: number
  hasToken: boolean
  tokenSymbol: string | null
}

function formatAxisOI(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
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
      <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        Open Interest: {formatUSD(d.openInterest, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
        {d.hasToken ? `Token: ${d.tokenSymbol}` : 'No governance token'}
      </p>
    </div>
  )
}

export function OpenInterestChart({ exchanges }: Props) {
  const { chartData, totalOI, top5Share, tokenOI, noTokenOI } = useMemo(() => {
    const valid = exchanges
      .filter((e) => e.openInterest > 0)
      .sort((a, b) => b.openInterest - a.openInterest)

    const totalOI = valid.reduce((s, e) => s + e.openInterest, 0)
    const top15 = valid.slice(0, 15)
    const top5OI = valid.slice(0, 5).reduce((s, e) => s + e.openInterest, 0)
    const top5Share = totalOI > 0 ? (top5OI / totalOI) * 100 : 0

    const tokenOI = valid.filter((e) => e.hasToken).reduce((s, e) => s + e.openInterest, 0)
    const noTokenOI = totalOI - tokenOI

    const chartData: ChartRow[] = top15.map((e) => ({
      name: e.displayName || e.name,
      openInterest: e.openInterest,
      hasToken: e.hasToken,
      tokenSymbol: e.tokenSymbol,
    })).reverse()

    return { chartData, totalOI, top5Share, tokenOI, noTokenOI }
  }, [exchanges])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Open Interest Distribution</h3>
        <p className="chart-subtitle">
          Open interest across perpetual exchanges
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          Open interest data unavailable.
        </p>
      </div>
    )
  }

  const chartHeight = Math.max(400, chartData.length * 28)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Open Interest Distribution</h3>
      <p className="chart-subtitle">
        Top perpetual exchanges by total open interest (USD)
      </p>
      <MetricInfo
        description="Open interest represents the total value of outstanding perpetual contracts. OI turnover (daily volume / open interest) shows how quickly positions are being opened and closed, while a low OI/VOL ratio signals capital is 'sticky.' Sudden OI spikes or drops often coincide with liquidation cascades and potential turning points."
        source="DefiLlama perps data for open interest by exchange. Volume and OI ratios computed from the same dataset."
      />

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
            tickFormatter={formatAxisOI}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: COLORS.paperAlt }} />
          <Bar dataKey="openInterest" radius={[0, 2, 2, 0]} animationDuration={800}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.hasToken ? TOKEN_COLOR : NO_TOKEN_COLOR}
                opacity={entry.hasToken ? 0.85 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="border-t border-rule mt-4 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="font-sans text-xs text-ink-muted">Total OI</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(totalOI, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Top-5 Concentration</p>
            <p className="font-mono text-sm font-bold text-ink">{top5Share.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Token Exchanges OI</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(tokenOI, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Non-Token OI</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(noTokenOI, true)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: TOKEN_COLOR, opacity: 0.85 }} />
            <span className="font-sans text-[11px] text-ink-muted">Has token</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: NO_TOKEN_COLOR, opacity: 0.6 }} />
            <span className="font-sans text-[11px] text-ink-muted">No token</span>
          </span>
        </div>
      </div>
    </div>
  )
}
