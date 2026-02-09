import { useMemo } from 'react'
import {
  ResponsiveContainer,
  Treemap,
  Tooltip,
} from 'recharts'
import type { AssetOIEntry } from '../../types'
import { TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  assetOIBreakdown: AssetOIEntry[]
}

function TreemapContent({ x, y, width, height, name, share }: any) {
  if (width < 40 || height < 25) return null
  return (
    <g>
      <text x={x + 6} y={y + 16} fontSize={width > 80 ? 12 : 10} fontWeight="bold" fill="#fff" fontFamily="sans-serif">
        {name}
      </text>
      {height > 38 && (
        <text x={x + 6} y={y + 30} fontSize={10} fill="rgba(255,255,255,0.8)" fontFamily="monospace">
          {share?.toFixed(1)}%
        </text>
      )}
    </g>
  )
}

export function AssetOIBreakdown({ assetOIBreakdown }: Props) {
  const treemapData = useMemo(() =>
    assetOIBreakdown
      .filter(a => a.share >= 0.5)
      .map((a, i) => ({
        name: a.asset,
        size: a.totalOI,
        share: a.share,
        fill: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    [assetOIBreakdown]
  )

  if (treemapData.length === 0) return null

  const top3Share = assetOIBreakdown.slice(0, 3).reduce((s, a) => s + a.share, 0)

  return (
    <div className="chart-container">
      <h3 className="chart-title">Open Interest by Asset</h3>
      <p className="chart-subtitle">
        Global OI distribution across {assetOIBreakdown.length} assets — top 3 account for {top3Share.toFixed(0)}%
      </p>
      <MetricInfo
        description="Shows which assets dominate open interest across all exchanges. High concentration in BTC/ETH means the market is less diversified."
        source="yields.llama.fi"
      />

      <div className="mt-4" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<TreemapContent />}
          >
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle as React.CSSProperties}
              formatter={(value: number) => [formatUSD(value, true), 'Open Interest']}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload
                return d ? `${d.name} — ${d.share?.toFixed(1)}% of total` : ''
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Top assets table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-rule">
              <th className="text-left py-1.5 font-sans text-[10px] uppercase tracking-wider text-ink-muted">Asset</th>
              <th className="text-right py-1.5 font-sans text-[10px] uppercase tracking-wider text-ink-muted">Open Interest</th>
              <th className="text-right py-1.5 font-sans text-[10px] uppercase tracking-wider text-ink-muted">Share</th>
            </tr>
          </thead>
          <tbody>
            {assetOIBreakdown.slice(0, 10).map((a) => (
              <tr key={a.asset} className="border-b border-rule/50">
                <td className="py-1.5 font-sans text-sm font-semibold text-ink">{a.asset}</td>
                <td className="text-right py-1.5">{formatUSD(a.totalOI, true)}</td>
                <td className="text-right py-1.5">{a.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
