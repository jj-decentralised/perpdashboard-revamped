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
  BarChart,
  Bar,
} from 'recharts'
import { useExchangeProfile } from '../hooks/useExchangeProfile'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { TabNavigation, useTabNavigation } from '../components/TabNavigation'
import { COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHART_PALETTE } from '../utils/chartTheme'
import { EMISSIONS_BASE } from '../config/api'
import { formatUSD, formatDateShort, formatFundingRate, formatNumber, formatPercent, formatMultiple, percentClass, classNames } from '../utils/format'
import type { CGExchangeTicker } from '../types/coingecko'
import type { TokenInfo, QuarterlyData, ComparableExchange, TreasuryInfo, HistoricalPEPoint, MarketSharePoint, BuilderVolumeData, TVLData } from '../types/profile'

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

function PSTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload as HistoricalPEPoint
  if (!d) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      <p style={{ margin: 0, color: COLORS.inkMuted, fontSize: 12 }}>P/S: {d.ps != null ? formatMultiple(d.ps) : '\u2014'}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>Price: ${d.price?.toFixed(4)}</p>
      <p style={{ margin: 0, color: COLORS.inkLight, fontSize: 12 }}>Mcap: {formatUSD(d.mcap, true)}</p>
    </div>
  )
}

function MarketShareTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ margin: 0, color: entry.color || COLORS.inkLight, fontSize: 12 }}>
          {entry.name === 'marketPct' ? '% of Market' : '% of Hyperliquid'}: {entry.value?.toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

// --- Shared TVL tooltip ---
function TVLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
  const total = sorted.reduce((s: number, e: any) => s + (e.value || 0), 0)
  return (
    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
      {sorted.map((entry: any) => (
        entry.value > 0 && (
          <p key={entry.name} style={{ margin: 0, color: entry.color || COLORS.inkLight, fontSize: 12 }}>
            {entry.name}: {formatUSD(entry.value, true)}
          </p>
        )
      ))}
      {total > 0 && (
        <p style={{ margin: '4px 0 0', borderTop: `1px solid ${COLORS.rule}`, paddingTop: 4, fontWeight: 600, color: COLORS.ink, fontSize: 12 }}>
          Total: {formatUSD(total, true)}
        </p>
      )}
    </div>
  )
}

// --- TVL History Section (Chain breakdown + Asset composition) ---
function TVLHistorySection({ tvlData }: { tvlData: TVLData }) {
  const { history, chains, tokenHistory, tokenNames, currentTokens } = tvlData

  // Compute current total TVL from the last data point
  const lastPoint = history[history.length - 1]
  const currentTotal = chains.reduce((sum, c) => sum + (lastPoint?.[c] || 0), 0)

  return (
    <ErrorBoundary fallbackLabel="TVL History">
      <section className="section-rule">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <h3 className="chart-title">Total Value Locked</h3>
            <p className="chart-subtitle">
              Historical TVL breakdown by chain {currentTotal > 0 ? `— currently ${fmtAxis(currentTotal)}` : ''}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: COLORS.rule }}
              minTickGap={60}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip content={TVLTooltip} />
            {chains.map((chain, i) => (
              <Bar
                key={chain}
                dataKey={chain}
                name={chain}
                stackId="tvl"
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                fillOpacity={0.85}
                animationDuration={800}
                radius={i === chains.length - 1 ? [2, 2, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          {chains.map((chain, i) => (
            <span key={chain} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3"
                style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length], opacity: 0.85 }}
              />
              <span className="font-sans text-[11px] text-ink-muted">{chain}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Asset composition chart */}
      {tokenHistory && tokenNames && tokenHistory.length > 3 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <h3 className="chart-title">TVL by Asset</h3>
              <p className="chart-subtitle">
                Collateral composition over time
                {currentTokens && (() => {
                  const top3 = Object.entries(currentTokens)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, val]) => `${name} ${fmtAxis(val)}`)
                  return top3.length > 0 ? ` — ${top3.join(', ')}` : ''
                })()}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={tokenHistory} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={{ stroke: COLORS.rule }}
                minTickGap={60}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip content={TVLTooltip} />
              {tokenNames.map((token, i) => (
                <Area
                  key={token}
                  type="monotone"
                  dataKey={token}
                  name={token}
                  stackId="tokens"
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                  fillOpacity={0.7}
                  strokeWidth={0}
                  animationDuration={800}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {tokenNames.map((token, i) => (
              <span key={token} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3"
                  style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length], opacity: 0.7 }}
                />
                <span className="font-sans text-[11px] text-ink-muted">{token}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </ErrorBoundary>
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
        const res = await fetch(`${EMISSIONS_BASE}/emissions`)
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

// --- Token Holder Rights Map ---
interface TokenRightsInfo {
  rights: string[]
  buyback: string | null
  feeSharing: string | null
  governance: string | null
  staking: string | null
}

const TOKEN_RIGHTS_MAP: Record<string, TokenRightsInfo> = {
  'hyperliquid-perps': {
    rights: ['Assistance Fund buybacks', 'Community governance (planned)'],
    buyback: 'Assistance Fund regularly buys HYPE from open market',
    feeSharing: null,
    governance: 'Community governance in development',
    staking: null,
  },
  gmx: {
    rights: ['Fee sharing to stakers', 'Governance voting', 'esGMX rewards'],
    buyback: null,
    feeSharing: '30% of platform fees distributed to GMX stakers in ETH/AVAX',
    governance: 'Snapshot governance voting',
    staking: 'Stake GMX for esGMX + multiplier points + ETH/AVAX fee yield',
  },
  'gmx-v2-perps': {
    rights: ['Fee sharing to stakers', 'Governance voting', 'esGMX rewards'],
    buyback: null,
    feeSharing: '30% of platform fees distributed to GMX stakers in ETH/AVAX',
    governance: 'Snapshot governance voting',
    staking: 'Stake GMX for esGMX + multiplier points + ETH/AVAX fee yield',
  },
  synthetix: {
    rights: ['Fee sharing to stakers', 'Governance voting', 'Inflationary rewards'],
    buyback: null,
    feeSharing: 'Stakers earn fees generated by Synthetix Perps and other products',
    governance: 'On-chain governance via Spartan Council elections',
    staking: 'Stake SNX to mint sUSD and earn trading fees + SNX inflation',
  },
  'dydx-v4': {
    rights: ['Governance voting', 'Fee rebates via staking', 'Safety module'],
    buyback: null,
    feeSharing: 'DYDX stakers receive trading fee rebates on dYdX Chain',
    governance: 'Full on-chain governance for protocol parameter changes',
    staking: 'Stake DYDX for fee discounts and governance power',
  },
  dydx: {
    rights: ['Governance voting', 'Fee rebates via staking', 'Safety module'],
    buyback: null,
    feeSharing: 'DYDX stakers receive trading fee rebates on dYdX Chain',
    governance: 'Full on-chain governance for protocol parameter changes',
    staking: 'Stake DYDX for fee discounts and governance power',
  },
  'jupiter-perpetual-exchange': {
    rights: ['Governance voting', 'Active Staking Rewards', 'Fee buyback'],
    buyback: 'JUP buyback from 50% of protocol fees',
    feeSharing: 'Active Staking Rewards (ASR) distributed to active governance voters',
    governance: 'Governance voting on Realms (proposals, DAO treasury allocation)',
    staking: 'Stake JUP for governance + ASR rewards each epoch',
  },
  'drift-trade': {
    rights: ['Governance voting', 'Insurance fund staking'],
    buyback: null,
    feeSharing: 'Insurance fund stakers earn yield from liquidation surplus',
    governance: 'Realms governance voting for protocol changes',
    staking: 'Stake DRIFT for governance power + insurance fund participation',
  },
  'vertex-protocol': {
    rights: ['USDC rewards to stakers', 'Governance voting'],
    buyback: null,
    feeSharing: 'USDC rewards from trading fees distributed to VRTX stakers',
    governance: 'Governance voting for protocol parameters',
    staking: 'Stake VRTX for USDC yield from trading fees',
  },
  'gains-network': {
    rights: ['Fee sharing to stakers', 'Governance voting'],
    buyback: null,
    feeSharing: 'GNS stakers earn share of trading fees',
    governance: 'Snapshot governance',
    staking: 'Single-sided GNS staking with fee-based yield',
  },
  'gains-network-perps': {
    rights: ['Fee sharing to stakers', 'Governance voting'],
    buyback: null,
    feeSharing: 'GNS stakers earn share of trading fees',
    governance: 'Snapshot governance',
    staking: 'Single-sided GNS staking with fee-based yield',
  },
  'aevo-perps': {
    rights: ['Governance voting', 'Fee discounts'],
    buyback: null,
    feeSharing: null,
    governance: 'Governance voting for protocol parameters',
    staking: 'Stake AEVO for trading fee discounts',
  },
  'rabbitx': {
    rights: ['Fee sharing to stakers'],
    buyback: null,
    feeSharing: 'RBX stakers earn portion of trading fees',
    governance: null,
    staking: 'Stake RBX for fee revenue share',
  },
}

function TokenHolderRightsSection({ slug, holdersRevenue, tokenInfo }: {
  slug: string
  holdersRevenue: import('../types/profile').HoldersRevenueData | null
  tokenInfo: import('../types/profile').TokenInfo
}) {
  const rights = TOKEN_RIGHTS_MAP[slug]
  const hasHolderRevData = holdersRevenue && (holdersRevenue.daily != null && holdersRevenue.daily > 0)
  if (!rights && !hasHolderRevData) return null

  const annualHolderRev = holdersRevenue?.daily ? holdersRevenue.daily * 365 : null
  const holderYield = annualHolderRev && tokenInfo.marketCap > 0
    ? (annualHolderRev / tokenInfo.marketCap) * 100
    : null

  return (
    <ErrorBoundary fallbackLabel="Token holder rights">
      <section className="section-rule">
        <h3 className="chart-title">Token Holder Rights</h3>
        <p className="chart-subtitle">
          Value accrual mechanisms for {tokenInfo.symbol} holders
        </p>

        {/* Rights badges */}
        {rights && (
          <div className="flex flex-wrap gap-2 mt-4">
            {rights.rights.map((r) => (
              <span
                key={r}
                className="inline-flex items-center px-3 py-1.5 text-xs font-sans font-medium bg-accent-green/10 text-accent-green border border-accent-green/30"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Revenue metrics */}
        {(hasHolderRevData || rights) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {holdersRevenue?.daily != null && holdersRevenue.daily > 0 && (
              <div className="kpi-card">
                <p className="font-sans text-[11px] uppercase tracking-wider text-ink-muted">Daily Holder Revenue</p>
                <p className="font-mono text-lg font-bold text-accent-green mt-1">{formatUSD(holdersRevenue.daily, true)}</p>
              </div>
            )}
            {holdersRevenue?.total30d != null && holdersRevenue.total30d > 0 && (
              <div className="kpi-card">
                <p className="font-sans text-[11px] uppercase tracking-wider text-ink-muted">30d Holder Revenue</p>
                <p className="font-mono text-lg font-bold text-ink mt-1">{formatUSD(holdersRevenue.total30d, true)}</p>
              </div>
            )}
            {annualHolderRev != null && annualHolderRev > 0 && (
              <div className="kpi-card">
                <p className="font-sans text-[11px] uppercase tracking-wider text-ink-muted">Annual (est.)</p>
                <p className="font-mono text-lg font-bold text-ink mt-1">{formatUSD(annualHolderRev, true)}</p>
              </div>
            )}
            {holderYield != null && holderYield > 0 && (
              <div className="kpi-card">
                <p className="font-sans text-[11px] uppercase tracking-wider text-ink-muted">Holder Yield</p>
                <p className="font-mono text-lg font-bold text-accent-green mt-1">{holderYield.toFixed(2)}%</p>
                <p className="font-sans text-[10px] text-ink-muted mt-0.5">ann. holder rev / mcap</p>
              </div>
            )}
          </div>
        )}

        {/* Details */}
        {rights && (
          <div className="space-y-3 mt-5">
            {rights.feeSharing && (
              <div className="border-l-2 border-accent-green pl-4">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-0.5">Fee Sharing</p>
                <p className="font-sans text-sm text-ink-light">{rights.feeSharing}</p>
              </div>
            )}
            {rights.buyback && (
              <div className="border-l-2 border-accent-blue pl-4">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-0.5">Buyback Program</p>
                <p className="font-sans text-sm text-ink-light">{rights.buyback}</p>
              </div>
            )}
            {rights.staking && (
              <div className="border-l-2 border-accent-amber pl-4">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-0.5">Staking</p>
                <p className="font-sans text-sm text-ink-light">{rights.staking}</p>
              </div>
            )}
            {rights.governance && (
              <div className="border-l-2 border-accent-slate pl-4">
                <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-0.5">Governance</p>
                <p className="font-sans text-sm text-ink-light">{rights.governance}</p>
              </div>
            )}
          </div>
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
  const cols = ['totalVolume', 'avgDailyVolume', 'peakDailyVolume', 'totalFees'] as const
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

// --- Builder Code Data Tab (Hyperliquid only) ---
function BuilderCodeTab({ builderVolume }: { builderVolume: BuilderVolumeData }) {
  const { data: bvData, builders, builderSharePct, cumulativeIncome } = builderVolume

  // Compute KPIs
  const totalBuilderVol = useMemo(() => {
    let total = 0
    for (const point of bvData) {
      for (const b of builders) {
        total += point[b] || 0
      }
    }
    return total
  }, [bvData, builders])

  const latestShare = builderSharePct.length > 0
    ? builderSharePct[builderSharePct.length - 1].pct
    : 0
  const latestIncome = cumulativeIncome.length > 0
    ? cumulativeIncome[cumulativeIncome.length - 1].income
    : 0
  const builderCount = builders.filter(b => b !== 'Other').length

  return (
    <div className="mt-6">
      {/* KPI Summary */}
      <ErrorBoundary fallbackLabel="Builder KPIs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Total Builder Volume</p>
            <p className="font-mono text-lg font-bold text-ink">{formatUSD(totalBuilderVol, true)}</p>
            <p className="font-sans text-[10px] text-ink-muted">all-time (weekly sampled)</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Est. Cumulative Income</p>
            <p className="font-mono text-lg font-bold" style={{ color: COLORS.green }}>{formatUSD(latestIncome, true)}</p>
            <p className="font-sans text-[10px] text-ink-muted">at ~1 bp referral rate</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Current Builder Share</p>
            <p className="font-mono text-lg font-bold text-ink">{latestShare.toFixed(2)}%</p>
            <p className="font-sans text-[10px] text-ink-muted">of total HL volume</p>
          </div>
          <div className="kpi-card">
            <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">Active Builders</p>
            <p className="font-mono text-lg font-bold text-ink">{builderCount}</p>
            <p className="font-sans text-[10px] text-ink-muted">tracked by DefiLlama</p>
          </div>
        </div>
      </ErrorBoundary>

      {/* Builder Volume Stacked Column Chart */}
      <ErrorBoundary fallbackLabel="Builder volume">
        <section className="section-rule">
          <h3 className="chart-title">Builder Volume Breakdown</h3>
          <p className="chart-subtitle">
            Weekly volume by protocols building on Hyperliquid
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={bvData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
              <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
              <YAxis tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0)
                return (
                  <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
                    <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                    {payload.filter((e: any) => e.value > 0).map((entry: any) => (
                      <p key={entry.name} style={{ margin: 0, color: entry.color || COLORS.inkLight, fontSize: 12 }}>
                        {entry.name}: {formatUSD(entry.value, true)}
                      </p>
                    ))}
                    <p style={{ margin: '4px 0 0', color: COLORS.ink, fontSize: 12, fontWeight: 600, borderTop: `1px solid ${COLORS.rule}`, paddingTop: 4 }}>
                      Total: {formatUSD(total, true)}
                    </p>
                    <p style={{ margin: '2px 0 0', color: COLORS.inkMuted, fontSize: 11 }}>
                      Est. income: {formatUSD(total * 0.0001, true)}
                    </p>
                  </div>
                )
              }} />
              {builders.map((builder, i) => (
                <Bar
                  key={builder}
                  dataKey={builder}
                  stackId="builders"
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  fillOpacity={builder === 'Other' ? 0.3 : 0.75}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {builders.map((builder, i) => (
              <span key={builder} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3" style={{
                  backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
                  opacity: builder === 'Other' ? 0.3 : 0.75,
                }} />
                <span className="font-sans text-[11px] text-ink-muted">{builder}</span>
              </span>
            ))}
          </div>
        </section>
      </ErrorBoundary>

      {/* Builder Share of HL Volume */}
      {builderSharePct.length > 3 && (
        <ErrorBoundary fallbackLabel="Builder share">
          <section className="section-rule">
            <h3 className="chart-title">Builder Share of Hyperliquid Volume</h3>
            <p className="chart-subtitle">
              What percentage of Hyperliquid's total volume flows through ecosystem builders
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={builderSharePct} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="builderShareGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                  axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={AXIS_STYLE} tickLine={false}
                  axisLine={false} width={48} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
                      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                      <p style={{ margin: 0, color: COLORS.blue, fontSize: 12 }}>
                        Builder Share: {payload[0]?.value?.toFixed(2)}%
                      </p>
                    </div>
                  )
                }} />
                <Area type="monotone" dataKey="pct" stroke={COLORS.blue} strokeWidth={2}
                  fill="url(#builderShareGrad)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
                <span className="font-sans text-[11px] text-ink-muted">Builder % of Total HL Volume</span>
              </span>
            </div>
          </section>
        </ErrorBoundary>
      )}

      {/* Cumulative Builder Income */}
      {cumulativeIncome.length > 3 && (
        <ErrorBoundary fallbackLabel="Cumulative income">
          <section className="section-rule">
            <h3 className="chart-title">Cumulative Estimated Builder Income</h3>
            <p className="chart-subtitle">
              Running total of estimated referral fees earned by builders on Hyperliquid at ~1 bp rate
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cumulativeIncome} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="cumIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                  axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                <YAxis tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false}
                  axisLine={false} width={58} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{ ...TOOLTIP_STYLE.contentStyle, lineHeight: 1.5 }}>
                      <p style={TOOLTIP_STYLE.labelStyle}>{label ? formatDateShort(label) : ''}</p>
                      <p style={{ margin: 0, color: COLORS.green, fontSize: 12 }}>
                        Cumulative Income: {formatUSD(payload[0]?.value, true)}
                      </p>
                    </div>
                  )
                }} />
                <Area type="monotone" dataKey="income" stroke={COLORS.green} strokeWidth={2}
                  fill="url(#cumIncomeGrad)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.green }} />
                <span className="font-sans text-[11px] text-ink-muted">Cumulative Est. Income</span>
              </span>
            </div>
          </section>
        </ErrorBoundary>
      )}

      {/* Disclaimer */}
      <div className="mt-8 p-4 border border-rule bg-paper-alt">
        <p className="font-sans text-xs text-ink-muted leading-relaxed">
          <strong>Indicative only.</strong> Builder code data is derived from DefiLlama protocol volume breakdowns for protocols that deploy on the Hyperliquid chain.
          This does not capture all builder activity — frontends, bots, copy-trading interfaces, and other builder-code users that don't have separate DefiLlama entries are not included.
          Income estimates assume a ~1 basis point referral rate; actual builder code payouts vary by arrangement and may differ significantly.
          For authoritative builder metrics, refer to Hyperliquid's on-chain data directly.
        </p>
      </div>
    </div>
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

  // Filter valid P/S data points (cap at 500x to remove noise)
  const validPE = useMemo(() => {
    if (!data?.historicalPE?.length) return []
    return data.historicalPE.filter((p) => p.ps != null && p.ps > 0 && p.ps < 500)
  }, [data?.historicalPE])

  // Historical fee data — weekly smoothing
  const feeHistoryData = useMemo(() => {
    if (!data?.feeHistory?.length) return []

    const raw = data.feeHistory.map((f) => ({ date: f.date, fees: f.value }))

    // 7-day rolling average for smoother chart
    if (raw.length < 7) return raw
    const smoothed: typeof raw = []
    for (let i = 6; i < raw.length; i++) {
      let sumFee = 0
      for (let j = i - 6; j <= i; j++) {
        sumFee += raw[j].fees
      }
      smoothed.push({
        date: raw[i].date,
        fees: sumFee / 7,
      })
    }
    // Sample weekly for performance if > 365 points
    if (smoothed.length > 365) {
      return smoothed.filter((_, i) => i % 7 === 0 || i === smoothed.length - 1)
    }
    return smoothed
  }, [data?.feeHistory])

  const exchangeName = data?.exchange?.name || data?.summary?.name || slug || 'Exchange'
  const description = data?.summary?.description || data?.exchange?.description || ''
  const chains = data?.summary?.chains || []
  const hasPrice = volumePriceData.some((d) => d.price != null && d.price > 0)

  // Market share data
  const marketShareData = useMemo(() => {
    if (!data?.marketShareHistory?.length) return []
    return data.marketShareHistory
  }, [data?.marketShareHistory])

  const hasHlLine = marketShareData.some((d) => d.hlPct != null)
  const isHyperliquid = slug?.toLowerCase() === 'hyperliquid-perps'

  // Tab system — only shown on Hyperliquid when builder data loads
  const profileTabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'builders', label: 'Builder Code Data' },
  ], [])
  const { activeTab, selectTab } = useTabNavigation(profileTabs, 'overview')
  const showTabs = isHyperliquid && data?.builderVolume != null && data.builderVolume.data.length > 0


  // SEO: update document title and meta description
  // NOTE: This must be before any early returns to satisfy React's rules of hooks
  useEffect(() => {
    document.title = `${exchangeName} — Perpetual Exchanges in Numbers`
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
      document.title = 'Perpetual Exchanges in Numbers'
    }
  }, [exchangeName])

  // Volume chart mode: 'daily' | 'monthly' | 'cumulative'
  const [volMode, setVolMode] = useState<'daily' | 'monthly' | 'cumulative'>('daily')

  // Aggregate daily volume into monthly buckets (with month-end price)
  const monthlyVolumeData = useMemo(() => {
    if (!data?.historicalVolume?.length) return []

    // Build price map from priceHistory for month-end lookups
    const priceMap = new Map<number, number>()
    for (const [ts, price] of data?.priceHistory || []) {
      const dayKey = Math.floor(ts / 86400000) * 86400000
      priceMap.set(dayKey, price)
    }

    const buckets = new Map<string, { date: number; sum: number; lastPrice: number | null; lastDay: number }>()
    for (const d of data.historicalVolume) {
      const dt = new Date(d.date)
      const key = `${dt.getFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
      const dayKey = Math.floor(d.date / 86400000) * 86400000
      const price = priceMap.get(dayKey) ?? null
      const existing = buckets.get(key)
      if (existing) {
        existing.sum += d.value
        if (d.date > existing.lastDay) {
          existing.lastDay = d.date
          if (price != null) existing.lastPrice = price
        }
      } else {
        buckets.set(key, {
          date: new Date(dt.getFullYear(), dt.getUTCMonth(), 1).getTime(),
          sum: d.value,
          lastPrice: price,
          lastDay: d.date,
        })
      }
    }
    const monthly = Array.from(buckets.values())
      .sort((a, b) => a.date - b.date)
      .map((b) => ({ date: b.date, volume: b.sum, price: b.lastPrice }))

    if (volMode === 'cumulative') {
      let running = 0
      return monthly.map((m) => {
        running += m.volume
        return { ...m, volume: running }
      })
    }
    return monthly
  }, [data?.historicalVolume, data?.priceHistory, volMode])

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

        {/* Tab navigation — only for Hyperliquid when builder data is available */}
        {showTabs && (
          <TabNavigation tabs={profileTabs} activeTab={activeTab} onSelect={selectTab} />
        )}

        {/* ===== OVERVIEW TAB (or no-tabs default for other exchanges) ===== */}
        {(!showTabs || activeTab === 'overview') && (<>

        {/* Token Info */}
        {data.tokenInfo && <TokenInfoSection info={data.tokenInfo} />}

        {/* Token Economics */}
        {data.tokenInfo && slug && (
          <TokenEconomicsSection info={data.tokenInfo} slug={slug} />
        )}

        {/* Token Holder Rights */}
        {data.tokenInfo && slug && (
          <TokenHolderRightsSection
            slug={slug}
            holdersRevenue={data.holdersRevenue}
            tokenInfo={data.tokenInfo}
          />
        )}

        {/* Historical Volume + Price Overlay — with Daily / Monthly / Cumulative toggle */}
        {volumePriceData.length > 0 && (
          <ErrorBoundary fallbackLabel="Historical volume">
            <section className="section-rule">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className="chart-title">
                    {volMode === 'daily' && `Historical Volume${hasPrice ? ' & Token Price' : ''}`}
                    {volMode === 'monthly' && 'Monthly Volume'}
                    {volMode === 'cumulative' && 'Cumulative Volume'}
                  </h3>
                  <p className="chart-subtitle">
                    {volMode === 'daily' && `Daily trading volume${hasPrice ? ` with ${data.tokenInfo?.symbol || 'token'} price overlay` : ''}`}
                    {volMode === 'monthly' && 'Aggregated trading volume by calendar month'}
                    {volMode === 'cumulative' && 'Running total of trading volume since inception'}
                  </p>
                </div>
                <div className="flex rounded-md overflow-hidden border" style={{ borderColor: COLORS.rule }}>
                  {(['daily', 'monthly', 'cumulative'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setVolMode(mode)}
                      className="px-3 py-1 text-xs font-sans font-medium transition-colors"
                      style={{
                        backgroundColor: volMode === mode ? COLORS.ink : 'transparent',
                        color: volMode === mode ? COLORS.paper : COLORS.inkMuted,
                      }}
                    >
                      {mode === 'daily' ? 'Daily' : mode === 'monthly' ? 'Monthly' : 'Cumulative'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily view — area chart with optional price line */}
              {volMode === 'daily' && (
                <>
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
                          tick={{ ...AXIS_STYLE, fill: '#dc2626' }} tickLine={false} axisLine={false} width={68} />
                      )}
                      <Tooltip content={<VolumeWithPriceTooltip />} />
                      <Area yAxisId="vol" type="monotone" dataKey="volume" name="volume" stroke={COLORS.ink} strokeWidth={1.5}
                        fill="url(#profileVolGrad)" animationDuration={800} />
                      {hasPrice && (
                        <Line yAxisId="price" type="monotone" dataKey="price" name="price" stroke="#dc2626" strokeWidth={1.5}
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
                        <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#dc2626' }} />
                        <span className="font-sans text-[11px] text-ink-muted">{data.tokenInfo?.symbol || 'Token'} Price</span>
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Monthly view — bar chart with price overlay */}
              {volMode === 'monthly' && monthlyVolumeData.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={monthlyVolumeData} margin={{ top: 8, right: hasPrice ? 60 : 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: number) => {
                          const d = new Date(v)
                          return `${d.toLocaleString('en', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
                        }}
                        tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} minTickGap={50}
                      />
                      <YAxis yAxisId="vol" tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
                      {hasPrice && (
                        <YAxis yAxisId="price" orientation="right" tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`}
                          tick={{ ...AXIS_STYLE, fill: '#dc2626' }} tickLine={false} axisLine={false} width={68} />
                      )}
                      <Tooltip content={<VolumeWithPriceTooltip />} />
                      <Bar yAxisId="vol" dataKey="volume" name="volume" fill={COLORS.ink} fillOpacity={0.75} radius={[2, 2, 0, 0]}
                        animationDuration={800} />
                      {hasPrice && (
                        <Line yAxisId="price" type="monotone" dataKey="price" name="price" stroke="#dc2626" strokeWidth={1.5}
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
                        <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#dc2626' }} />
                        <span className="font-sans text-[11px] text-ink-muted">{data.tokenInfo?.symbol || 'Token'} Price</span>
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Cumulative view — area chart with price overlay */}
              {volMode === 'cumulative' && monthlyVolumeData.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={monthlyVolumeData} margin={{ top: 8, right: hasPrice ? 60 : 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="cumVolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.ink} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={COLORS.ink} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: number) => {
                          const d = new Date(v)
                          return `${d.toLocaleString('en', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
                        }}
                        tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: COLORS.rule }} minTickGap={50}
                      />
                      <YAxis yAxisId="vol" tickFormatter={fmtAxis} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={58} />
                      {hasPrice && (
                        <YAxis yAxisId="price" orientation="right" tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`}
                          tick={{ ...AXIS_STYLE, fill: '#dc2626' }} tickLine={false} axisLine={false} width={68} />
                      )}
                      <Tooltip content={<VolumeWithPriceTooltip />} />
                      <Area yAxisId="vol" type="monotone" dataKey="volume" name="volume" stroke={COLORS.ink} strokeWidth={1.5}
                        fill="url(#cumVolGrad)" animationDuration={800} />
                      {hasPrice && (
                        <Line yAxisId="price" type="monotone" dataKey="price" name="price" stroke="#dc2626" strokeWidth={1.5}
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
                        <span className="inline-block w-4 h-0.5" style={{ backgroundColor: '#dc2626' }} />
                        <span className="font-sans text-[11px] text-ink-muted">{data.tokenInfo?.symbol || 'Token'} Price</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>
          </ErrorBoundary>
        )}

        {/* Market Share */}
        {marketShareData.length > 7 && (
          <ErrorBoundary fallbackLabel="Market share">
            <section className="section-rule">
              <h3 className="chart-title">Market Share Over Time</h3>
              <p className="chart-subtitle">
                {isHyperliquid
                  ? 'Share of total perpetual derivatives market volume (7-day rolling average)'
                  : 'Share of total market and Hyperliquid volume (7-day rolling average)'}
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={marketShareData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                    axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                  <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={AXIS_STYLE} tickLine={false}
                    axisLine={false} width={48} />
                  <Tooltip content={<MarketShareTooltip />} />
                  <Line type="monotone" dataKey="marketPct" name="marketPct" stroke={COLORS.ink} strokeWidth={2}
                    dot={false} animationDuration={800} />
                  {hasHlLine && !isHyperliquid && (
                    <Line type="monotone" dataKey="hlPct" name="hlPct" stroke={COLORS.blue} strokeWidth={1.5}
                      dot={false} animationDuration={800} connectNulls />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.ink }} />
                  <span className="font-sans text-[11px] text-ink-muted">% of Total Perp Market</span>
                </span>
                {hasHlLine && !isHyperliquid && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.blue }} />
                    <span className="font-sans text-[11px] text-ink-muted">% of Hyperliquid Volume</span>
                  </span>
                )}
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* TVL History */}
        {data.tvlData && data.tvlData.history.length > 3 && (
          <TVLHistorySection tvlData={data.tvlData} />
        )}

        {/* Historical Fees */}
        {feeHistoryData.length > 3 && (
          <ErrorBoundary fallbackLabel="Fee history">
            <section className="section-rule">
              <h3 className="chart-title">Historical Fees</h3>
              <p className="chart-subtitle">
                7-day rolling average of daily fee generation
              </p>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={feeHistoryData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.ink} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.ink} stopOpacity={0.01} />
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
                            Fees: {formatUSD(entry.value, true)}
                          </p>
                        ))}
                      </div>
                    )
                  }} />
                  <Area type="monotone" dataKey="fees" name="fees" stroke={COLORS.ink} strokeWidth={1.5}
                    fill="url(#feeGrad)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.ink }} />
                  <span className="font-sans text-[11px] text-ink-muted">Daily Fees (7d avg)</span>
                </span>
              </div>
            </section>
          </ErrorBoundary>
        )}

        {/* Historical P/S Ratio */}
        {validPE.length > 3 && (
          <ErrorBoundary fallbackLabel="Historical P/S">
            <section className="section-rule">
              <h3 className="chart-title">Historical P/S Ratio</h3>
              <p className="chart-subtitle">
                P/S ratio over time — lower ratios suggest relative undervaluation
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={validPE} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STYLE.stroke} strokeDasharray={GRID_STYLE.strokeDasharray} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={AXIS_STYLE} tickLine={false}
                    axisLine={{ stroke: COLORS.rule }} minTickGap={60} />
                  <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}x`} tick={AXIS_STYLE} tickLine={false}
                    axisLine={false} width={48} />
                  <Tooltip content={<PSTooltip />} />
                  <Line type="monotone" dataKey="ps" name="P/S" stroke={COLORS.inkMuted} strokeWidth={2}
                    dot={false} animationDuration={800} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-0.5" style={{ backgroundColor: COLORS.inkMuted }} />
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

        </>)}

        {/* ===== BUILDER CODE DATA TAB (Hyperliquid only) ===== */}
        {showTabs && activeTab === 'builders' && data.builderVolume && (
          <BuilderCodeTab builderVolume={data.builderVolume} />
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
