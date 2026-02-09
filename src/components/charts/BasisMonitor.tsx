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
import type { BasisMetrics } from '../../types'
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, COLORS } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  basisMetrics: BasisMetrics
}

export function BasisMonitor({ basisMetrics }: Props) {
  const chartData = useMemo(() =>
    basisMetrics.topAssets
      .filter(a => a.oi > 100_000)
      .slice(0, 15)
      .map(a => ({
        asset: a.asset,
        basis: Math.round(a.basisBps * 100) / 100,
        oi: a.oi,
      })),
    [basisMetrics]
  )

  if (chartData.length === 0) return null

  return (
    <div className="chart-container">
      <h3 className="chart-title">Perpetual Basis Monitor</h3>
      <p className="chart-subtitle">
        Mark-to-index premium in basis points — positive = perp trades above spot (bullish), negative = below (bearish)
      </p>
      <MetricInfo
        description="The basis measures how much a perpetual contract deviates from the spot price. A persistent positive basis signals bullish positioning across the market."
        source="yields.llama.fi"
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
        <div className="border border-rule p-3">
          <p className="font-sans text-[10px] uppercase tracking-wider text-ink-muted">BTC Basis</p>
          <p className={`font-mono text-xl font-bold ${(basisMetrics.btcBasisBps ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {basisMetrics.btcBasisBps != null ? `${basisMetrics.btcBasisBps.toFixed(1)} bps` : '—'}
          </p>
        </div>
        <div className="border border-rule p-3">
          <p className="font-sans text-[10px] uppercase tracking-wider text-ink-muted">ETH Basis</p>
          <p className={`font-mono text-xl font-bold ${(basisMetrics.ethBasisBps ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {basisMetrics.ethBasisBps != null ? `${basisMetrics.ethBasisBps.toFixed(1)} bps` : '—'}
          </p>
        </div>
        <div className="border border-rule p-3">
          <p className="font-sans text-[10px] uppercase tracking-wider text-ink-muted">Market Avg</p>
          <p className={`font-mono text-xl font-bold ${(basisMetrics.marketWideBasisBps ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {basisMetrics.marketWideBasisBps != null ? `${basisMetrics.marketWideBasisBps.toFixed(1)} bps` : '—'}
          </p>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div style={{ height: Math.max(300, chartData.length * 28) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 50 }}>
            <CartesianGrid {...GRID_STYLE} horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v} bps`} {...AXIS_STYLE} />
            <YAxis type="category" dataKey="asset" {...AXIS_STYLE} width={50} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle as React.CSSProperties}
              formatter={(value: number) => [`${value.toFixed(2)} bps`, 'Basis']}
              labelFormatter={(label) => `${label} — OI: ${formatUSD(chartData.find(d => d.asset === label)?.oi || 0, true)}`}
            />
            <Bar dataKey="basis" radius={[0, 3, 3, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.basis >= 0 ? COLORS.green : COLORS.red} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
