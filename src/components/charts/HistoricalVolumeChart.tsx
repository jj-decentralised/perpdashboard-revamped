import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
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

type ViewMode = 'daily' | 'monthly' | 'cumulative'

function formatAxisDate(timestamp: number): string {
  const d = new Date(timestamp)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  return d.getMonth() === 0 ? `${year}` : `${month} '${String(year).slice(2)}`
}

function formatBillions(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

function formatMonthLabel(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

interface MonthlyPoint {
  date: number
  value: number
  monthLabel: string
}

interface CumulativePoint {
  date: number
  value: number
  cumulative: number
  monthLabel: string
}

function aggregateMonthly(data: HistoricalDataPoint[]): MonthlyPoint[] {
  const buckets = new Map<string, { date: number; sum: number }>()
  for (const d of data) {
    const dt = new Date(d.date)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    const existing = buckets.get(key)
    if (existing) {
      existing.sum += d.value
    } else {
      // Use the 1st of the month as the date
      buckets.set(key, { date: new Date(dt.getFullYear(), dt.getMonth(), 1).getTime(), sum: d.value })
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.date - b.date)
    .map((b) => ({ date: b.date, value: b.sum, monthLabel: formatMonthLabel(b.date) }))
}

function buildCumulative(monthly: MonthlyPoint[]): CumulativePoint[] {
  let running = 0
  return monthly.map((m) => {
    running += m.value
    return { ...m, cumulative: running }
  })
}

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: number }) {
  if (!active || !payload || !payload.length || label == null) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{formatDate(label)}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>Volume: {formatUSD(payload[0].value, true)}</p>
    </div>
  )
}

function MonthlyTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.monthLabel}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>Monthly Volume: {formatUSD(d.value, true)}</p>
    </div>
  )
}

function CumulativeTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.monthLabel}</p>
      <p style={{ margin: 0, color: COLORS.ink, fontWeight: 600 }}>Cumulative: {formatUSD(d.cumulative, true)}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>This Month: {formatUSD(d.value, true)}</p>
    </div>
  )
}

export function HistoricalVolumeChart({ data }: Props) {
  const [period, setPeriod] = useState('1y')
  const [view, setView] = useState<ViewMode>('daily')

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    return filterDataByPeriod(data, period)
  }, [data, period])

  const monthlyData = useMemo(() => aggregateMonthly(filteredData), [filteredData])
  const cumulativeData = useMemo(() => buildCumulative(aggregateMonthly(data)), [data])

  // Filter cumulative data by period
  const filteredCumulative = useMemo(() => {
    return filterDataByPeriod(cumulativeData, period)
  }, [cumulativeData, period])

  return (
    <div className="chart-container">
      <h3 className="chart-title">Aggregate Perpetuals Volume</h3>
      <p className="chart-subtitle">
        {view === 'daily' && 'Daily trading volume across perpetual exchanges, USD'}
        {view === 'monthly' && 'Monthly trading volume across perpetual exchanges, USD'}
        {view === 'cumulative' && 'Cumulative monthly trading volume across perpetual exchanges, USD'}
      </p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MetricInfo
            description="Aggregate perpetual volume tracks total daily trading activity across all tracked exchanges. Large divergences between perp volume and spot volume can signal increased speculation. Comparing perp and spot volume over time helps gauge trader preference for leverage vs. spot exposure."
            source="DefiLlama perps volume data aggregated across all exchanges. Spot volume available via DefiLlama DEX overview endpoint for comparison."
          />
          <div className="flex items-center gap-1">
            {(['daily', 'monthly', 'cumulative'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={v === view
                  ? 'px-2.5 py-1 border bg-ink text-paper border-ink font-semibold font-sans text-xs'
                  : 'px-2.5 py-1 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-xs cursor-pointer'}
                type="button"
              >
                {v === 'daily' ? 'Daily' : v === 'monthly' ? 'Monthly' : 'Cumulative'}
              </button>
            ))}
          </div>
        </div>
        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {view === 'daily' && (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={filteredData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="volumeAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.ink} stopOpacity={0.1} />
                <stop offset="100%" stopColor={COLORS.ink} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={formatAxisDate} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
            <YAxis tickFormatter={formatBillions} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
            <Tooltip content={<DailyTooltip />} cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="value" stroke={COLORS.ink} strokeWidth={1.5} fill="url(#volumeAreaFill)" animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {view === 'monthly' && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
            <XAxis dataKey="monthLabel" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} interval={monthlyData.length > 24 ? Math.floor(monthlyData.length / 12) - 1 : 0} />
            <YAxis tickFormatter={formatBillions} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
            <Tooltip content={<MonthlyTooltip />} cursor={{ fill: COLORS.paperAlt }} />
            <Bar dataKey="value" fill={COLORS.ink} opacity={0.7} radius={[2, 2, 0, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {view === 'cumulative' && (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={filteredCumulative} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.12} />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
            <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={formatAxisDate} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
            <YAxis tickFormatter={formatBillions} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={68} />
            <Tooltip content={<CumulativeTooltip />} cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="cumulative" stroke={COLORS.green} strokeWidth={2} fill="url(#cumulativeFill)" animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
