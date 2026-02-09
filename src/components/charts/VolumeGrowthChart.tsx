import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import type { EnrichedExchange } from '../../types'
import { COLORS, AXIS_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

export function VolumeGrowthChart({ exchanges }: Props) {
  const [metric, setMetric] = useState<'wow' | 'mom'>('wow')

  const { chartData, breakouts } = useMemo(() => {
    const changeKey = metric === 'wow' ? 'change_7dover7d' : 'change_30dover30d'

    const valid = exchanges.filter((e) => {
      const change = metric === 'wow' ? e.change_7dover7d : e.change_30dover30d
      return change != null && isFinite(change) && (e.total24h || 0) > 100000
    })

    // Cap extreme values for display
    const mapped = valid.map((e) => {
      const rawChange = metric === 'wow' ? e.change_7dover7d! : e.change_30dover30d!
      const change = Math.max(-100, Math.min(500, rawChange))
      return {
        name: e.displayName || e.name,
        slug: e.slug,
        change,
        rawChange,
        volume24h: e.total24h || 0,
        volume7d: e.total7d || 0,
        hasToken: e.hasToken,
        tokenSymbol: e.tokenSymbol,
      }
    })

    // Sort by change rate and take top/bottom
    const sorted = [...mapped].sort((a, b) => b.change - a.change)
    const top10 = sorted.slice(0, 10)
    const bottom5 = sorted.slice(-5).reverse()
    const chartData = [...top10, ...bottom5]

    // Breakout detection: WoW change > 100% AND 24h volume > $10M
    const breakouts = exchanges
      .filter((e) => {
        const change7d = e.change_7d
        return change7d != null && change7d > 100 && (e.total24h || 0) > 10_000_000
      })
      .sort((a, b) => (b.change_7d || 0) - (a.change_7d || 0))
      .slice(0, 5)
      .map((e) => ({
        name: e.displayName || e.name,
        change: e.change_7d!,
        volume: e.total24h || 0,
        hasToken: e.hasToken,
        tokenSymbol: e.tokenSymbol,
      }))

    return { chartData, breakouts }
  }, [exchanges, metric])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Volume Growth Acceleration</h3>
        <p className="chart-subtitle">Protocol growth rate data unavailable</p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Volume Growth Acceleration</h3>
      <p className="chart-subtitle">
        {metric === 'wow' ? 'Week-over-week' : 'Month-over-month'} volume growth rate by exchange
      </p>
      <MetricInfo
        description="Growth acceleration shows which protocols are gaining or losing momentum. Week-over-week and month-over-month changes reveal trends before they show up in raw volume. Breakout detection flags exchanges with >100% weekly growth and >$10M daily volume, catching new protocols gaining traction."
        source="Derivatives overview with week-over-week and month-over-month growth metrics per protocol."
      />

      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setMetric('wow')}
          className={metric === 'wow' ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs' : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
          type="button"
        >
          Week / Week
        </button>
        <button
          onClick={() => setMetric('mom')}
          className={metric === 'mom' ? 'px-3 py-1.5 border bg-ink text-paper border-ink font-semibold font-sans text-xs' : 'px-3 py-1.5 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
          type="button"
        >
          Month / Month
        </button>
      </div>

      {breakouts.length > 0 && (
        <div className="mb-5 p-3 border-2 border-accent-green bg-paper">
          <p className="font-sans text-xs font-bold text-accent-green uppercase tracking-wider mb-2">
            Breakout Alert — {breakouts.length} exchange{breakouts.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {breakouts.map((b) => (
              <div key={b.name} className="flex items-center justify-between font-sans text-xs">
                <span className="text-ink font-medium">
                  {b.name}
                  {b.hasToken && b.tokenSymbol && (
                    <span className="ml-1.5 px-1 py-0.5 text-[10px] font-mono bg-paper-alt text-ink-light border border-rule">{b.tokenSymbol}</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-accent-green font-bold">+{b.change.toFixed(0)}%</span>
                  <span className="font-mono text-ink-muted">{formatUSD(b.volume, true)}/d</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={Math.max(400, chartData.length * 28 + 40)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 50, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
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
                  <p style={{ margin: 0, color: d.change >= 0 ? COLORS.green : COLORS.red, fontSize: 12, fontWeight: 600 }}>
                    {metric === 'wow' ? 'WoW' : 'MoM'}: {d.rawChange >= 0 ? '+' : ''}{d.rawChange.toFixed(1)}%
                  </p>
                  <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                    24h Volume: {formatUSD(d.volume24h, true)}
                  </p>
                  <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
                    7d Volume: {formatUSD(d.volume7d, true)}
                  </p>
                  {d.tokenSymbol && (
                    <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>Token: {d.tokenSymbol}</p>
                  )}
                </div>
              )
            }}
            cursor={{ fill: COLORS.paperAlt }}
          />
          <ReferenceLine x={0} stroke={COLORS.ink} strokeWidth={1} />
          <Bar dataKey="change" radius={[0, 2, 2, 0]} animationDuration={800} maxBarSize={18}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.change >= 0 ? COLORS.green : COLORS.red}
                opacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
