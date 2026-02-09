import { useMemo } from 'react'
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
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, COLORS } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

export function HolderYieldRanking({ exchanges }: Props) {
  const data = useMemo(() =>
    exchanges
      .filter(e => e.holderYield != null && e.holderYield > 0 && e.mcap && e.mcap > 0)
      .map(e => ({
        name: e.displayName || e.name,
        yield: e.holderYield!,
        mcap: e.mcap!,
        symbol: e.tokenSymbol,
      }))
      .sort((a, b) => b.yield - a.yield)
      .slice(0, 15),
    [exchanges]
  )

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Holder Yield Ranking</h3>
        <p className="chart-subtitle">Loading holder revenue data...</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Holder Yield Ranking</h3>
      <p className="chart-subtitle">
        Annualized revenue to token holders as % of market cap — the "dividend yield" of DeFi protocols
      </p>
      <MetricInfo
        description="Shows how much revenue each protocol distributes to token holders (via fee sharing, buybacks, staking rewards). Higher yield = more value accrual per dollar of market cap."
        source="DefiLlama Fees API"
      />

      <div className="mt-4" style={{ height: Math.max(300, data.length * 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
            <CartesianGrid {...GRID_STYLE} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} {...AXIS_STYLE} />
            <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={75} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle as React.CSSProperties}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'Holder Yield']}
              labelFormatter={(label) => {
                const d = data.find(d => d.name === label)
                return d ? `${label} (${d.symbol}) — Mcap: ${formatUSD(d.mcap, true)}` : label
              }}
            />
            <Bar dataKey="yield" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.yield > 5 ? COLORS.green : d.yield > 1 ? COLORS.blue : COLORS.slate} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
