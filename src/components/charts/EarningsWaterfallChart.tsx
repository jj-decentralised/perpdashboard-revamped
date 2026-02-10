import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface WaterfallRow {
  name: string
  revenue: number
  incentives: number
  earnings: number
}

export function EarningsWaterfallChart({ exchanges }: Props) {
  const rows = useMemo(() => {
    return exchanges
      .filter((e) => e.ttRevenue != null && e.ttRevenue > 0)
      .map((e): WaterfallRow => ({
        name: e.displayName || e.name,
        revenue: e.ttRevenue!,
        incentives: e.ttTokenIncentives ?? 0,
        earnings: e.ttEarnings ?? (e.ttRevenue! - (e.ttTokenIncentives ?? 0)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15)
  }, [exchanges])

  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Revenue vs Earnings</h3>
        <p className="chart-subtitle">Verified revenue data not available</p>
      </div>
    )
  }

  const data = rows.map((r) => ({
    name: r.name,
    revenue: r.revenue,
    incentives: -r.incentives,
    earnings: r.earnings,
  }))

  return (
    <div className="chart-container">
      <h3 className="chart-title">Revenue vs Earnings</h3>
      <p className="chart-subtitle">
        Daily revenue, token incentive costs, and net earnings by protocol
      </p>
      <MetricInfo
        description="Compares protocol-reported revenue with token incentive costs to show real earnings. Protocols with earnings significantly below revenue are spending heavily on token emissions to acquire users — a potential sustainability concern. Positive earnings indicate protocols that generate more revenue than they distribute in incentives."
        source="Revenue and token incentive data verified against on-chain protocol metrics."
      />

      <div className="flex flex-wrap gap-4 mb-4 font-sans text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.blue }} />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.red }} />
          Token Incentives
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.green }} />
          Net Earnings
        </span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            dataKey="name"
            {...AXIS_STYLE}
            angle={-45}
            textAnchor="end"
            interval={0}
            height={80}
          />
          <YAxis
            {...AXIS_STYLE}
            tickFormatter={(v: number) => formatUSD(Math.abs(v), true)}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number, name: string) => {
              const label = name === 'revenue' ? 'Revenue' : name === 'incentives' ? 'Incentives' : 'Earnings'
              return [formatUSD(Math.abs(value)), label]
            }}
          />
          <ReferenceLine y={0} stroke={COLORS.rule} />
          <Bar dataKey="revenue" fill={COLORS.blue} radius={[2, 2, 0, 0]} />
          <Bar dataKey="incentives" radius={[0, 0, 2, 2]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS.red} />
            ))}
          </Bar>
          <Bar dataKey="earnings" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.earnings >= 0 ? COLORS.green : COLORS.red} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
