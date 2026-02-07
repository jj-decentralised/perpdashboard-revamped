import React, { useMemo } from 'react'
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
import { formatUSD, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface ChartRow {
  name: string
  fees: number
  volumeScaled: number
  hasToken: boolean
  tokenSymbol: string | null
  rawVolume: number
}

interface GroupSummary {
  label: string
  count: number
  totalFees: number
  totalVolume: number
  feeEfficiency: number | null
}

function formatCompact(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: ChartRow }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  const row = payload[0].payload

  return (
    <div
      style={{
        ...TOOLTIP_STYLE.contentStyle,
        lineHeight: 1.6,
      }}
    >
      <p style={TOOLTIP_STYLE.labelStyle}>
        {label}
        {row.hasToken && row.tokenSymbol ? ` (${row.tokenSymbol})` : ''}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        24h Fees: {formatUSD(row.fees, true)}
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        24h Volume: {formatUSD(row.rawVolume, true)}
      </p>
      {row.rawVolume > 0 && (
        <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 11 }}>
          Fee/Volume: {(row.fees / row.rawVolume * 100).toFixed(4)}%
        </p>
      )}
    </div>
  )
}

export function FeeRevenueChart({ exchanges }: Props) {
  const [useLogScale, setUseLogScale] = React.useState(false)
  const chartData = useMemo<ChartRow[]>(() => {
    return exchanges
      .filter(
        (e) =>
          e.feeData != null &&
          e.feeData.total24h != null &&
          e.feeData.total24h > 0
      )
      .sort((a, b) => (b.feeData!.total24h ?? 0) - (a.feeData!.total24h ?? 0))
      .slice(0, 15)
      .map((e) => ({
        name: e.name,
        fees: e.feeData!.total24h!,
        volumeScaled: (e.total24h ?? 0) / 1000,
        hasToken: e.hasToken,
        tokenSymbol: e.tokenSymbol,
        rawVolume: e.total24h ?? 0,
      }))
  }, [exchanges])

  const groupSummaries = useMemo<GroupSummary[]>(() => {
    const tokenExchanges = chartData.filter((r) => r.hasToken)
    const noTokenExchanges = chartData.filter((r) => !r.hasToken)

    function summarize(label: string, rows: ChartRow[]): GroupSummary {
      const totalFees = rows.reduce((sum, r) => sum + r.fees, 0)
      const totalVolume = rows.reduce((sum, r) => sum + r.rawVolume, 0)
      return {
        label,
        count: rows.length,
        totalFees,
        totalVolume,
        feeEfficiency: totalVolume > 0 ? (totalFees / totalVolume) * 100 : null,
      }
    }

    return [
      summarize('Token Exchanges', tokenExchanges),
      summarize('Non-Token Exchanges', noTokenExchanges),
    ]
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Fee Revenue Analysis</h3>
        <p className="chart-subtitle">
          Perpetual exchange fee generation and capital efficiency, 24-hour snapshot
        </p>
        <p className="font-sans text-sm text-ink-muted py-12 text-center">
          No fee data available.
        </p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Fee Revenue Analysis</h3>
      <p className="chart-subtitle">
        Protocol fee generation and capital efficiency, 24-hour snapshot
      </p>
      <MetricInfo
        description="Fee revenue analysis breaks down how much each protocol earns from trading activity. The fee/volume ratio (take rate) measures capital efficiency — lower rates attract more volume but generate less revenue per trade. Comparing tokenised vs non-tokenised exchange fee structures reveals how governance token incentives affect pricing."
        source="DefiLlama fees endpoint for 24h fee data. Take rate computed as fees / volume in basis points."
      />

      <div className="flex justify-end mb-2">
        <button
          onClick={() => setUseLogScale(!useLogScale)}
          className="font-sans text-[11px] text-ink-muted border border-rule px-2 py-0.5 hover:border-ink transition-colors"
        >
          {useLogScale ? 'Linear scale' : 'Log scale'}
        </button>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, bottom: 60, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="name"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            angle={-40}
            textAnchor="end"
            interval={0}
            height={80}
          />
          <YAxis
            scale={useLogScale ? 'log' : 'auto'}
            domain={useLogScale ? ['auto', 'auto'] : [0, 'auto']}
            tickFormatter={formatCompact}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={62}
            allowDataOverflow={useLogScale}
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
              color: COLORS.inkLight,
              paddingBottom: 8,
            }}
          />
          <Bar
            dataKey="fees"
            name="24h Fees"
            fill="#1a1a1a"
            radius={[2, 2, 0, 0]}
            animationDuration={800}
          />
          <Bar
            dataKey="volumeScaled"
            name="24h Volume / 1000"
            fill="#94a3b8"
            radius={[2, 2, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Fee Efficiency Summary Table */}
      <div className="border-t border-rule mt-6 pt-4">
        <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-3 font-semibold">
          Fee Efficiency by Classification
        </p>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Group</th>
              <th>Protocols</th>
              <th>Total 24h Fees</th>
              <th>Total 24h Volume</th>
              <th>Fee / Volume</th>
            </tr>
          </thead>
          <tbody>
            {groupSummaries.map((g) => (
              <tr key={g.label}>
                <td className="font-sans">
                  <span
                    className="inline-block w-2.5 h-2.5 mr-2"
                    style={{
                      backgroundColor:
                        g.label === 'Token Exchanges'
                          ? TOKEN_COLOR
                          : NO_TOKEN_COLOR,
                    }}
                  />
                  {g.label}
                </td>
                <td>{g.count}</td>
                <td>{formatUSD(g.totalFees, true)}</td>
                <td>{formatUSD(g.totalVolume, true)}</td>
                <td>
                  {g.feeEfficiency != null
                    ? `${g.feeEfficiency.toFixed(4)}%`
                    : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
