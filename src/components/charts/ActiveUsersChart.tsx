import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatNumber, formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

export function ActiveUsersChart({ exchanges }: Props) {
  const { rows, totalUsers } = useMemo(() => {
    const valid = exchanges
      .filter((e) => e.ttActiveUsers != null && e.ttActiveUsers > 0)
      .map((e) => ({
        name: e.displayName || e.name,
        users: e.ttActiveUsers!,
        volume24h: e.total24h ?? 0,
        revenuePerUser: e.ttRevenue != null && e.ttActiveUsers! > 0
          ? e.ttRevenue / e.ttActiveUsers!
          : null,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 15)

    return {
      rows: valid,
      totalUsers: valid.reduce((sum, r) => sum + r.users, 0),
    }
  }, [exchanges])

  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Active Users</h3>
        <p className="chart-subtitle">Verified user data not available</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Active Users by Protocol</h3>
      <p className="chart-subtitle">
        Weekly active users across perpetual exchange protocols
      </p>
      <MetricInfo
        description="Weekly active users (WAU) counts unique addresses interacting with each protocol. Higher user counts suggest broader adoption, while revenue-per-user reveals monetisation efficiency. Protocols with high volume but few users may rely on whale traders or bots."
        source="Active user counts based on unique on-chain addresses."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs text-ink-muted">Total WAU (tracked)</p>
          <p className="font-mono text-sm font-bold text-ink">{formatNumber(totalUsers)}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Protocols with Data</p>
          <p className="font-mono text-sm font-bold text-ink">{rows.length}</p>
        </div>
        <div>
          <p className="font-sans text-xs text-ink-muted">Avg Rev/User (top)</p>
          <p className="font-mono text-sm font-bold text-ink">
            {rows[0]?.revenuePerUser != null ? formatUSD(rows[0].revenuePerUser) : '\u2014'}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid {...GRID_STYLE} horizontal={false} />
          <XAxis
            type="number"
            {...AXIS_STYLE}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            {...AXIS_STYLE}
            width={75}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number) => [formatNumber(value), 'Active Users']}
          />
          <Bar dataKey="users" fill={COLORS.blue} radius={[0, 3, 3, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
