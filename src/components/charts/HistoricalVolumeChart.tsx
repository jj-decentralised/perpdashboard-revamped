import React, { useMemo } from 'react'
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
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []

    const fourYearsAgo = Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000
    const recent = data.filter((d) => d.date >= fourYearsAgo)

    // If filtering would leave us with less data than the full set,
    // use the filtered subset; otherwise show everything
    return recent.length < data.length ? recent : data
  }, [data])

  return (
    <div className="chart-container">
      <h3 className="chart-title">Aggregate Perpetuals Volume</h3>
      <p className="chart-subtitle">
        Daily trading volume across perpetual exchanges, USD
      </p>
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
