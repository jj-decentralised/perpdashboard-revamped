import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { LongShortPoint } from '../../services/coinglass'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: Record<string, LongShortPoint[]>
}

const AVG_KEY = 'Average'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={{ ...TOOLTIP_STYLE.labelStyle, margin: 0 }}>{formatDateShort(label)}</p>
      <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>
        Long: {d.longPct.toFixed(1)}%
      </p>
      <p style={{ margin: 0, color: COLORS.red, fontSize: 12 }}>
        Short: {d.shortPct.toFixed(1)}%
      </p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        L/S Ratio: {d.ratio.toFixed(2)}
      </p>
    </div>
  )
}

/** Compute average long/short across all exchanges for each timestamp. */
function computeAverage(allData: Record<string, LongShortPoint[]>): LongShortPoint[] {
  const exchanges = Object.values(allData)
  if (exchanges.length === 0) return []
  if (exchanges.length === 1) return exchanges[0]

  // Build a map of timestamp -> aggregated values
  const byDate = new Map<number, { longSum: number; shortSum: number; ratioSum: number; count: number }>()
  for (const points of exchanges) {
    for (const pt of points) {
      const existing = byDate.get(pt.date)
      if (existing) {
        existing.longSum += pt.longPct
        existing.shortSum += pt.shortPct
        existing.ratioSum += pt.ratio
        existing.count += 1
      } else {
        byDate.set(pt.date, { longSum: pt.longPct, shortSum: pt.shortPct, ratioSum: pt.ratio, count: 1 })
      }
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a - b)
    .map(([date, v]) => ({
      date,
      longPct: v.longSum / v.count,
      shortPct: v.shortSum / v.count,
      ratio: v.ratioSum / v.count,
    }))
}

export function LongShortChart({ data }: Props) {
  const exchangeNames = useMemo(() => Object.keys(data), [data])
  const [selected, setSelected] = useState(AVG_KEY)
  const [period, setPeriod] = useState('6m')

  const options = useMemo(() => {
    const opts = [AVG_KEY, ...exchangeNames]
    return opts
  }, [exchangeNames])

  const averageData = useMemo(() => computeAverage(data), [data])

  const rawData = useMemo(() => {
    if (selected === AVG_KEY) return averageData
    return data[selected] || averageData
  }, [selected, data, averageData])

  const chartData = useMemo(() => {
    if (!rawData.length) return []
    return filterDataByPeriod(rawData, period)
  }, [rawData, period])

  const stats = useMemo(() => {
    if (!chartData.length) return null
    const latest = chartData[chartData.length - 1]
    const avg = chartData.reduce((s, d) => s + d.longPct, 0) / chartData.length
    const maxLong = Math.max(...chartData.map((d) => d.longPct))
    const minLong = Math.min(...chartData.map((d) => d.longPct))
    return { latestLong: latest.longPct, latestRatio: latest.ratio, avg, maxLong, minLong }
  }, [chartData])

  if (chartData.length < 3) return null

  const subtitle = selected === AVG_KEY
    ? `BTC futures — averaged across ${exchangeNames.join(', ')}`
    : `${selected} BTC futures — percentage of accounts positioned long vs short`

  return (
    <div className="chart-container">
      <h3 className="chart-title">Long/Short Account Ratio</h3>
      <p className="chart-subtitle">{subtitle}</p>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <MetricInfo
            description="Shows what percentage of trader accounts hold long vs short BTC futures positions. When longs are crowded (high ratio), the market is vulnerable to long squeezes. When shorts dominate, short squeezes become more likely. The 50% line marks neutral positioning. 'Average' combines data from all available exchanges."
            source="CoinGlass global long/short account ratio data."
          />
          <div className="flex gap-1">
            {options.map((ex) => (
              <button
                key={ex}
                onClick={() => setSelected(ex)}
                className={`px-2 py-0.5 text-[10px] font-sans rounded border transition-colors ${
                  selected === ex
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-transparent text-ink-muted border-rule hover:border-ink'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <TimePeriodSelector selected={period} onChange={setPeriod} periods={['1m', '3m', '6m', '1y']} />
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Current Long %</p>
            <p className="font-serif text-lg font-bold" style={{ color: COLORS.green }}>{stats.latestLong.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Current Ratio</p>
            <p className="font-serif text-lg font-bold">{stats.latestRatio.toFixed(2)}</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Period Avg Long</p>
            <p className="font-serif text-lg font-bold">{stats.avg.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-[10px] text-ink-muted uppercase tracking-wide">Range</p>
            <p className="font-serif text-lg font-bold">{stats.minLong.toFixed(0)}% – {stats.maxLong.toFixed(0)}%</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="shortGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={AXIS_STYLE} tickLine={false}
            axisLine={false} width={42} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke={COLORS.inkMuted} strokeDasharray="4 4" />
          <Area type="monotone" dataKey="longPct" stackId="ls" stroke={COLORS.green} strokeWidth={1.5}
            fill="url(#longGrad)" animationDuration={800} />
          <Area type="monotone" dataKey="shortPct" stackId="ls" stroke={COLORS.red} strokeWidth={1.5}
            fill="url(#shortGrad)" animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-5 mt-2" style={{ fontFamily: AXIS_STYLE.fontFamily, fontSize: 12, color: COLORS.inkLight }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.green }} />
          Long %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.red }} />
          Short %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0" style={{ borderTop: `1.5px dashed ${COLORS.inkMuted}` }} />
          50% Neutral
        </span>
      </div>
    </div>
  )
}
