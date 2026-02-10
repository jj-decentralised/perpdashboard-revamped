import React, { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, ZAxis, LabelList } from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface DataPoint {
  name: string
  incentiveRatio: number
  revenue: number
  users: number
}

export function IncentiveSustainabilityChart({ exchanges }: Props) {
  const data = useMemo(() => {
    return exchanges
      .filter(
        (e) =>
          e.ttRevenue != null &&
          e.ttRevenue > 0 &&
          e.ttTokenIncentives != null
      )
      .map((e): DataPoint => ({
        name: e.displayName || e.name,
        incentiveRatio: e.ttTokenIncentives! > 0
          ? (e.ttTokenIncentives! / e.ttRevenue!) * 100
          : 0,
        revenue: e.ttRevenue!,
        users: e.ttActiveUsers ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)
  }, [exchanges])

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Incentive Sustainability</h3>
        <p className="chart-subtitle">Verified revenue data not available</p>
      </div>
    )
  }

  const sustainable = data.filter((d) => d.incentiveRatio < 100).length
  const unsustainable = data.length - sustainable

  return (
    <div className="chart-container">
      <h3 className="chart-title">Incentive Sustainability</h3>
      <p className="chart-subtitle">
        Token incentive costs as percentage of revenue — below 100% is sustainable
      </p>
      <MetricInfo
        description="Maps each protocol's token incentive spend against its revenue. Protocols below the 100% line earn more than they pay out in incentives (sustainable). Above the line, they're spending more on incentives than they earn — effectively subsidising growth. Bubble size represents daily revenue."
        source="Revenue and token incentive data from verified on-chain protocol metrics."
      />

      <div className="grid grid-cols-2 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs text-ink-muted">Sustainable (incentives &lt; revenue)</p>
          <p className="font-mono text-sm font-bold" style={{ color: COLORS.green }}>{sustainable}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Unsustainable (incentives &gt; revenue)</p>
          <p className="font-mono text-sm font-bold" style={{ color: COLORS.red }}>{unsustainable}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            type="number"
            dataKey="revenue"
            name="Revenue"
            {...AXIS_STYLE}
            tickFormatter={(v: number) => formatUSD(v, true)}
            label={{ value: 'Daily Revenue', position: 'insideBottomRight', offset: -10, style: { ...AXIS_STYLE, fill: COLORS.inkMuted } }}
          />
          <YAxis
            type="number"
            dataKey="incentiveRatio"
            name="Incentive Ratio"
            {...AXIS_STYLE}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            label={{ value: 'Incentives / Revenue %', angle: -90, position: 'insideLeft', offset: 10, style: { ...AXIS_STYLE, fill: COLORS.inkMuted } }}
          />
          <ZAxis type="number" dataKey="revenue" range={[40, 400]} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number, name: string) => {
              if (name === 'Revenue') return [formatUSD(value), name]
              if (name === 'Incentive Ratio') return [`${value.toFixed(1)}%`, 'Incentives/Revenue']
              return [value, name]
            }}
          />
          <ReferenceLine y={100} stroke={COLORS.red} strokeDasharray="4 4" label={{ value: '100% — break-even', position: 'right', fill: COLORS.red, fontSize: 11 }} />
          <Scatter data={data} fill={COLORS.blue} fillOpacity={0.7} stroke={COLORS.ink} strokeWidth={1}>
            <LabelList dataKey="name" position="top" style={{ fontSize: 10, fill: COLORS.inkMuted }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
