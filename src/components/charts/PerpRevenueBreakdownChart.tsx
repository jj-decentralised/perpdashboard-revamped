import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { FeeSharePoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  data: FeeSharePoint[]
  protocolNames: string[]
}

const AREA_COLORS = [
  '#1a1a1a',
  '#64748b',
  '#94a3b8',
  '#2e5e8e',
  '#c1352d',
  '#2e7d4f',
  '#b8860b',
  '#cbd5e1',
  '#e5e3e0',
]

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload || !payload.length || label == null) return null

  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))

  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5, maxWidth: 240 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{formatDateShort(label)}</p>
      {sorted.map((entry) => (
        <div
          key={entry.name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 11,
            color: COLORS.inkLight,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                backgroundColor: entry.color,
                flexShrink: 0,
              }}
            />
            {entry.name}
          </span>
          <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
            {(entry.value || 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export function PerpRevenueBreakdownChart({ data, protocolNames }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Perp Revenue Breakdown</h3>
        <p className="chart-subtitle">Loading historical fee breakdown data...</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Perp Revenue Breakdown</h3>
      <p className="chart-subtitle">
        Share of total perp fee revenue by protocol, monthly since 2022
      </p>
      <MetricInfo
        description="Shows how fee revenue is distributed among perpetual exchange protocols over time. Shifts in revenue share indicate changing competitive dynamics — a protocol gaining fee share is capturing more trading activity or charging higher take rates. The 'Other' category aggregates smaller protocols, and its growth signals an increasingly fragmented market."
        source="DefiLlama fees endpoint with historical breakdown. Monthly aggregation of daily fee data. Only protocols matching tracked perpetual exchanges are included."
      />

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          stackOffset="none"
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
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          {protocolNames.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stackId="share"
              fill={AREA_COLORS[i % AREA_COLORS.length]}
              stroke={AREA_COLORS[i % AREA_COLORS.length]}
              fillOpacity={0.85}
              strokeWidth={0}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {protocolNames.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 flex-shrink-0"
              style={{ backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
            />
            <span className="font-sans text-[11px] text-ink-light">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
