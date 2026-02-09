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
  Cell,
} from 'recharts'
import type { CarryPairData, FundingRateEntry } from '../../types'
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, COLORS } from '../../utils/chartTheme'
import { formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  carryMetrics: CarryPairData[]
  fundingRateData: FundingRateEntry[]
}

export function FundingTermStructure({ carryMetrics, fundingRateData }: Props) {
  // Aggregate by asset: OI-weighted current, 7d, 30d rates for top assets
  const termStructureData = useMemo(() => {
    const assetMap = new Map<string, { oi: number; currentSum: number; avg7dSum: number; avg30dSum: number; avg7dOI: number; avg30dOI: number }>()

    for (const entry of fundingRateData) {
      if (!entry.baseAsset || !entry.fundingRate || !isFinite(entry.fundingRate)) continue
      const oi = entry.openInterest || 0
      if (oi < 10_000) continue

      const asset = entry.baseAsset.toUpperCase()
      const existing = assetMap.get(asset) || { oi: 0, currentSum: 0, avg7dSum: 0, avg30dSum: 0, avg7dOI: 0, avg30dOI: 0 }
      existing.oi += oi
      existing.currentSum += entry.fundingRate * oi
      if (entry.fundingRate7dAverage != null) {
        existing.avg7dSum += entry.fundingRate7dAverage * oi
        existing.avg7dOI += oi
      }
      if (entry.fundingRate30dAverage != null) {
        existing.avg30dSum += entry.fundingRate30dAverage * oi
        existing.avg30dOI += oi
      }
      assetMap.set(asset, existing)
    }

    return Array.from(assetMap.entries())
      .map(([asset, d]) => ({
        asset,
        oi: d.oi,
        current: d.oi > 0 ? (d.currentSum / d.oi) * 3 * 365 * 100 : 0,
        avg7d: d.avg7dOI > 0 ? (d.avg7dSum / d.avg7dOI) * 3 * 365 * 100 : 0,
        avg30d: d.avg30dOI > 0 ? (d.avg30dSum / d.avg30dOI) * 3 * 365 * 100 : 0,
      }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, 12)
  }, [fundingRateData])

  // Top carry opportunities
  const topCarry = useMemo(() =>
    carryMetrics
      .filter(c => Math.abs(c.carry) > 1)
      .sort((a, b) => b.carry - a.carry)
      .slice(0, 8),
    [carryMetrics]
  )

  if (termStructureData.length === 0) return null

  return (
    <div className="chart-container">
      <h3 className="chart-title">Funding Rate Term Structure</h3>
      <p className="chart-subtitle">
        Annualized carry yield by asset — current vs 7d vs 30d average, weighted by open interest
      </p>
      <MetricInfo
        description="Shows how funding rates have evolved. Rising current rates above 30d average indicates crowding. Falling rates may signal opportunity."
        source="yields.llama.fi"
      />

      <div className="mt-4" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={termStructureData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="asset" {...AXIS_STYLE} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} {...AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle as React.CSSProperties}
              formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="avg30d" name="30d Avg" fill={COLORS.slate} radius={[2, 2, 0, 0]} />
            <Bar dataKey="avg7d" name="7d Avg" fill={COLORS.blue} radius={[2, 2, 0, 0]} />
            <Bar dataKey="current" name="Current" fill={COLORS.ink} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Carry Leaderboard */}
      {topCarry.length > 0 && (
        <div className="mt-6">
          <h4 className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3">Top Carry Yields</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {topCarry.map((c) => (
              <div key={`${c.asset}-${c.marketplace}`} className="border border-rule p-3">
                <p className="font-mono text-xs text-ink-muted">{c.marketplace}</p>
                <p className="font-sans text-sm font-bold text-ink">{c.asset}</p>
                <p className={`font-mono text-lg font-bold ${c.carry >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {c.carry.toFixed(1)}%
                </p>
                <p className="font-mono text-[10px] text-ink-muted">
                  OI: ${(c.oi / 1e6).toFixed(0)}M
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
