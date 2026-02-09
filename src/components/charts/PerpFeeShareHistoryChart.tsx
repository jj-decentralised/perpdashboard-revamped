import React from 'react'
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
import type { PerpFeeSharePoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatDateShort, formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  data: PerpFeeSharePoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload || !payload.length || label == null) return null

  const point = payload[0]?.payload as PerpFeeSharePoint | undefined
  if (!point) return null

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{formatDateShort(label)}</p>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.ink }}>
        <strong>{point.perpShare.toFixed(1)}%</strong> of DeFi fees
      </p>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.inkMuted }}>
        Perp fees: {formatUSD(point.perpFees, true)}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.inkMuted }}>
        Total DeFi: {formatUSD(point.totalFees, true)}
      </p>
    </div>
  )
}

export function PerpFeeShareHistoryChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Perps Share of DeFi Revenue</h3>
        <p className="chart-subtitle">Loading historical fee share data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  // Compute average share for context
  const avgShare = data.reduce((s, d) => s + d.perpShare, 0) / data.length
  const latestShare = data[data.length - 1]?.perpShare ?? 0

  return (
    <div className="chart-container">
      <h3 className="chart-title">Perps Share of DeFi Revenue</h3>
      <p className="chart-subtitle">
        What percentage of total DeFi protocol fees comes from perpetual exchanges, monthly since 2022
      </p>
      <MetricInfo
        description="Tracks the perpetual exchange sector's contribution to overall DeFi fee revenue over time. A rising share signals that derivatives trading is becoming a larger part of the DeFi economy, reflecting increased demand for leveraged exposure. Declines may indicate that other DeFi verticals (lending, DEXs, staking) are growing faster, or that perp trading activity is cooling off."
        source="DefiLlama /overview/fees endpoint. Total DeFi fees include all tracked protocols across all categories. Perp fees are the subset matching tracked perpetual exchange protocols. Monthly aggregation of daily data."
      />

      {/* Summary stats */}
      <div className="flex gap-6 mb-4">
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Current</p>
          <p className="font-mono text-xl font-bold text-ink">{latestShare.toFixed(1)}%</p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Avg since 2022</p>
          <p className="font-mono text-xl font-bold text-ink-light">{avgShare.toFixed(1)}%</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v: number) => formatDateShort(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            minTickGap={60}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Shaded area under the line */}
          <Area
            type="monotone"
            dataKey="perpShare"
            fill={COLORS.ink}
            fillOpacity={0.08}
            stroke="none"
          />
          {/* Main line */}
          <Line
            type="monotone"
            dataKey="perpShare"
            stroke={COLORS.ink}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: COLORS.ink, stroke: COLORS.paper, strokeWidth: 2 }}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
