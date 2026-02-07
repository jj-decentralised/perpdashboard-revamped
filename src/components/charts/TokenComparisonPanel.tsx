import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import type { TokenGroupStats } from '../../types'
import { formatUSD, formatPercent, formatNumber, percentClass } from '../../utils/format'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'

interface Props {
  tokenGroup: TokenGroupStats
  noTokenGroup: TokenGroupStats
}

interface ComparisonRow {
  label: string
  tokenValue: string
  noTokenValue: string
  tokenRaw?: number
  noTokenRaw?: number
  isPercent?: boolean
}

function buildComparisonRows(
  tokenGroup: TokenGroupStats,
  noTokenGroup: TokenGroupStats,
): ComparisonRow[] {
  return [
    {
      label: 'Number of Exchanges',
      tokenValue: formatNumber(tokenGroup.count),
      noTokenValue: formatNumber(noTokenGroup.count),
    },
    {
      label: 'Total 24h Volume',
      tokenValue: formatUSD(tokenGroup.totalVolume24h, true),
      noTokenValue: formatUSD(noTokenGroup.totalVolume24h, true),
    },
    {
      label: 'Total 30d Volume',
      tokenValue: formatUSD(tokenGroup.totalVolume30d, true),
      noTokenValue: formatUSD(noTokenGroup.totalVolume30d, true),
    },
    {
      label: 'Total Open Interest',
      tokenValue: formatUSD(tokenGroup.totalOI, true),
      noTokenValue: formatUSD(noTokenGroup.totalOI, true),
    },
    {
      label: 'Median 24h Volume',
      tokenValue: formatUSD(tokenGroup.medianVolume24h, true),
      noTokenValue: formatUSD(noTokenGroup.medianVolume24h, true),
    },
    {
      label: 'Total 24h Fees',
      tokenValue: formatUSD(tokenGroup.totalFees24h, true),
      noTokenValue: formatUSD(noTokenGroup.totalFees24h, true),
    },
    {
      label: 'Avg Daily Change',
      tokenValue: formatPercent(tokenGroup.avgChange1d),
      noTokenValue: formatPercent(noTokenGroup.avgChange1d),
      tokenRaw: tokenGroup.avgChange1d,
      noTokenRaw: noTokenGroup.avgChange1d,
      isPercent: true,
    },
    {
      label: 'Avg Weekly Change',
      tokenValue: formatPercent(tokenGroup.avgChange7d),
      noTokenValue: formatPercent(noTokenGroup.avgChange7d),
      tokenRaw: tokenGroup.avgChange7d,
      noTokenRaw: noTokenGroup.avgChange7d,
      isPercent: true,
    },
    {
      label: 'Avg Monthly Change',
      tokenValue: formatPercent(tokenGroup.avgChange1m),
      noTokenValue: formatPercent(noTokenGroup.avgChange1m),
      tokenRaw: tokenGroup.avgChange1m,
      noTokenRaw: noTokenGroup.avgChange1m,
      isPercent: true,
    },
    {
      label: 'Avg Chain Count',
      tokenValue: formatNumber(tokenGroup.avgChainCount, 1),
      noTokenValue: formatNumber(noTokenGroup.avgChainCount, 1),
    },
    {
      label: 'Volume/OI Ratio',
      tokenValue: formatNumber(tokenGroup.avgVolumeToOI, 2),
      noTokenValue: formatNumber(noTokenGroup.avgVolumeToOI, 2),
    },
  ]
}

function buildBarData(tokenGroup: TokenGroupStats, noTokenGroup: TokenGroupStats) {
  return [
    {
      metric: 'Volume 24h',
      'With Token': tokenGroup.totalVolume24h,
      'Without Token': noTokenGroup.totalVolume24h,
    },
    {
      metric: 'Open Interest',
      'With Token': tokenGroup.totalOI,
      'Without Token': noTokenGroup.totalOI,
    },
    {
      metric: 'Fees 24h',
      'With Token': tokenGroup.totalFees24h,
      'Without Token': noTokenGroup.totalFees24h,
    },
  ]
}

function deriveObservation(
  tokenGroup: TokenGroupStats,
  noTokenGroup: TokenGroupStats,
): string {
  const parts: string[] = []

  // Volume-to-OI comparison
  const vtlLeader =
    tokenGroup.avgVolumeToOI > noTokenGroup.avgVolumeToOI
      ? 'token-bearing'
      : 'non-token'
  const vtlDiff = Math.abs(tokenGroup.avgVolumeToOI - noTokenGroup.avgVolumeToOI)
  parts.push(
    `Exchanges with governance tokens show a ${vtlLeader === 'token-bearing' ? 'higher' : 'lower'} ` +
    `volume-to-OI ratio (${formatNumber(tokenGroup.avgVolumeToOI, 2)} vs. ` +
    `${formatNumber(noTokenGroup.avgVolumeToOI, 2)}), suggesting ` +
    `${vtlLeader === 'token-bearing' ? 'more capital-efficient trading activity' : 'comparatively lower capital turnover'}.`,
  )

  // Growth momentum comparison
  const tokenGrowth = tokenGroup.avgChange7d ?? 0
  const noTokenGrowth = noTokenGroup.avgChange7d ?? 0
  if (tokenGrowth > noTokenGrowth) {
    parts.push(
      `Token-bearing exchanges are growing faster on a weekly basis ` +
      `(${formatPercent(tokenGrowth)} vs. ${formatPercent(noTokenGrowth)}).`,
    )
  } else if (noTokenGrowth > tokenGrowth) {
    parts.push(
      `Non-token exchanges show stronger weekly momentum ` +
      `(${formatPercent(noTokenGrowth)} vs. ${formatPercent(tokenGrowth)}).`,
    )
  }

  // Multi-chain footprint
  if (tokenGroup.avgChainCount > noTokenGroup.avgChainCount) {
    parts.push(
      `Token-equipped protocols average ${formatNumber(tokenGroup.avgChainCount, 1)} chains ` +
      `compared to ${formatNumber(noTokenGroup.avgChainCount, 1)}, indicating broader cross-chain deployment.`,
    )
  }

  return parts.join(' ')
}

const barTooltipFormatter = (value: number) => formatUSD(value, true)

const yAxisTickFormatter = (value: number) => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value}`
}

export function TokenComparisonPanel({ tokenGroup, noTokenGroup }: Props) {
  const rows = useMemo(
    () => buildComparisonRows(tokenGroup, noTokenGroup),
    [tokenGroup, noTokenGroup],
  )

  const barData = useMemo(
    () => buildBarData(tokenGroup, noTokenGroup),
    [tokenGroup, noTokenGroup],
  )

  const observation = useMemo(
    () => deriveObservation(tokenGroup, noTokenGroup),
    [tokenGroup, noTokenGroup],
  )

  return (
    <section className="section-rule-heavy">
      {/* ── Section Header ── */}
      <header className="mb-8">
        <h2 className="font-serif text-2xl font-bold text-ink leading-tight">
          Token Classification Analysis
        </h2>
        <p className="font-sans text-sm text-ink-muted mt-1">
          How governance tokens correlate with exchange performance metrics
        </p>
      </header>

      {/* ── Side-by-side comparison table ── */}
      <div className="border border-rule bg-paper mb-8 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="text-left text-xs font-sans font-semibold uppercase tracking-wider text-ink-muted px-4 py-3">
                Metric
              </th>
              <th className="text-right text-xs font-sans font-semibold uppercase tracking-wider text-ink px-4 py-3">
                <span
                  className="inline-block w-2.5 h-2.5 mr-1.5 align-middle"
                  style={{ backgroundColor: TOKEN_COLOR }}
                />
                {tokenGroup.label}
              </th>
              <th className="text-right text-xs font-sans font-semibold uppercase tracking-wider text-ink px-4 py-3">
                <span
                  className="inline-block w-2.5 h-2.5 mr-1.5 align-middle"
                  style={{ backgroundColor: NO_TOKEN_COLOR }}
                />
                {noTokenGroup.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.label}
                className={idx % 2 === 1 ? 'bg-paper-alt' : 'bg-paper'}
              >
                <td className="text-sm font-sans text-ink-light px-4 py-2.5 border-b border-rule">
                  {row.label}
                </td>
                <td
                  className={`text-sm font-mono text-right px-4 py-2.5 border-b border-rule ${
                    row.isPercent ? percentClass(row.tokenRaw ?? null) : 'text-ink'
                  }`}
                >
                  {row.tokenValue}
                </td>
                <td
                  className={`text-sm font-mono text-right px-4 py-2.5 border-b border-rule ${
                    row.isPercent ? percentClass(row.noTokenRaw ?? null) : 'text-ink'
                  }`}
                >
                  {row.noTokenValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="font-sans text-[10px] text-ink-muted px-4 py-2 border-t border-rule">
          Change averages use winsorized means (capped at 1st/99th percentile) to limit outlier influence.
          {' '}{tokenGroup.count + noTokenGroup.count} exchanges tracked across both groups.
        </p>
      </div>

      {/* ── Grouped Bar Chart ── */}
      <div className="chart-container mb-8">
        <h3 className="chart-title">Key Metrics Comparison</h3>
        <p className="chart-subtitle">
          Aggregate volume, TVL, and fees by token classification
        </p>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 8, right: 24, left: 16, bottom: 0 }}
              barCategoryGap="25%"
              barGap={4}
            >
              <XAxis
                dataKey="metric"
                tick={AXIS_STYLE}
                axisLine={{ stroke: COLORS.rule }}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                tickFormatter={yAxisTickFormatter}
              />
              <Tooltip
                formatter={barTooltipFormatter}
                contentStyle={TOOLTIP_STYLE.contentStyle}
                labelStyle={TOOLTIP_STYLE.labelStyle}
                cursor={{ fill: COLORS.paperAlt }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  fontFamily: AXIS_STYLE.fontFamily,
                  paddingTop: 12,
                }}
              />
              <Bar
                dataKey="With Token"
                fill={TOKEN_COLOR}
                radius={[2, 2, 0, 0]}
                maxBarSize={64}
              />
              <Bar
                dataKey="Without Token"
                fill={NO_TOKEN_COLOR}
                radius={[2, 2, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Analytical Callout ── */}
      <div
        className="border-l-4 bg-paper-alt px-6 py-5"
        style={{ borderLeftColor: COLORS.ink }}
      >
        <p className="font-sans text-xs uppercase tracking-wider text-ink-muted font-semibold mb-2">
          Analyst Note
        </p>
        <p className="font-serif text-sm text-ink-light leading-relaxed">
          {observation}
        </p>
      </div>
    </section>
  )
}
