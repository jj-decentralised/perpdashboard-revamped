import React, { useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { useExchangeProfile } from '../hooks/useExchangeProfile'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../utils/chartTheme'
import { formatUSD, formatDateShort, formatFundingRate, formatNumber } from '../utils/format'
import type { CGDerivativeTicker } from '../types/coingecko'

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-paper px-6 py-12 max-w-7xl mx-auto">
      <div className="loading-pulse h-6 w-32 mb-6" />
      <div className="loading-pulse h-10 w-80 mb-4" />
      <div className="loading-pulse h-5 w-full max-w-xl mb-8" />
      <div className="grid grid-cols-4 gap-4 mb-12">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="loading-pulse h-20" />
        ))}
      </div>
      <div className="loading-pulse h-80 mb-12" />
      <div className="loading-pulse h-72" />
    </div>
  )
}

function VolumeTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      <p style={{ margin: 0, color: COLORS.inkLight }}>
        Volume: {formatUSD(payload[0].value, true)}
      </p>
    </div>
  )
}

function TickerTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload as { label: string; oi: number; fundingRate: number }
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{d.label}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>
        Open Interest: {formatUSD(d.oi, true)}
      </p>
      <p style={{ margin: 0, color: d.fundingRate >= 0 ? COLORS.green : COLORS.red, fontSize: 12 }}>
        Funding: {formatFundingRate(d.fundingRate)}
      </p>
    </div>
  )
}

export default function ExchangeProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const cgId = searchParams.get('cgId') || null

  const { data, loading, error } = useExchangeProfile(slug, cgId)

  const tickerChartData = useMemo(() => {
    if (!data?.tickers?.length) return []
    return data.tickers
      .filter((t: CGDerivativeTicker) => t.open_interest_usd > 0)
      .sort((a: CGDerivativeTicker, b: CGDerivativeTicker) => b.open_interest_usd - a.open_interest_usd)
      .slice(0, 20)
      .map((t: CGDerivativeTicker) => ({
        label: `${t.base}/${t.target}`,
        oi: t.open_interest_usd,
        fundingRate: t.funding_rate,
      }))
      .reverse()
  }, [data?.tickers])

  if (loading) return <ProfileSkeleton />

  if (error || !data) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="font-serif text-2xl font-bold mb-4">Exchange Unavailable</h2>
          <p className="text-ink-muted mb-6">{error || 'No data found for this exchange.'}</p>
          <Link
            to="/"
            className="border-2 border-ink px-6 py-2 font-sans text-sm font-semibold hover:bg-ink hover:text-paper transition-colors inline-block"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const exchangeName = data.exchange?.name || slug || 'Exchange'
  const description = data.summary?.description || data.exchange?.description || ''
  const totalOI = data.exchange?.open_interest_btc
    ? `${formatNumber(data.exchange.open_interest_btc)} BTC`
    : '\u2014'
  const perpPairs = data.exchange?.number_of_perpetual_pairs ?? '\u2014'
  const futuresPairs = data.exchange?.number_of_futures_pairs ?? '\u2014'

  const methodology = data.summary?.methodology
  const chains = data.summary?.chains || []

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <Link
          to="/"
          className="font-sans text-sm text-ink-muted hover:text-ink transition-colors mb-6 inline-block"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Header */}
        <ErrorBoundary fallbackLabel="Profile header">
          <header className="border-b-2 border-ink pb-4 mb-6">
            <div className="flex items-center gap-4 mb-2">
              {data.exchange?.image && (
                <img
                  src={data.exchange.image}
                  alt={exchangeName}
                  className="w-10 h-10 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <h1 className="font-serif text-3xl font-bold text-ink">{exchangeName}</h1>
            </div>
            {description && (
              <p className="font-sans text-sm text-ink-light max-w-3xl mb-4">
                {description.length > 300 ? description.slice(0, 300) + '...' : description}
              </p>
            )}

            {/* Key metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
              <div className="kpi-card">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Open Interest</p>
                <p className="font-mono text-lg font-bold text-ink">{totalOI}</p>
              </div>
              <div className="kpi-card">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Perp Pairs</p>
                <p className="font-mono text-lg font-bold text-ink">{perpPairs}</p>
              </div>
              <div className="kpi-card">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Futures Pairs</p>
                <p className="font-mono text-lg font-bold text-ink">{futuresPairs}</p>
              </div>
              <div className="kpi-card">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Chains</p>
                <p className="font-mono text-lg font-bold text-ink">
                  {chains.length > 0 ? chains.join(', ') : '\u2014'}
                </p>
              </div>
              {data.exchange?.url && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Website</p>
                  <a
                    href={data.exchange.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-sm font-semibold hover:underline"
                    style={{ color: COLORS.blue }}
                  >
                    Visit
                  </a>
                </div>
              )}
              {data.exchange?.year_established && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Established</p>
                  <p className="font-mono text-lg font-bold text-ink">{data.exchange.year_established}</p>
                </div>
              )}
            </div>
          </header>
        </ErrorBoundary>

        {/* Historical Volume */}
        {data.historicalVolume.length > 0 && (
          <ErrorBoundary fallbackLabel="Historical volume">
            <section className="section-rule">
              <h3 className="chart-title">Historical Volume</h3>
              <p className="chart-subtitle">
                Daily trading volume over time
              </p>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart
                  data={data.historicalVolume}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="profileVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.ink} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.ink} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID_STYLE.stroke}
                    strokeDasharray={GRID_STYLE.strokeDasharray}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: number) => formatDateShort(v)}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.rule }}
                    minTickGap={60}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` :
                      v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` :
                      `$${(v / 1e3).toFixed(0)}K`
                    }
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip content={<VolumeTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={COLORS.ink}
                    strokeWidth={1.5}
                    fill="url(#profileVolumeGrad)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </section>
          </ErrorBoundary>
        )}

        {/* Trading Pairs by OI */}
        {tickerChartData.length > 0 && (
          <ErrorBoundary fallbackLabel="Trading pairs">
            <section className="section-rule">
              <h3 className="chart-title">Top Trading Pairs</h3>
              <p className="chart-subtitle">
                Ranked by open interest — colour indicates funding rate direction
              </p>
              <ResponsiveContainer width="100%" height={Math.max(400, tickerChartData.length * 24)}>
                <BarChart
                  data={tickerChartData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={GRID_STYLE.stroke}
                    strokeDasharray={GRID_STYLE.strokeDasharray}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` :
                      v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` :
                      `$${(v / 1e3).toFixed(0)}K`
                    }
                    tick={AXIS_STYLE}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.rule }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ ...AXIS_STYLE, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<TickerTooltip />} cursor={{ fill: COLORS.paperAlt }} />
                  <Bar dataKey="oi" radius={[0, 2, 2, 0]} animationDuration={800}>
                    {tickerChartData.map((entry: { fundingRate: number }, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fundingRate >= 0 ? COLORS.green : COLORS.red}
                        opacity={0.75}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.green, opacity: 0.75 }} />
                  <span className="font-sans text-[11px] text-ink-muted">Positive funding (longs pay)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: COLORS.red, opacity: 0.75 }} />
                  <span className="font-sans text-[11px] text-ink-muted">Negative funding (shorts pay)</span>
                </span>
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Methodology */}
        {methodology && Object.keys(methodology).length > 0 && (
          <ErrorBoundary fallbackLabel="Methodology">
            <section className="section-rule">
              <h3 className="chart-title">Fee Methodology</h3>
              <div className="space-y-3 mt-4">
                {Object.entries(methodology).map(([key, value]) => (
                  <div key={key} className="border-l-2 border-rule pl-4">
                    <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
                      {key}
                    </p>
                    <p className="font-sans text-sm text-ink-light">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Footer */}
        <footer className="border-t border-rule mt-12 pt-6 pb-8">
          <Link
            to="/"
            className="font-sans text-sm text-ink-muted hover:text-ink transition-colors"
          >
            &larr; Back to Dashboard
          </Link>
        </footer>
      </div>
    </div>
  )
}
