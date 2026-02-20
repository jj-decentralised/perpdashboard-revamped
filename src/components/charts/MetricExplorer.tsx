import { useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { DashboardData, HistoricalDataPoint, VolumeSharePoint, FeeSharePoint, PerpFeeSharePoint, DexCexSharePoint } from '../../types'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../../utils/chartTheme'
import { formatUSD, formatDateShort } from '../../utils/format'
import { TimePeriodSelector, filterDataByPeriod } from '../TimePeriodSelector'

interface Props {
  data: DashboardData
}

interface MetricDef {
  id: string
  label: string
  group: string
  available: (d: DashboardData) => boolean
  render: (d: DashboardData, period: string) => JSX.Element | null
}

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function pctAxis(v: number): string {
  return `${v.toFixed(0)}%`
}

/* ── Individual metric renderers ── */

function SingleSeriesChart({ data, period, color, label, formatter }: {
  data: HistoricalDataPoint[]
  period: string
  color: string
  label: string
  formatter: (v: number) => string
}) {
  const filtered = useMemo(() => filterDataByPeriod(data, period), [data, period])

  return (
    <ResponsiveContainer width="100%" height={380}>
      <AreaChart data={filtered} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="metricExpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.12} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
        <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
          axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
        <YAxis tickFormatter={formatter} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={62} />
        <Tooltip content={({ active, payload, label: lbl }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
              <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
              <p style={{ margin: 0, color, fontSize: 12 }}>{label}: {formatter(payload[0].value)}</p>
            </div>
          )
        }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          fill="url(#metricExpFill)" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function DualSeriesChart({ data1, data2, period, color1, color2, label1, label2, formatter }: {
  data1: HistoricalDataPoint[]
  data2: HistoricalDataPoint[]
  period: string
  color1: string
  color2: string
  label1: string
  label2: string
  formatter: (v: number) => string
}) {
  const merged = useMemo(() => {
    const map2 = new Map<number, number>()
    for (const d of data2) {
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      map2.set(dayKey, d.value)
    }
    const raw = data1.map((d) => {
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      return { date: d.date, v1: d.value, v2: map2.get(dayKey) || 0 }
    })
    return filterDataByPeriod(raw, period)
  }, [data1, data2, period])

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="metricDual1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color1} stopOpacity={0.12} />
            <stop offset="95%" stopColor={color1} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
        <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
          axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
        <YAxis tickFormatter={formatter} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={62} />
        <Tooltip content={({ active, payload, label: lbl }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
              <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
              {payload.map((e: any) => (
                <p key={e.name} style={{ margin: 0, color: e.color, fontSize: 12 }}>
                  {e.name === 'v1' ? label1 : label2}: {formatter(e.value)}
                </p>
              ))}
            </div>
          )
        }} />
        <Area type="monotone" dataKey="v1" name="v1" stroke={color1} strokeWidth={2}
          fill="url(#metricDual1)" animationDuration={800} />
        <Line type="monotone" dataKey="v2" name="v2" stroke={color2} strokeWidth={1.5}
          dot={false} animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function PerpFeeShareChart({ data, period }: { data: PerpFeeSharePoint[]; period: string }) {
  const filtered = useMemo(() => filterDataByPeriod(data, period), [data, period])

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={filtered} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="perpShareFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
            <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
        <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
          axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
        <YAxis yAxisId="pct" tickFormatter={pctAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={42} />
        <YAxis yAxisId="usd" orientation="right" tickFormatter={fmtAxis}
          tick={{ ...AXIS_STYLE, fill: COLORS.inkMuted }} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={({ active, payload, label: lbl }: any) => {
          if (!active || !payload?.length) return null
          const d = payload[0]?.payload as PerpFeeSharePoint
          return (
            <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
              <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
              <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>Perps Share: {d.perpShare.toFixed(1)}%</p>
              <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>Perp Fees: {formatUSD(d.perpFees, true)}</p>
              <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>Total DeFi Fees: {formatUSD(d.totalFees, true)}</p>
            </div>
          )
        }} />
        <Area yAxisId="pct" type="monotone" dataKey="perpShare" stroke={COLORS.blue} strokeWidth={2}
          fill="url(#perpShareFill)" animationDuration={800} />
        <Bar yAxisId="usd" dataKey="perpFees" fill={COLORS.ink} opacity={0.06} animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function DexCexChart({ data, period }: { data: DexCexSharePoint[]; period: string }) {
  const filtered = useMemo(() => filterDataByPeriod(data, period), [data, period])

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={filtered} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dexPctFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
            <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
        <XAxis dataKey="date" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
          axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
        <YAxis yAxisId="pct" tickFormatter={pctAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={42} />
        <YAxis yAxisId="usd" orientation="right" tickFormatter={fmtAxis}
          tick={{ ...AXIS_STYLE, fill: COLORS.inkMuted }} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={({ active, payload, label: lbl }: any) => {
          if (!active || !payload?.length) return null
          const d = payload[0]?.payload as DexCexSharePoint
          return (
            <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
              <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
              <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>DEX Share: {d.dexPct.toFixed(2)}%</p>
              <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>DEX Vol: {formatUSD(d.dexVol, true)}</p>
              <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>CEX Vol: {formatUSD(d.cexVol, true)}</p>
            </div>
          )
        }} />
        <Area yAxisId="pct" type="monotone" dataKey="dexPct" stroke={COLORS.green} strokeWidth={2}
          fill="url(#dexPctFill)" animationDuration={800} />
        <Bar yAxisId="usd" dataKey="dexVol" fill={COLORS.green} opacity={0.06} animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ── Volume Share multi-line (one line per exchange) ── */
function VolumeShareLines({ data, names, period }: {
  data: VolumeSharePoint[]
  names: string[]
  period: string
}) {
  const filtered = useMemo(() => filterDataByPeriod(data, period), [data, period])
  const allNames = useMemo(() => [...names, 'Other'], [names])

  const LINE_COLORS = [
    '#1a1a1a', '#2e5e8e', '#c1352d', '#2e7d4f', '#b8860b',
    '#64748b', '#94a3b8', '#475569', '#6b7280',
  ]

  return (
    <>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={filtered} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
          <YAxis tickFormatter={pctAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false}
            width={42} domain={[0, 'auto']} />
          <Tooltip content={({ active, payload, label: lbl }: any) => {
            if (!active || !payload?.length) return null
            const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
            return (
              <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5, maxWidth: 240 }}>
                <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
                {sorted.map((entry: any) => (
                  <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: COLORS.inkLight }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 2, backgroundColor: entry.color, flexShrink: 0 }} />
                      {entry.name}
                    </span>
                    <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{(entry.value || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )
          }} />
          {allNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={name === 'Other' ? 1 : 2}
              dot={false}
              animationDuration={800}
              connectNulls
              strokeDasharray={name === 'Other' ? '4 3' : undefined}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {allNames.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            <span className="font-sans text-[11px] text-ink-light">{name}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ── Fee Breakdown multi-line ── */
function FeeBreakdownLines({ data, names, period }: {
  data: FeeSharePoint[]
  names: string[]
  period: string
}) {
  const filtered = useMemo(() => filterDataByPeriod(data, period), [data, period])
  const allNames = useMemo(() => [...names], [names])

  const LINE_COLORS = [
    '#1a1a1a', '#2e5e8e', '#c1352d', '#2e7d4f', '#b8860b',
    '#64748b', '#94a3b8', '#475569', '#6b7280',
  ]

  return (
    <>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={filtered} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
            axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
          <YAxis tickFormatter={pctAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false}
            width={42} domain={[0, 'auto']} />
          <Tooltip content={({ active, payload, label: lbl }: any) => {
            if (!active || !payload?.length) return null
            const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
            return (
              <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5, maxWidth: 240 }}>
                <p style={TOOLTIP_STYLE.labelStyle}>{lbl ? formatDateShort(lbl) : ''}</p>
                {sorted.filter((e: any) => e.value > 0).map((entry: any) => (
                  <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: COLORS.inkLight }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 2, backgroundColor: entry.color, flexShrink: 0 }} />
                      {entry.name}
                    </span>
                    <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{(entry.value || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )
          }} />
          {allNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              animationDuration={800}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {allNames.map((name, i) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            <span className="font-sans text-[11px] text-ink-light">{name}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ── Main Component ── */

const METRIC_GROUPS = ['Volume', 'Open Interest', 'Fees & Revenue', 'Market Structure']

export function MetricExplorer({ data }: Props) {
  const [selectedMetric, setSelectedMetric] = useState('volume')
  const [period, setPeriod] = useState('1y')

  const metrics: MetricDef[] = useMemo(() => [
    {
      id: 'volume',
      label: 'Aggregate Volume',
      group: 'Volume',
      available: (d) => d.historicalVolume.length > 0,
      render: (d, p) => <SingleSeriesChart data={d.historicalVolume} period={p} color={COLORS.ink} label="Volume" formatter={fmtAxis} />,
    },
    {
      id: 'spot-volume',
      label: 'Spot DEX Volume',
      group: 'Volume',
      available: (d) => d.spotVolumeHistory.length > 0,
      render: (d, p) => <SingleSeriesChart data={d.spotVolumeHistory} period={p} color={COLORS.slate} label="Spot Volume" formatter={fmtAxis} />,
    },
    {
      id: 'perp-vs-spot',
      label: 'Perps vs Spot',
      group: 'Volume',
      available: (d) => d.historicalVolume.length > 0 && d.spotVolumeHistory.length > 0,
      render: (d, p) => <DualSeriesChart data1={d.historicalVolume} data2={d.spotVolumeHistory} period={p}
        color1={COLORS.ink} color2={COLORS.slate} label1="Perps Volume" label2="Spot Volume" formatter={fmtAxis} />,
    },
    {
      id: 'volume-share',
      label: 'Exchange Volume Share',
      group: 'Volume',
      available: (d) => d.volumeShareHistory.length > 0,
      render: (d, p) => <VolumeShareLines data={d.volumeShareHistory} names={d.topExchangeNames} period={p} />,
    },
    {
      id: 'oi',
      label: 'Aggregate Open Interest',
      group: 'Open Interest',
      available: (d) => d.historicalOI.length > 0,
      render: (d, p) => <SingleSeriesChart data={d.historicalOI} period={p} color={COLORS.blue} label="Open Interest" formatter={fmtAxis} />,
    },
    {
      id: 'oi-vs-vol',
      label: 'OI vs Volume',
      group: 'Open Interest',
      available: (d) => d.historicalOI.length > 0 && d.historicalVolume.length > 0,
      render: (d, p) => <DualSeriesChart data1={d.historicalOI} data2={d.historicalVolume} period={p}
        color1={COLORS.blue} color2={COLORS.ink} label1="Open Interest" label2="Volume" formatter={fmtAxis} />,
    },
    {
      id: 'perp-fee-share',
      label: 'Perps % of DeFi Fees',
      group: 'Fees & Revenue',
      available: (d) => d.perpFeeShareHistory.length > 0,
      render: (d, p) => <PerpFeeShareChart data={d.perpFeeShareHistory} period={p} />,
    },
    {
      id: 'fee-breakdown',
      label: 'Fee Share by Exchange',
      group: 'Fees & Revenue',
      available: (d) => d.perpFeeBreakdown.length > 0 && d.perpFeeBreakdownNames.length > 0,
      render: (d, p) => <FeeBreakdownLines data={d.perpFeeBreakdown} names={d.perpFeeBreakdownNames} period={p} />,
    },
    {
      id: 'dex-cex',
      label: 'DEX vs CEX Share',
      group: 'Market Structure',
      available: (d) => d.dexCexShareHistory.length > 0,
      render: (d, p) => <DexCexChart data={d.dexCexShareHistory} period={p} />,
    },
  ], [])

  const availableMetrics = useMemo(() => metrics.filter((m) => m.available(data)), [metrics, data])
  const selectedDef = availableMetrics.find((m) => m.id === selectedMetric) || availableMetrics[0]

  // Group metrics
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, MetricDef[]> = {}
    for (const g of METRIC_GROUPS) groups[g] = []
    for (const m of availableMetrics) {
      if (groups[m.group]) groups[m.group].push(m)
    }
    return Object.entries(groups).filter(([, ms]) => ms.length > 0)
  }, [availableMetrics])

  if (availableMetrics.length === 0) return null

  return (
    <div className="chart-container">
      <h3 className="chart-title">Metric Explorer</h3>
      <p className="chart-subtitle">
        Select any metric to view its historical time-series
      </p>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        {/* Metric selector */}
        <div className="flex flex-wrap gap-1">
          {groupedMetrics.map(([group, ms]) => (
            <div key={group} className="flex items-center gap-1">
              <span className="font-sans text-[10px] uppercase tracking-wider text-ink-muted mr-1 hidden sm:inline">{group}:</span>
              {ms.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMetric(m.id)}
                  className={m.id === selectedDef?.id
                    ? 'px-2.5 py-1 border bg-ink text-paper border-ink font-semibold font-sans text-[11px]'
                    : 'px-2.5 py-1 border bg-paper text-ink-muted border-rule hover:border-ink font-sans text-[11px] cursor-pointer'}
                  type="button"
                >
                  {m.label}
                </button>
              ))}
              <span className="hidden sm:inline mx-1" style={{ color: COLORS.rule }}>|</span>
            </div>
          ))}
        </div>

        <TimePeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Render selected metric */}
      {selectedDef?.render(data, period)}
    </div>
  )
}
