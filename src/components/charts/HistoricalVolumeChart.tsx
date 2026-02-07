import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { HistoricalDataPoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDate } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: HistoricalDataPoint[]
}

function formatAxisDate(timestamp: number): string {
  const d = new Date(timestamp)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  // Show only the year at January ticks for cleaner axis labels;
  // show "Mon 'YY" for all other months
  return d.getMonth() === 0 ? `${year}` : `${month} '${String(year).slice(2)}`
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}) {
  if (!active || !payload || !payload.length || label == null) return null

  return (
    <div
      style={{
        ...TOOLTIP_STYLE.contentStyle,
        lineHeight: 1.5,
      }}
    >
      <p style={TOOLTIP_STYLE.labelStyle}>{formatDate(label)}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Volume: {formatUSD(payload[0].value, true)}
      </p>
    </div>
  )
}

export function HistoricalVolumeChart({ data }: Props) {
  const [period, setPeriod] = useState('1y')

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    return filterDataByPeriod(data, period)
  }, [data, period])

  return (
    <div className="chart-container">
      <h3 className="chart-title">Aggregate Perpetuals Volume</h3>
      <p className="chart-subtitle">
        Daily trading volume across perpetual exchanges, USD
      </p>
      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Aggregate perpetual volume tracks total daily trading activity across all tracked exchanges. Large divergences between perp volume and spot volume can signal increased speculation. Comparing perp and spot volume over time helps gauge trader preference for leverage vs. spot exposure."
          source="DefiLlama perps volume data aggregated across all exchanges. Spot volume available via DefiLlama DEX overview endpoint for comparison."
        />
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={filteredData}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="volumeAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.ink} stopOpacity={0.1} />
              <stop offset="100%" stopColor={COLORS.ink} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke={GRID_STYLE.stroke}
            strokeDasharray={GRID_STYLE.strokeDasharray}
          />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={formatAxisDate}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            minTickGap={60}
          />
          <YAxis
            tickFormatter={formatBillions}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.ink}
            strokeWidth={1.5}
            fill="url(#volumeAreaFill)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
