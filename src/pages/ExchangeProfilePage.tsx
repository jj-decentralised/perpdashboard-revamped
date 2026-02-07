import React, { useMemo, useEffect, useState } from 'react'
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

// --- Token Economics Section ---
interface EmissionData {
  circulatingSupply: number | null
  totalLocked: number | null
  maxSupply: number | null
  unlocksPerDay: number | null
  nextEvent: any | null
  events: any[]
}

function TokenEconomicsSection({ info, slug }: { info: TokenInfo; slug: string }) {
  const [emissions, setEmissions] = useState<EmissionData | null>(null)
  const [emLoading, setEmLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('https://api.llama.fi/emissions')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (cancelled || !Array.isArray(data)) return

        // Match by protocol name/slug
        const slugLower = slug.toLowerCase()
        const nameLower = info.name.toLowerCase()
        const match = data.find((em: any) => {
          const emName = (em.name || '').toLowerCase()
          const emId = (em.protocolId || '').toString().toLowerCase()
          return emName === slugLower || emId === slugLower
            || emName === nameLower
            || emName.includes(slugLower) || slugLower.includes(emName)
        })

        if (match) {
          setEmissions({
            circulatingSupply: match.circulatingSupply?.circulating || null,
            totalLocked: match.totalLocked || null,
            maxSupply: match.maxSupply || null,
            unlocksPerDay: match.unlocksPerDay || null,
            nextEvent: match.nextEvent || null,
            events: match.events || [],
          })
        }
      } catch { /* emissions unavailable */ }
      if (!cancelled) setEmLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, info.name])

  const circulating = info.circulatingSupply
  const total = info.totalSupply || info.maxSupply || 0
  const maxSupply = info.maxSupply || emissions?.maxSupply || total
  const locked = emissions?.totalLocked || (total > circulating ? total - circulating : 0)
  const circPct = maxSupply > 0 ? (circulating / maxSupply) * 100 : 0
  const lockedPct = maxSupply > 0 ? (locked / maxSupply) * 100 : 0
  const mcapToFdv = info.fdv > 0 ? (info.marketCap / info.fdv) * 100 : 0
  const unlockPressure30d = emissions?.unlocksPerDay && circulating > 0
    ? (emissions.unlocksPerDay * 30 / circulating) * 100
    : null
  const hasUnlockData = emissions != null && (emissions.unlocksPerDay != null || emissions.totalLocked != null)

  if (total <= 0 && !hasUnlockData) return null

  return (
    <ErrorBoundary fallbackLabel="Token economics">
      <section className="section-rule">
        <h3 className="chart-title">Token Economics</h3>
        <p className="chart-subtitle">Supply distribution and unlock schedule for {info.symbol}</p>

        {/* Supply distribution bar */}
        <div className="mt-4 mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-sans text-xs uppercase tracking-wider text-ink-muted">Supply Distribution</span>
            <span className="font-mono text-xs text-ink-muted">
              {maxSupply > 0 ? `Max: ${formatNumber(maxSupply)}` : `Total: ${formatNumber(total)}`}
            </span>
          </div>
          <div className="flex w-full h-7 overflow-hidden border border-rule">
            <div
              className="relative h-full flex items-center justify-center"
              style={{ width: `${Math.max(circPct, 1)}%`, backgroundColor: COLORS.green, opacity: 0.7 }}
              title={`Circulating: ${formatNumber(circulating)} (${circPct.toFixed(1)}%)`}
            >
              {circPct > 15 && (
                <span className="font-mono text-[10px] text-white font-bold">{circPct.toFixed(0)}%</span>
              )}
            </div>
            {lockedPct > 0 && (
              <div
                className="relative h-full flex items-center justify-center"
                style={{ width: `${Math.max(lockedPct, 1)}%`, backgroundColor: COLORS.ink, opacity: 0.3 }}
                title={`Locked/Unvested: ${formatNumber(locked)} (${lockedPct.toFixed(1)}%)`}
              >
                {lockedPct > 15 && (
                  <span className="font-mono text-[10px] text-ink font-bold">{lockedPct.toFixed(0)}%</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-5 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.green, opacity: 0.7 }} />
              <span className="font-sans text-[11px] text-ink-muted">
                Circulating ({formatNumber(circulating)})
              </span>
            </span>
            {locked > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.ink, opacity: 0.3 }} />
                <span className="font-sans text-[11px] text-ink-muted">
                  Locked ({formatNumber(locked)})
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-rule">
          <div>
            <p className="font-sans text-xs text-ink-muted">Mcap / FDV</p>
            <p className="font-mono text-sm font-bold text-ink">{mcapToFdv.toFixed(1)}%</p>
          </div>
          <div>
            <p className="font-sans text-xs text-ink-muted">Circulating %</p>
            <p className="font-mono text-sm font-bold text-ink">{circPct.toFixed(1)}%</p>
          </div>
          {unlockPressure30d != null && (
            <div>
              <p className="font-sans text-xs text-ink-muted">30d Unlock Pressure</p>
              <p
                className="font-mono text-sm font-bold"
                style={{ color: unlockPressure30d > 5 ? COLORS.red : unlockPressure30d > 2 ? COLORS.amber : COLORS.green }}
              >
                {unlockPressure30d.toFixed(2)}%
              </p>
            </div>
          )}
          {emissions?.unlocksPerDay != null && emissions.unlocksPerDay > 0 && (
            <div>
              <p className="font-sans text-xs text-ink-muted">Daily Unlocks</p>
              <p className="font-mono text-sm font-bold text-ink">{formatNumber(emissions.unlocksPerDay)}</p>
              <p className="font-mono text-[10px] text-ink-muted">
                ~{formatUSD(emissions.unlocksPerDay * info.currentPrice, true)}/day
              </p>
            </div>
          )}
        </div>

        {/* Next unlock event */}
        {emissions?.nextEvent && (
          <div className="mt-4 border-l-4 pl-4" style={{ borderLeftColor: COLORS.amber }}>
            <p className="font-sans text-xs font-semibold text-ink-light mb-1">Next Unlock Event</p>
            <p className="font-sans text-sm text-ink">
              {typeof emissions.nextEvent === 'string'
                ? emissions.nextEvent
                : emissions.nextEvent.description || emissions.nextEvent.date || JSON.stringify(emissions.nextEvent)}
            </p>
          </div>
        )}

        {emLoading && (
          <p className="font-sans text-[11px] text-ink-muted mt-3">Loading unlock schedule...</p>
        )}
      </section>
    </ErrorBoundary>
  )
}

// --- Trading Pairs Section ---
function TradingPairsSection({ tickers }: { tickers: CGExchangeTicker[] }) {
  const pairs = useMemo(() => {
    return tickers
      .filter((t) => t.open_interest_usd > 0)
      .sort((a, b) => b.open_interest_usd - a.open_interest_usd)
      .slice(0, 20)
  }, [tickers])

  if (pairs.length === 0) return null

  const maxOI = pairs[0]?.open_interest_usd || 1
  const totalOI = pairs.reduce((s, t) => s + t.open_interest_usd, 0)

  return (
    <ErrorBoundary fallbackLabel="Trading pairs">
      <section className="section-rule">
        <h3 className="chart-title">Top Trading Pairs</h3>
        <p className="chart-subtitle">
          {pairs.length} pairs ranked by open interest — {formatUSD(totalOI, true)} total OI
        </p>

        <div className="mt-4 space-y-1">
          {pairs.map((t, i) => {
            const oiPct = (t.open_interest_usd / maxOI) * 100
            const oiShare = totalOI > 0 ? (t.open_interest_usd / totalOI) * 100 : 0
            const isPositive = t.funding_rate >= 0

            return (
              <div
                key={`${t.base}-${t.target}-${i}`}
                className="relative flex items-center gap-3 py-2.5 px-3 border border-rule hover:bg-paper-alt transition-colors group"
              >
                {/* Rank */}
                <span className="font-mono text-xs text-ink-muted w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>

                {/* Pair name */}
                <div className="w-28 flex-shrink-0">
                  <span className="font-sans text-sm font-semibold text-ink">{t.base}</span>
                  <span className="font-sans text-sm text-ink-muted">/{t.target}</span>
                </div>

                {/* OI bar + value */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-5 bg-paper relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 transition-all"
                        style={{
                          width: `${oiPct}%`,
                          backgroundColor: isPositive ? COLORS.green : COLORS.red,
                          opacity: 0.15,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="font-mono text-xs text-ink">
                          {formatUSD(t.open_interest_usd, true)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-ink-muted w-12 text-right flex-shrink-0">
                      {oiShare.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Funding rate badge */}
                <div className="w-24 flex-shrink-0 text-right">
                  <span
                    className="inline-block font-mono text-xs font-bold px-2 py-0.5"
                    style={{
                      color: isPositive ? COLORS.green : COLORS.red,
                      backgroundColor: isPositive ? 'rgba(34,139,34,0.08)' : 'rgba(220,20,60,0.08)',
                    }}
                  >
                    {formatFundingRate(t.funding_rate)}
                  </span>
                </div>

                {/* 24h volume */}
                <div className="w-24 flex-shrink-0 text-right hidden md:block">
                  <span className="font-mono text-xs text-ink-light">
                    {formatUSD(t.converted_volume?.usd || t.h24_volume || 0, true)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Header labels */}
        <div className="flex items-center gap-3 mt-3 px-3">
          <span className="w-5" />
          <span className="w-28 font-sans text-[10px] text-ink-muted uppercase tracking-wider">Pair</span>
          <span className="flex-1 font-sans text-[10px] text-ink-muted uppercase tracking-wider">Open Interest</span>
          <span className="w-24 text-right font-sans text-[10px] text-ink-muted uppercase tracking-wider">Funding</span>
          <span className="w-24 text-right font-sans text-[10px] text-ink-muted uppercase tracking-wider hidden md:block">24h Vol</span>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-rule">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.green, opacity: 0.15, border: `1px solid ${COLORS.green}` }} />
            <span className="font-sans text-[11px] text-ink-muted">Positive funding (longs pay)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3" style={{ backgroundColor: COLORS.red, opacity: 0.15, border: `1px solid ${COLORS.red}` }} />
            <span className="font-sans text-[11px] text-ink-muted">Negative funding (shorts pay)</span>
          </span>
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

// --- Quarterly Table with heat-map shading ---
function QuarterlyTable({ quarters }: { quarters: QuarterlyData[] }) {
  const rows = quarters.slice(-8).reverse()

  // Compute column maxes for heat-map intensity
  const cols = ['totalVolume', 'avgDailyVolume', 'peakDailyVolume', 'totalFees', 'estimatedRevenue'] as const
  const maxes = {} as Record<typeof cols[number], number>
  for (const col of cols) {
    maxes[col] = Math.max(...rows.map(q => q[col] || 0))
  }

  function heatBg(value: number, max: number): React.CSSProperties {
    if (!max || !value || value <= 0) return {}
    const ratio = value / max
    // Green tint: peak = 0.18 opacity, lowest = 0.03
    const alpha = 0.03 + ratio * 0.15
    return { backgroundColor: `rgba(46, 125, 79, ${alpha})` }
  }

  return (
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
          {rows.map((q) => (
            <tr key={q.quarter}>
              <td className="font-sans text-sm font-semibold text-ink">{q.quarter}</td>
              <td className="text-right font-mono text-sm" style={heatBg(q.totalVolume, maxes.totalVolume)}>
                {formatUSD(q.totalVolume, true)}
              </td>
              <td className="text-right font-mono text-sm" style={heatBg(q.avgDailyVolume, maxes.avgDailyVolume)}>
                {formatUSD(q.avgDailyVolume, true)}
              </td>
              <td className="text-right font-mono text-sm" style={heatBg(q.peakDailyVolume, maxes.peakDailyVolume)}>
                {formatUSD(q.peakDailyVolume, true)}
              </td>
              <td className="text-right font-mono text-sm" style={heatBg(q.totalFees, maxes.totalFees)}>
                {q.totalFees > 0 ? formatUSD(q.totalFees, true) : '\u2014'}
              </td>
              <td className="text-right font-mono text-sm" style={heatBg(q.estimatedRevenue, maxes.estimatedRevenue)}>
                {q.estimatedRevenue > 0 ? formatUSD(q.estimatedRevenue, true) : '\u2014'}
              </td>
              <td className={classNames('text-right font-mono text-sm', percentClass(q.growthVsLast))}>
                {q.growthVsLast != null ? formatPercent(q.growthVsLast) : '\u2014'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

        {/* Token Economics */}
        {data.tokenInfo && slug && (
          <TokenEconomicsSection info={data.tokenInfo} slug={slug} />
        )}

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
                Volume, fees, and growth by quarter — darker shading = column peak
              </p>
              <QuarterlyTable quarters={data.quarterlyData} />
            </section>
          </ErrorBoundary>
        )}

        {/* Treasury */}
        {data.treasury && <TreasurySection treasury={data.treasury} />}

        {/* Trading Pairs by OI */}
        {data.tickers.length > 0 && <TradingPairsSection tickers={data.tickers} />}

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
