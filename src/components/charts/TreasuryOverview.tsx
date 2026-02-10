import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { TreasuryAgg } from '../../types'
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, COLORS } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  treasuryData: TreasuryAgg[]
}

export function TreasuryOverview({ treasuryData }: Props) {
  const data = useMemo(() =>
    treasuryData
      .filter(t => t.totalUsd > 100_000)
      .sort((a, b) => (b.stablecoinsUsd + b.majorsUsd) - (a.stablecoinsUsd + a.majorsUsd))
      .slice(0, 15)
      .map(t => ({
        name: t.name,
        Stablecoins: t.stablecoinsUsd,
        'BTC + ETH': t.majorsUsd,
        'Own Token': t.ownTokenUsd,
        Other: t.othersUsd,
        warChest: t.warChestRatio,
      })),
    [treasuryData]
  )

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Protocol Treasuries</h3>
        <p className="chart-subtitle">Loading treasury data...</p>
      </div>
    )
  }

  const totalSector = treasuryData.reduce((s, t) => s + t.totalUsd, 0)
  const totalStables = treasuryData.reduce((s, t) => s + t.stablecoinsUsd, 0)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Protocol Treasuries</h3>
      <p className="chart-subtitle">
        Sector total: {formatUSD(totalSector, true)} — Stablecoins: {formatUSD(totalStables, true)}
      </p>
      <MetricInfo
        description="Treasury composition across perp protocols. Stablecoins + majors (BTC/ETH) represent real reserves. Own-token holdings are circular and less meaningful."
        source="Protocol treasury balances including own tokens, stablecoins, and major assets."
      />

      <div className="mt-4" style={{ height: Math.max(350, data.length * 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
            <CartesianGrid {...GRID_STYLE} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatUSD(v, true)} {...AXIS_STYLE} />
            <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={75} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle as React.CSSProperties}
              formatter={(value: number, name: string) => [formatUSD(value, true), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Stablecoins" stackId="a" fill={COLORS.green} />
            <Bar dataKey="BTC + ETH" stackId="a" fill={COLORS.blue} />
            <Bar dataKey="Own Token" stackId="a" fill={COLORS.slate} fillOpacity={0.5} />
            <Bar dataKey="Other" stackId="a" fill={COLORS.rule} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
