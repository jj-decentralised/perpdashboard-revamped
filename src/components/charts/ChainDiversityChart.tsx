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
import type { EnrichedExchange } from '../../types'
import { COLORS, TOKEN_COLOR, NO_TOKEN_COLOR, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatNumber, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface BucketDatum {
  bucket: string
  withToken: number
  withoutToken: number
}

interface SummaryStats {
  avgChainsToken: number
  avgChainsNoToken: number
  pctSingleChainToken: number
  pctSingleChainNoToken: number
  topMultiChain: { name: string; chainCount: number; hasToken: boolean }[]
}

const BUCKET_RANGES: { label: string; min: number; max: number }[] = [
  { label: '1', min: 1, max: 1 },
  { label: '2–3', min: 2, max: 3 },
  { label: '4–5', min: 4, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11–20', min: 11, max: 20 },
  { label: '20+', min: 21, max: Infinity },
]

function getBucketLabel(chainCount: number): string {
  for (const range of BUCKET_RANGES) {
    if (chainCount >= range.min && chainCount <= range.max) {
      return range.label
    }
  }
  return '20+'
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length || label == null) return null

  return (
    <div
      style={{
        ...TOOLTIP_STYLE.contentStyle,
        lineHeight: 1.5,
      }}
    >
      <p style={TOOLTIP_STYLE.labelStyle}>
        {label} {label === '1' ? 'chain' : 'chains'}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function ChainDiversityChart({ exchanges }: Props) {
  const { chartData, stats } = useMemo(() => {
    const tokenExchanges = exchanges.filter((e) => e.hasToken)
    const noTokenExchanges = exchanges.filter((e) => !e.hasToken)

    // Build histogram buckets
    const bucketCounts: Record<string, { withToken: number; withoutToken: number }> = {}
    for (const range of BUCKET_RANGES) {
      bucketCounts[range.label] = { withToken: 0, withoutToken: 0 }
    }

    for (const ex of tokenExchanges) {
      const label = getBucketLabel(ex.chainCount)
      bucketCounts[label].withToken++
    }

    for (const ex of noTokenExchanges) {
      const label = getBucketLabel(ex.chainCount)
      bucketCounts[label].withoutToken++
    }

    const data: BucketDatum[] = BUCKET_RANGES.map((range) => ({
      bucket: range.label,
      withToken: bucketCounts[range.label].withToken,
      withoutToken: bucketCounts[range.label].withoutToken,
    }))

    // Summary statistics
    const avgChainsToken =
      tokenExchanges.length > 0
        ? tokenExchanges.reduce((sum, e) => sum + e.chainCount, 0) / tokenExchanges.length
        : 0

    const avgChainsNoToken =
      noTokenExchanges.length > 0
        ? noTokenExchanges.reduce((sum, e) => sum + e.chainCount, 0) / noTokenExchanges.length
        : 0

    const singleChainToken = tokenExchanges.filter((e) => e.chainCount === 1).length
    const singleChainNoToken = noTokenExchanges.filter((e) => e.chainCount === 1).length

    const pctSingleChainToken =
      tokenExchanges.length > 0 ? (singleChainToken / tokenExchanges.length) * 100 : 0

    const pctSingleChainNoToken =
      noTokenExchanges.length > 0 ? (singleChainNoToken / noTokenExchanges.length) * 100 : 0

    const topMultiChain = [...exchanges]
      .sort((a, b) => b.chainCount - a.chainCount)
      .slice(0, 5)
      .map((e) => ({
        name: e.name,
        chainCount: e.chainCount,
        hasToken: e.hasToken,
      }))

    const summary: SummaryStats = {
      avgChainsToken,
      avgChainsNoToken,
      pctSingleChainToken,
      pctSingleChainNoToken,
      topMultiChain,
    }

    return { chartData: data, stats: summary }
  }, [exchanges])

  return (
    <div className="chart-container">
      <h3 className="chart-title">Chain Deployment Strategy</h3>
      <p className="chart-subtitle">
        Multi-chain presence comparison between tokenised and non-tokenised exchanges
      </p>
      <MetricInfo
        description="Chain diversity measures how many distinct blockchains each exchange is deployed on. Protocols that expand to more chains can capture fragmented liquidity and reach new user bases, but multi-chain deployment also increases operational complexity and can dilute liquidity. Comparing token-bearing vs. non-token exchanges reveals whether tokenized governance models correlate with more aggressive cross-chain expansion strategies."
        source="Chain deployment data from protocol metadata. Each exchange's chain list is counted and bucketed into ranges for the histogram."
      />

      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="bucket"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            label={{
              value: 'Number of chains',
              position: 'insideBottom',
              offset: -2,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <YAxis
            allowDecimals={false}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Exchanges',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { ...AXIS_STYLE, fill: COLORS.inkMuted },
            }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: COLORS.paperAlt }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="square"
            iconSize={10}
            wrapperStyle={{
              fontSize: 11,
              fontFamily: AXIS_STYLE.fontFamily,
            }}
          />
          <Bar
            dataKey="withToken"
            name="With Token"
            fill={TOKEN_COLOR}
            radius={[2, 2, 0, 0]}
            animationDuration={800}
          />
          <Bar
            dataKey="withoutToken"
            name="Without Token"
            fill={NO_TOKEN_COLOR}
            radius={[2, 2, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary statistics */}
      <div className="border-t border-rule mt-6 pt-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average chains */}
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3">
              Avg. Chains per Exchange
            </p>
            <div className="flex items-baseline gap-4">
              <div>
                <span className="font-mono text-xl font-bold text-ink">
                  {formatNumber(stats.avgChainsToken, 1)}
                </span>
                <span className="font-sans text-xs text-ink-muted ml-1">
                  with token
                </span>
              </div>
              <span className="text-ink-muted">/</span>
              <div>
                <span className="font-mono text-xl font-bold" style={{ color: NO_TOKEN_COLOR }}>
                  {formatNumber(stats.avgChainsNoToken, 1)}
                </span>
                <span className="font-sans text-xs text-ink-muted ml-1">
                  without
                </span>
              </div>
            </div>
          </div>

          {/* Single-chain percentage */}
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3">
              Single-Chain Exchanges
            </p>
            <div className="flex items-baseline gap-4">
              <div>
                <span className="font-mono text-xl font-bold text-ink">
                  {formatNumber(stats.pctSingleChainToken, 1)}%
                </span>
                <span className="font-sans text-xs text-ink-muted ml-1">
                  with token
                </span>
              </div>
              <span className="text-ink-muted">/</span>
              <div>
                <span className="font-mono text-xl font-bold" style={{ color: NO_TOKEN_COLOR }}>
                  {formatNumber(stats.pctSingleChainNoToken, 1)}%
                </span>
                <span className="font-sans text-xs text-ink-muted ml-1">
                  without
                </span>
              </div>
            </div>
          </div>

          {/* Top multi-chain exchanges */}
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3">
              Most Multi-Chain
            </p>
            <ul className="space-y-1">
              {stats.topMultiChain.map((ex) => (
                <li key={ex.name} className="flex items-center justify-between text-sm">
                  <span className="font-sans text-ink truncate mr-2">
                    {ex.name}
                    {ex.hasToken ? (
                      <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{ backgroundColor: TOKEN_COLOR, verticalAlign: 'middle' }} />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{ backgroundColor: NO_TOKEN_COLOR, verticalAlign: 'middle' }} />
                    )}
                  </span>
                  <span className="font-mono text-ink-light whitespace-nowrap">
                    {formatNumber(ex.chainCount)} chains
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
