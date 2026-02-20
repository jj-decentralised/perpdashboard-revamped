import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

type ViewMode = 'bar' | 'pie'

const PIE_COLORS = [
  '#1a1a1a',
  '#2e5e8e',
  '#c1352d',
  '#2e7d4f',
  '#b8860b',
  '#64748b',
  '#94a3b8',
  '#475569',
  '#6b7280',
  '#cbd5e1',
  '#9ca3af',
  '#78716c',
]

function fmtAxis(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function TVLShareChart({ exchanges }: Props) {
  const [view, setView] = useState<ViewMode>('bar')
  const [showTokenOnly, setShowTokenOnly] = useState(false)

  const { chartData, totalTvl, topShare, exchangeCount } = useMemo(() => {
    const filtered = exchanges
      .filter((e) => e.tvl > 0 && (!showTokenOnly || e.hasToken))
      .sort((a, b) => b.tvl - a.tvl)

    const totalTvl = filtered.reduce((s, e) => s + e.tvl, 0)
    const exchangeCount = filtered.length

    const top15 = filtered.slice(0, 15)
    const othersVol = filtered.slice(15).reduce((s, e) => s + e.tvl, 0)

    const data = top15.map((e) => ({
      name: e.displayName || e.name,
      tvl: e.tvl,
      share: totalTvl > 0 ? (e.tvl / totalTvl) * 100 : 0,
      hasToken: e.hasToken,
    }))

    if (othersVol > 0) {
      data.push({
        name: `Others (${filtered.length - 15})`,
        tvl: othersVol,
        share: totalTvl > 0 ? (othersVol / totalTvl) * 100 : 0,
        hasToken: false,
      })
    }

    const topShare = data.length > 0 ? data[0].share : 0
    return { chartData: data, totalTvl, topShare, exchangeCount }
  }, [exchanges, showTokenOnly])

  if (chartData.length === 0) return null

  const barHeight = Math.max(400, chartData.length * 28)

  return (
    <div className="chart-container">
      <h3 className="chart-title">TVL Distribution</h3>
      <p className="chart-subtitle">
        Total value locked across perpetual exchanges — {formatUSD(totalTvl, true)} across {exchangeCount} exchanges
      </p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MetricInfo
            description="TVL measures capital deposited in exchange smart contracts. Higher TVL generally indicates deeper liquidity and greater trader confidence. TVL concentration across a few venues can signal systemic risk if a dominant exchange faces issues."
            source="Protocol TVL from DefiLlama. Only includes exchanges with reported TVL > 0."
          />
          <label className="flex items-center gap-1.5 font-sans text-xs text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showTokenOnly}
              onChange={(e) => setShowTokenOnly(e.target.checked)}
              className="accent-ink"
            />
            Token exchanges only
          </label>
        </div>
        <div className="flex items-center gap-1">
          {(['bar', 'pie'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={v === view
                ? 'px-2.5 py-1 border bg-ink text-paper border-ink font-semibold font-sans text-xs'
                : 'px-2.5 py-1 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
              type="button"
            >
              {v === 'bar' ? 'Bar' : 'Donut'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total TVL</p>
          <p className="font-mono text-sm font-bold text-ink">{formatUSD(totalTvl, true)}</p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Exchanges</p>
          <p className="font-mono text-sm font-bold text-ink">{exchangeCount}</p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Top Exchange</p>
          <p className="font-mono text-sm font-bold text-ink">{topShare.toFixed(1)}%</p>
          <p className="font-sans text-[10px] text-ink-muted">{chartData[0]?.name}</p>
        </div>
        <div>
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Top 5 Share</p>
          <p className="font-mono text-sm font-bold text-ink">
            {chartData.slice(0, 5).reduce((s, d) => s + d.share, 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {view === 'bar' && (
        <>
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 80, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke={GRID_STYLE.stroke}
                strokeDasharray={GRID_STYLE.strokeDasharray}
              />
              <XAxis
                type="number"
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: COLORS.rule }}
                tickFormatter={fmtAxis}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ ...AXIS_STYLE, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                      <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                        TVL: {formatUSD(d.tvl, true)}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                        Share: {d.share.toFixed(1)}%
                      </p>
                    </div>
                  )
                }}
                cursor={{ fill: COLORS.paperAlt }}
              />
              <Bar dataKey="tvl" radius={[0, 3, 3, 0]} maxBarSize={22} animationDuration={600}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={entry.hasToken ? COLORS.ink : COLORS.slate}
                    opacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.ink, opacity: 0.75 }} />
              <span className="font-sans text-[11px] text-ink-muted">Has governance token</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.slate, opacity: 0.75 }} />
              <span className="font-sans text-[11px] text-ink-muted">No token</span>
            </span>
          </div>
        </>
      )}

      {view === 'pie' && (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData.slice(0, 10)}
                cx="50%"
                cy="50%"
                outerRadius={150}
                innerRadius={70}
                dataKey="tvl"
                nameKey="name"
                paddingAngle={1}
                animationDuration={600}
              >
                {chartData.slice(0, 10).map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    stroke={COLORS.paper}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                      <p style={TOOLTIP_STYLE.labelStyle}>{d.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                        TVL: {formatUSD(d.tvl, true)}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: COLORS.inkLight }}>
                        Share: {d.share.toFixed(1)}%
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2">
            {chartData.slice(0, 10).map((slice, i) => (
              <div key={slice.name} className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 flex-shrink-0"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="font-sans text-xs text-ink truncate">
                  {slice.name}{' '}
                  <span className="text-ink-muted">{slice.share.toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
