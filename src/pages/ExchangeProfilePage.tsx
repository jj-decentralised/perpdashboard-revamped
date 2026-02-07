import React, { useMemo, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  LineChart,
} from 'recharts'
import { useExchangeProfile } from '../hooks/useExchangeProfile'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../utils/chartTheme'
import { formatUSD, formatDateShort, formatFundingRate, formatNumber, formatPercent, formatMultiple, percentClass, classNames } from '../utils/format'
import type { CGExchangeTicker } from '../types/coingecko'
import type { TokenInfo, QuarterlyData, ComparableExchange, TreasuryInfo, HistoricalPEPoint } from '../types/profile'

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

function fmtAxis(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function VolumeWithPriceTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ margin: 0, color: entry.color || COLORS.inkLight, fontSize: 12 }}>
          {entry.name}: {entry.name === 'price' ? `$${entry.value?.toFixed(4)}` : formatUSD(entry.value, true)}
        </p>
      ))}
    </div>
  )
}

function PETooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload as HistoricalPEPoint
  if (!d) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>P/E: {d.pe != null ? formatMultiple(d.pe) : '\u2014'}</p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>P/S: {d.ps != null ? formatMultiple(d.ps) : '\u2014'}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>Price: ${d.price?.toFixed(4)}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>Mcap: {formatUSD(d.mcap, true)}</p>
    </div>
  )
}

// --- Token Info Section ---
function TokenInfoSection({ info }: { info: TokenInfo }) {
  return (
    <ErrorBoundary fallbackLabel="Token info">
      <section className="section-rule">
        <h3 className="chart-title">Governance Token — {info.symbol}</h3>
        <p className="chart-subtitle">{info.name}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Price</p>
            <p className="font-mono text-lg font-bold text-ink">${info.currentPrice.toFixed(info.currentPrice < 1 ? 6 : 2)}</p>
            <p className={classNames('font-mono text-xs', percentClass(info.priceChange24h))}>
              {formatPercent(info.priceChange24h)} (24h)
            </p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Market Cap</p>
            <p className="font-mono text-lg font-bold text-ink">{formatUSD(info.marketCap, true)}</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">FDV</p>
            <p className="font-mono text-lg font-bold text-ink">{formatUSD(info.fdv, true)}</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Circ. Supply</p>
            <p className="font-mono text-lg font-bold text-ink">{formatNumber(info.circulatingSupply)}</p>
            {info.totalSupply > 0 && (
              <p className="font-mono text-xs text-ink-muted">{((info.circulatingSupply / info.totalSupply) * 100).toFixed(1)}% of total</p>
            )}
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">ATH</p>
            <p className="font-mono text-lg font-bold text-ink">${info.ath.toFixed(info.ath < 1 ? 6 : 2)}</p>
            <p className="font-mono text-xs text-ink-muted">{info.athDate ? new Date(info.athDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Price Changes</p>
            <div className="space-y-0.5">
              <p className={classNames('font-mono text-xs', percentClass(info.priceChange7d))}>7d: {formatPercent(info.priceChange7d)}</p>
              <p className={classNames('font-mono text-xs', percentClass(info.priceChange30d))}>30d: {formatPercent(info.priceChange30d)}</p>
            </div>
          </div>
        </div>
      </section>
    </ErrorBoundary>
  )
}

// --- Treasury Section ---
function TreasurySection({ treasury }: { treasury: TreasuryInfo }) {
  const segments = [
    { label: 'Own Token', value: treasury.ownTokenUsd, color: COLORS.ink },
    { label: 'Stablecoins', value: treasury.stablecoinsUsd, color: COLORS.green },
    { label: 'Majors (BTC/ETH)', value: treasury.majorsUsd, color: COLORS.blue },
    { label: 'Other', value: treasury.othersUsd, color: COLORS.slate },
  ].filter((s) => s.value > 0)

  return (
    <ErrorBoundary fallbackLabel="Treasury">
      <section className="section-rule">
        <h3 className="chart-title">Treasury</h3>
        <p className="chart-subtitle">Protocol-owned assets breakdown</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-sans text-xs uppercase tracking-wider text-ink-muted">Total Treasury</span>
            <span className="font-mono text-xl font-bold text-ink">{formatUSD(treasury.totalUsd, true)}</span>
          </div>

          {/* Stacked bar */}
          <div className="flex w-full h-6 overflow-hidden border border-rule mb-3">
            {segments.map((seg) => (
              <div
                key={seg.label}
                style={{
                  width: `${(seg.value / treasury.totalUsd) * 100}%`,
                  backgroundColor: seg.color,
                  opacity: 0.75,
                  minWidth: seg.value > 0 ? 2 : 0,
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-start gap-2">
                <span className="inline-block w-2.5 h-2.5 mt-1 flex-shrink-0" style={{ backgroundColor: seg.color, opacity: 0.75 }} />
                <div>
                  <p className="font-sans text-xs text-ink-muted">{seg.label}</p>
                  <p className="font-mono text-sm font-semibold text-ink">{formatUSD(seg.value, true)}</p>
                  <p className="font-mono text-[10px] text-ink-muted">{((seg.value / treasury.totalUsd) * 100).toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ErrorBoundary>
  )
}

// --- Comparables Section ---
function ComparablesSection({ comparables, currentSlug }: { comparables: ComparableExchange[]; currentSlug: string }) {
  if (comparables.length === 0) return null
  return (
    <ErrorBoundary fallbackLabel="Comparables">
      <section className="section-rule">
        <h3 className="chart-title">Comparable Exchanges</h3>
        <p className="chart-subtitle">
          Exchanges on similar chains, volume profiles, or valuations
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="data-table w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left">Exchange</th>
                <th className="text-right">24h Volume</th>
                <th className="text-right">Mcap</th>
                <th className="text-right">P/S</th>
                <th className="text-right">P/E</th>
                <th className="text-right">1d Change</th>
                <th className="text-left">Match</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((comp, i) => (
                <tr key={comp.slug || comp.name} className={i % 2 === 1 ? 'bg-paper-warm' : ''}>
                  <td className="font-sans text-sm font-medium whitespace-nowrap">
                    <Link to={`/exchange/${comp.slug}`} className="hover:underline" style={{ color: COLORS.blue }}>
                      {comp.name}
                    </Link>
                    {comp.hasToken && comp.tokenSymbol && (
                      <span className="tag-token ml-2">{comp.tokenSymbol}</span>
                    )}
                  </td>
                  <td className="text-right font-mono text-sm">{formatUSD(comp.volume24h, true)}</td>
                  <td className="text-right font-mono text-sm">{comp.mcap ? formatUSD(comp.mcap, true) : '\u2014'}</td>
                  <td className="text-right font-mono text-sm">{comp.psRatio != null ? formatMultiple(comp.psRatio) : '\u2014'}</td>
                  <td className="text-right font-mono text-sm">{comp.peRatio != null ? formatMultiple(comp.peRatio) : '\u2014'}</td>
                  <td className={classNames('text-right font-mono text-sm', percentClass(comp.change1d))}>
                    {formatPercent(comp.change1d)}
                  </td>
                  <td className="font-sans text-[11px] text-ink-muted max-w-[180px] truncate">{comp.matchReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </ErrorBoundary>
  )
}

export default function ExchangeProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const cgId = searchParams.get('cgId') || null

  const { data, loading, error } = useExchangeProfile(slug, cgId)

  // Volume + price overlay data
  const volumePriceData = useMemo(() => {
    if (!data?.historicalVolume?.length) return []
    const priceMap = new Map<number, number>()
    for (const [ts, price] of data.priceHistory || []) {
      const dayKey = Math.floor(ts / 86400000) * 86400000
      priceMap.set(dayKey, price)
    }
    return data.historicalVolume.map((v) => {
      const dayKey = Math.floor(v.date / 86400000) * 86400000
      return { date: v.date, volume: v.value, price: priceMap.get(dayKey) || null }
    })
  }, [data?.historicalVolume, data?.priceHistory])

  const tickerChartData = useMemo(() => {
    if (!data?.tickers?.length) return []
    return data.tickers
      .filter((t: CGExchangeTicker) => t.open_interest_usd > 0)
      .sort((a: CGExchangeTicker, b: CGExchangeTicker) => b.open_interest_usd - a.open_interest_usd)
      .slice(0, 20)
      .map((t: CGExchangeTicker) => ({
        label: `${t.base}/${t.target}`,
        oi: t.open_interest_usd,
        fundingRate: t.funding_rate,
      }))
      .reverse()
  }, [data?.tickers])

  // Filter valid P/E data points (cap at 500x to remove noise)
  const validPE = useMemo(() => {
    if (!data?.historicalPE?.length) return []
    return data.historicalPE.filter((p) => (p.pe != null && p.pe > 0 && p.pe < 500) || (p.ps != null && p.ps > 0 && p.ps < 500))
  }, [data?.historicalPE])

  // Historical fee/revenue data — merge into single series, weekly smoothing
  const feeRevenueData = useMemo(() => {
    if (!data?.feeHistory?.length && !data?.revenueHistory?.length) return []

    const revMap = new Map<number, number>()
    for (const r of data?.revenueHistory || []) {
      const dayKey = Math.floor(r.date / 86400000) * 86400000
      revMap.set(dayKey, r.value)
    }

    // Use fee history as base, attach revenue
    const raw = (data?.feeHistory || []).map((f) => {
      const dayKey = Math.floor(f.date / 86400000) * 86400000
      return { date: f.date, fees: f.value, revenue: revMap.get(dayKey) || 0 }
    })

    // 7-day rolling average for smoother chart
    if (raw.length < 7) return raw
    const smoothed: typeof raw = []
    for (let i = 6; i < raw.length; i++) {
      let sumFee = 0, sumRev = 0
      for (let j = i - 6; j <= i; j++) {
        sumFee += raw[j].fees
        sumRev += raw[j].revenue
      }
      smoothed.push({
        date: raw[i].date,
        fees: sumFee / 7,
        revenue: sumRev / 7,
      })
    }
    // Sample weekly for performance if > 365 points
    if (smoothed.length > 365) {
      return smoothed.filter((_, i) => i % 7 === 0 || i === smoothed.length - 1)
    }
    return smoothed
  }, [data?.feeHistory, data?.revenueHistory])

  const hasRevenueData = feeRevenueData.some((d) => d.revenue > 0)

  const exchangeName = data?.exchange?.name || data?.summary?.name || slug || 'Exchange'
  const description = data?.summary?.description || data?.exchange?.description || ''
  const chains = data?.summary?.chains || []
  const hasPrice = volumePriceData.some((d) => d.price != null && d.price > 0)

  // SEO: update document title and meta description
  // NOTE: This must be before any early returns to satisfy React's rules of hooks
  useEffect(() => {
    document.title = `${exchangeName} — Perpetual Exchange Analytics`
    const meta = document.querySelector('meta[name="description"]')
    const desc = `${exchangeName} perpetual derivatives analytics: volume, open interest, fees, funding rates, and valuation metrics.`
    if (meta) {
      meta.setAttribute('content', desc)
    } else {
      const newMeta = document.createElement('meta')
      newMeta.name = 'description'
      newMeta.content = desc
      document.head.appendChild(newMeta)
    }
    return () => {
      document.title = 'Perpetual Exchange Analytics'
    }
  }, [exchangeName])

  if (loading) return <ProfileSkeleton />

  if (error || !data) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="font-serif text-2xl font-bold mb-4">Exchange Unavailable</h2>
          <p className="text-ink-muted mb-6">{error || 'No data found for this exchange.'}</p>
          <Link to="/" className="border-2 border-ink px-6 py-2 font-sans text-sm font-semibold hover:bg-ink hover:text-paper transition-colors inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Derive KPIs from available data
  const latestVolume = data.historicalVolume.length > 0
    ? data.historicalVolume[data.historicalVolume.length - 1].value
    : null
  const latestFees = data.feeHistory.length > 0
    ? data.feeHistory[data.feeHistory.length - 1].value
    : null
  const latestRevenue = data.revenueHistory.length > 0
    ? data.revenueHistory[data.revenueHistory.length - 1].value
    : null
  const hasOI = data.exchange?.open_interest_btc != null && data.exchange.open_interest_btc > 0
  const hasPerpPairs = data.exchange?.number_of_perpetual_pairs != null && data.exchange.number_of_perpetual_pairs > 0
  const hasFuturesPairs = data.exchange?.number_of_futures_pairs != null && data.exchange.number_of_futures_pairs > 0

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/" className="font-sans text-sm text-ink-muted hover:text-ink transition-colors mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>

        {/* Header */}
        <ErrorBoundary fallbackLabel="Profile header">
          <header className="border-b-2 border-ink pb-4 mb-6">
            <div className="flex items-center gap-4 mb-2">
              {data.exchange?.image && (
                <img src={data.exchange.image} alt={exchangeName} className="w-10 h-10 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <h1 className="font-serif text-3xl font-bold text-ink">{exchangeName}</h1>
              {data.tokenInfo && (
                <span className="tag-token text-base px-3 py-1">{data.tokenInfo.symbol}</span>
              )}
              {!data.tokenInfo && (
                <span className="font-sans text-sm text-ink-muted border border-rule px-2 py-0.5">No Token</span>
              )}
            </div>
            {description && (
              <p className="font-sans text-sm text-ink-light max-w-3xl mb-4">
                {description.length > 400 ? description.slice(0, 400) + '...' : description}
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
              {latestVolume != null && latestVolume > 0 && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">24h Volume</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatUSD(latestVolume, true)}</p>
                </div>
              )}
              {latestFees != null && latestFees > 0 && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Daily Fees</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatUSD(latestFees, true)}</p>
                </div>
              )}
              {latestRevenue != null && latestRevenue > 0 && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Daily Revenue</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatUSD(latestRevenue, true)}</p>
                </div>
              )}
              {hasOI && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Open Interest</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatUSD(data.exchange!.open_interest_btc * (data.btcPrice || 60000), true)}</p>
                  <p className="font-mono text-xs text-ink-muted">{formatNumber(data.exchange!.open_interest_btc)} BTC</p>
                </div>
              )}
              {hasPerpPairs && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Perp Pairs</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatNumber(data.exchange!.number_of_perpetual_pairs)}</p>
                </div>
              )}
              {hasFuturesPairs && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Futures Pairs</p>
                  <p className="font-mono text-lg font-bold text-ink">{formatNumber(data.exchange!.number_of_futures_pairs)}</p>
                </div>
              )}
              <div className="kpi-card">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Chains</p>
                <p className="font-mono text-lg font-bold text-ink">
                  {chains.length > 0 ? chains.join(', ') : '\u2014'}
                </p>
              </div>
              {(data.exchange?.url || data.summary?.url) && (
                <div className="kpi-card">
                  <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Website</p>
                  <a href={data.exchange?.url || data.summary?.url} target="_blank" rel="noopener noreferrer"
                    className="font-sans text-sm font-semibold hover:underline" style={{ color: COLORS.blue }}>Visit</a>
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

        {/* Token Info */}
        {data.tokenInfo && <TokenInfoSection info={data.tokenInfo} />}

        {/* Historical Volume + Price Overlay */}
        {volumePriceData.length > 0 && (
          <ErrorBoundary fallbackLabel="Historical volume">
            <section className="section-rule">
              <h3 className="chart-title">
                Historical Volume{hasPrice ? ' & Token Price' : ''}
              </h3>
              <p className="chart-subtitle">
                Daily trading volume{hasPrice ? ` with ${data.tokenInfo?.symbol || 'token'} price overlay` : ''}
              </p>
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={volumePriceData} margin={{ top: 8, right: hasPrice ? 60 : 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="profileVolGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.ink} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.ink} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                  <YAxis yAxisId="vol" tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
                  {hasPrice && (
                    <YAxis yAxisId="price" orientation="right" tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`}
                      tick={{ ...AXIS_STYLE, fill: COLORS.blue }} tickLine={false} axisLine={false} width={68} />
                  )}
                  <Tooltip content={<VolumeWithPriceTooltip />} />
                  <Area yAxisId="vol" type="monotone" dataKey="volume" name="volume" stroke={COLORS.ink} strokeWidth={1.5}
                    fill="url(#profileVolGrad)" animationDuration={800} />
                  {hasPrice && (
                    <Line yAxisId="price" type="monotone" dataKey="price" name="price" stroke={COLORS.blue} strokeWidth={1.5}
                      dot={false} animationDuration={800} connectNulls />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              {hasPrice && (
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.ink }} />
                    <span className="font-sans text-[11px] text-ink-muted">Volume</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
                    <span className="font-sans text-[11px] text-ink-muted">{data.tokenInfo?.symbol || 'Token'} Price</span>
                  </span>
                </div>
              )}
            </section>
          </ErrorBoundary>
        )}

        {/* Historical Fees & Revenue */}
        {feeRevenueData.length > 3 && (
          <ErrorBoundary fallbackLabel="Fee & revenue history">
            <section className="section-rule">
              <h3 className="chart-title">
                Historical Fees{hasRevenueData ? ' & Revenue' : ''}
              </h3>
              <p className="chart-subtitle">
                7-day rolling average of daily {hasRevenueData ? 'fees and protocol revenue' : 'fee generation'}
              </p>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={feeRevenueData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.ink} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.ink} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                    axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                  <YAxis tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
                  <Tooltip content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
                        <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                        {payload.map((entry: any) => (
                          <p key={entry.name} style={{ margin: 0, color: entry.color || COLORS.inkLight, fontSize: 12 }}>
                            {entry.name === 'fees' ? 'Fees' : 'Revenue'}: {formatUSD(entry.value, true)}
                          </p>
                        ))}
                      </div>
                    )
                  }} />
                  <Area type="monotone" dataKey="fees" name="fees" stroke={COLORS.ink} strokeWidth={1.5}
                    fill="url(#feeGrad)" animationDuration={800} />
                  {hasRevenueData && (
                    <Area type="monotone" dataKey="revenue" name="revenue" stroke={COLORS.green} strokeWidth={1.5}
                      fill="url(#revGrad)" animationDuration={800} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.ink }} />
                  <span className="font-sans text-[11px] text-ink-muted">Daily Fees (7d avg)</span>
                </span>
                {hasRevenueData && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.green }} />
                    <span className="font-sans text-[11px] text-ink-muted">Daily Revenue (7d avg)</span>
                  </span>
                )}
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Historical P/E Ratio */}
        {validPE.length > 3 && (
          <ErrorBoundary fallbackLabel="Historical P/E">
            <section className="section-rule">
              <h3 className="chart-title">Historical Valuation Multiples</h3>
              <p className="chart-subtitle">
                P/E and P/S ratios over time — lower ratios suggest relative undervaluation
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={validPE} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                    axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                  <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}x`} tick={AXIS_STYLE} tickLine={false}
                    axisLine={false} width={48} />
                  <Tooltip content={<PETooltip />} />
                  <Line type="monotone" dataKey="pe" name="P/E" stroke={COLORS.blue} strokeWidth={2}
                    dot={false} animationDuration={800} connectNulls />
                  <Line type="monotone" dataKey="ps" name="P/S" stroke={COLORS.inkMuted} strokeWidth={1.5}
                    dot={false} animationDuration={800} strokeDasharray="4 3" connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
                  <span className="font-sans text-[11px] text-ink-muted">P/E Ratio</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5 border-t border-dashed" style={{ borderColor: COLORS.inkMuted }} />
                  <span className="font-sans text-[11px] text-ink-muted">P/S Ratio</span>
                </span>
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Quarterly Performance */}
        {data.quarterlyData.length > 1 && (
          <ErrorBoundary fallbackLabel="Quarterly performance">
            <section className="section-rule">
              <h3 className="chart-title">Quarterly Performance</h3>
              <p className="chart-subtitle">
                Volume, fees, and growth by quarter
              </p>
              <div className="overflow-x-auto mt-4">
                <table className="data-table w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left">Quarter</th>
                      <th className="text-right">Total Volume</th>
                      <th className="text-right">Avg Daily Vol</th>
                      <th className="text-right">Peak Daily Vol</th>
                      <th className="text-right">Total Fees</th>
                      <th className="text-right">Est. Revenue</th>
                      <th className="text-right">QoQ Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.quarterlyData.slice(-8).reverse().map((q, i) => (
                      <tr key={q.quarter} className={i % 2 === 1 ? 'bg-paper-warm' : ''}>
                        <td className="font-sans text-sm font-semibold text-ink">{q.quarter}</td>
                        <td className="text-right font-mono text-sm">{formatUSD(q.totalVolume, true)}</td>
                        <td className="text-right font-mono text-sm text-ink-light">{formatUSD(q.avgDailyVolume, true)}</td>
                        <td className="text-right font-mono text-sm text-ink-light">{formatUSD(q.peakDailyVolume, true)}</td>
                        <td className="text-right font-mono text-sm">{q.totalFees > 0 ? formatUSD(q.totalFees, true) : '\u2014'}</td>
                        <td className="text-right font-mono text-sm text-ink-light">{q.estimatedRevenue > 0 ? formatUSD(q.estimatedRevenue, true) : '\u2014'}</td>
                        <td className={classNames('text-right font-mono text-sm', percentClass(q.growthVsLast))}>
                          {q.growthVsLast != null ? formatPercent(q.growthVsLast) : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Treasury */}
        {data.treasury && <TreasurySection treasury={data.treasury} />}

        {/* Trading Pairs by OI */}
        {tickerChartData.length > 0 && (
          <ErrorBoundary fallbackLabel="Trading pairs">
            <section className="section-rule">
              <h3 className="chart-title">Top Trading Pairs</h3>
              <p className="chart-subtitle">Ranked by open interest — colour indicates funding rate direction</p>
              <ResponsiveContainer width="100%" height={Math.max(400, tickerChartData.length * 24)}>
                <BarChart data={tickerChartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis type="number" tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ ...AXIS_STYLE, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.6 }}>
                        <p style={TOOLTIP_STYLE.labelStyle}>{d.label}</p>
                        <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>OI: {formatUSD(d.oi, true)}</p>
                        <p style={{ margin: 0, color: d.fundingRate >= 0 ? COLORS.green : COLORS.red, fontSize: 12 }}>
                          Funding: {formatFundingRate(d.fundingRate)}
                        </p>
                      </div>
                    )
                  }} cursor={{ fill: COLORS.paperAlt }} />
                  <Bar dataKey="oi" radius={[0, 2, 2, 0]} animationDuration={800}>
                    {tickerChartData.map((entry: { fundingRate: number }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fundingRate >= 0 ? COLORS.green : COLORS.red} opacity={0.75} />
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

        {/* Comparables */}
        <ComparablesSection comparables={data.comparables} currentSlug={slug || ''} />

        {/* Methodology */}
        {data.summary?.methodology && Object.keys(data.summary.methodology).length > 0 && (
          <ErrorBoundary fallbackLabel="Methodology">
            <section className="section-rule">
              <h3 className="chart-title">Fee Methodology</h3>
              <div className="space-y-3 mt-4">
                {Object.entries(data.summary.methodology).map(([key, value]) => (
                  <div key={key} className="border-l-2 border-rule pl-4">
                    <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">{key}</p>
                    <p className="font-sans text-sm text-ink-light">{String(value)}</p>
                  </div>
                ))}
              </div>
            </section>
          </ErrorBoundary>
        )}

        <footer className="border-t border-rule mt-12 pt-6 pb-8">
          <Link to="/" className="font-sans text-sm text-ink-muted hover:text-ink transition-colors">
            &larr; Back to Dashboard
          </Link>
        </footer>
      </div>
    </div>
  )
}
