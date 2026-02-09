import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { HistoricalDataPoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  oiData: HistoricalDataPoint[]
  volumeData: HistoricalDataPoint[]
}

function formatBillions(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toFixed(0)}`
}

export function HistoricalOIChart({ oiData, volumeData }: Props) {
  const [period, setPeriod] = useState('1y')
  const [showVolume, setShowVolume] = useState(true)

  const chartData = useMemo(() => {
    if (!oiData || oiData.length === 0) return []

    const filteredOI = filterDataByPeriod(oiData, period)
    
    // Build volume lookup
    const volMap = new Map<number, number>()
    for (const v of volumeData || []) {
      const dayKey = Math.floor(v.date / 86400000) * 86400000
      volMap.set(dayKey, v.value)
    }

    return filteredOI.map((point) => {
      const dayKey = Math.floor(point.date / 86400000) * 86400000
      const vol = volMap.get(dayKey) || 0
      return {
        date: point.date,
        oi: point.value,
        volume: vol,
        // OI delta: will be computed below
        oiDelta: 0,
      }
    }).map((point, i, arr) => {
      if (i > 0) {
        point.oiDelta = point.oi - arr[i - 1].oi
      }
      return point
    })
  }, [oiData, volumeData, period])

  const stats = useMemo(() => {
    if (chartData.length < 2) return null
    const latest = chartData[chartData.length - 1]
    const prev = chartData[chartData.length - 2]
    const weekAgo = chartData.length > 7 ? chartData[chartData.length - 8] : chartData[0]
    const monthAgo = chartData.length > 30 ? chartData[chartData.length - 31] : chartData[0]
    return {
      currentOI: latest.oi,
      dailyChange: prev.oi > 0 ? ((latest.oi - prev.oi) / prev.oi) * 100 : 0,
      weeklyChange: weekAgo.oi > 0 ? ((latest.oi - weekAgo.oi) / weekAgo.oi) * 100 : 0,
      monthlyChange: monthAgo.oi > 0 ? ((latest.oi - monthAgo.oi) / monthAgo.oi) * 100 : 0,
      oiToVol: latest.volume > 0 ? latest.oi / latest.volume : 0,
    }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Historical Open Interest</h3>
        <p className="chart-subtitle">Aggregate OI across all perpetual exchanges</p>
        <div className="loading-pulse h-80" />
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Historical Open Interest</h3>
      <p className="chart-subtitle">
        Aggregate open interest across all perpetual exchanges, USD
      </p>

      <div className="flex items-center justify-between mb-4">
        <MetricInfo
          description="Open interest represents total capital committed to perpetual positions. Rising OI + rising volume = strong trend conviction. Rising volume + flat OI = churn/wash trading. OI delta (daily change) is a key signal: positive delta with rising price = new longs entering (bullish), positive delta with falling price = new shorts entering (bearish)."
          source="Open-interest overview providing daily aggregate OI across all tracked derivative exchanges."
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 font-sans text-xs text-ink-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
              className="accent-ink"
            />
            Volume overlay
          </label>
          <TimePeriodSelector selected={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">Current OI</p>
            <p className="font-mono text-sm font-bold text-ink">{formatUSD(stats.currentOI, true)}</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">1d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.dailyChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.dailyChange >= 0 ? '+' : ''}{stats.dailyChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">7d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.weeklyChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.weeklyChange >= 0 ? '+' : ''}{stats.weeklyChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">30d Change</p>
            <p className={`font-mono text-sm font-bold ${stats.monthlyChange >= 0 ? 'positive' : 'negative'}`}>
              {stats.monthlyChange >= 0 ? '+' : ''}{stats.monthlyChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted">OI / Volume</p>
            <p className="font-mono text-sm font-bold text-ink">{stats.oiToVol.toFixed(2)}x</p>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 8, right: showVolume ? 60 : 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="oiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.15} />
              <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis
            dataKey="date"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(v: number) => formatDateShort(v)}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: COLORS.rule }}
            minTickGap={60}
          />
          <YAxis
            yAxisId="oi"
            tickFormatter={formatBillions}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          {showVolume && (
            <YAxis
              yAxisId="vol"
              orientation="right"
              tickFormatter={formatBillions}
              tick={{ ...AXIS_STYLE, fill: COLORS.inkMuted }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
          )}
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload
              if (!d) return null
              return (
                <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                  <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                  <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>
                    Open Interest: {formatUSD(d.oi, true)}
                  </p>
                  {d.volume > 0 && (
                    <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>
                      Volume: {formatUSD(d.volume, true)}
                    </p>
                  )}
                  {d.oiDelta !== 0 && (
                    <p style={{ margin: 0, color: d.oiDelta >= 0 ? COLORS.green : COLORS.red, fontSize: 12 }}>
                      OI Delta: {d.oiDelta >= 0 ? '+' : ''}{formatUSD(d.oiDelta, true)}
                    </p>
                  )}
                </div>
              )
            }}
            cursor={{ stroke: COLORS.ruleDark, strokeDasharray: '3 3' }}
          />
          <Area
            yAxisId="oi"
            type="monotone"
            dataKey="oi"
            stroke={COLORS.blue}
            strokeWidth={2}
            fill="url(#oiFill)"
            animationDuration={800}
          />
          {showVolume && (
            <Bar
              yAxisId="vol"
              dataKey="volume"
              fill={COLORS.ink}
              opacity={0.08}
              animationDuration={800}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
          <span className="font-sans text-[11px] text-ink-muted">Open Interest</span>
        </span>
        {showVolume && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.ink, opacity: 0.08 }} />
            <span className="font-sans text-[11px] text-ink-muted">Daily Volume</span>
          </span>
        )}
      </div>
    </div>
  )
}
