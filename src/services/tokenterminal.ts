/**
 * Token Terminal API integration — optional data enrichment.
 * All functions return null/empty on failure. Dashboard works without a TT API key.
 */
import { TT_BASE, TT_ENABLED, ttHeaders } from '../config/api'
import type { EnrichedExchange, TTAggregateData } from '../types'

// ── DefiLlama slug → Token Terminal project ID mapping ──

const SLUG_TO_TT_ID: Record<string, string> = {
  'hyperliquid-perps': 'hyperliquid',
  'jupiter-perpetual-exchange': 'jupiter',
  'dydx-v4': 'dydx',
  dydx: 'dydx',
  gmx: 'gmx',
  'gmx-v2-perps': 'gmx',
  'gains-network': 'gains-network',
  'gains-network-perps': 'gains-network',
  'drift-trade': 'drift',
  'vertex-protocol': 'vertex-protocol',
  kwenta: 'kwenta',
  synthetix: 'synthetix',
  'perpetual-protocol': 'perpetual-protocol',
  'apex-omni': 'apex',
  rabbitx: 'rabbitx',
  'level-finance': 'level-finance',
  'aevo-perps': 'aevo',
  'orderly-perps': 'orderly-network',
  'mux-protocol': 'mux-protocol',
  'bluefin-perps': 'bluefin',
}

/** Per-project metrics snapshot from Token Terminal */
export interface TTMetricSnapshot {
  projectId: string
  revenue: number | null
  fees: number | null
  earnings: number | null
  tokenIncentives: number | null
  activeUsers: number | null
  priceToEarnings: number | null
  priceToSales: number | null
  codeCommits7d: number | null
}

// ── Slug resolution ──

export function resolveTTId(slug: string): string | null {
  if (!slug) return null
  const lower = slug.toLowerCase()
  if (SLUG_TO_TT_ID[lower]) return SLUG_TO_TT_ID[lower]
  // Try stripping common suffixes
  const stripped = lower.replace(/-(perps?|perpetuals?|protocol|finance|exchange|dex|swap|v\d+|derivatives?|trade|pro|omni|markets?|interface|digital|terminal|labs)$/i, '').trim()
  if (stripped !== lower && SLUG_TO_TT_ID[stripped]) return SLUG_TO_TT_ID[stripped]
  return null
}

// ── API fetching ──

// Metrics we request from Token Terminal
const TT_METRIC_IDS = [
  'revenue',
  'fees',
  'earnings',
  'token_incentives',
  'active_users',
  'price_to_earnings',
  'price_to_fees',
].join(',')

async function fetchTTJSON<T>(url: string): Promise<T | null> {
  if (!TT_ENABLED) return null
  try {
    // When using proxy, auth headers are added server-side; only send them in direct mode
    const headers = url.startsWith('/api/') ? {} : ttHeaders()
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.warn(`[TT] fetch failed: ${res.status} ${url}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`[TT] fetch error:`, err)
    return null
  }
}

/** Get a date string N days ago in YYYY-MM-DD format. */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Fetch latest metrics for a single Token Terminal project. */
export async function fetchTTMetrics(projectId: string): Promise<TTMetricSnapshot | null> {
  // Request last 7 days and take the most recent row with data
  const start = daysAgo(7)
  const end = daysAgo(0)
  const data = await fetchTTJSON<any>(
    `${TT_BASE}/projects/${projectId}/metrics?metric_ids=${TT_METRIC_IDS}&start=${start}&end=${end}&order_direction=desc`
  )
  if (!data?.data || data.data.length === 0) return null

  // Log first response for debugging (remove in production)
  if (data.errors?.length > 0) {
    console.warn(`[TT] ${projectId} errors:`, data.errors)
  }

  // Merge values from all returned rows (API may return separate rows per metric/date)
  // Take the first non-null value for each metric (most recent since ordered desc)
  let revenue: number | null = null
  let fees: number | null = null
  let earnings: number | null = null
  let tokenIncentives: number | null = null
  let activeUsers: number | null = null
  let priceToEarnings: number | null = null
  let priceToSales: number | null = null

  for (const m of data.data) {
    if (revenue == null && m.revenue != null) revenue = m.revenue
    if (fees == null && m.fees != null) fees = m.fees
    if (earnings == null && m.earnings != null) earnings = m.earnings
    if (tokenIncentives == null && m.token_incentives != null) tokenIncentives = m.token_incentives
    if (activeUsers == null && m.active_users != null) activeUsers = m.active_users
    if (priceToEarnings == null && m.price_to_earnings != null) priceToEarnings = m.price_to_earnings
    if (priceToSales == null && m.price_to_fees != null) priceToSales = m.price_to_fees
    // Break early if we have everything
    if (revenue != null && fees != null && earnings != null && tokenIncentives != null && activeUsers != null && priceToEarnings != null && priceToSales != null) break
  }

  // Log what we found for debugging
  console.log(`[TT] ${projectId}: rev=${revenue}, fees=${fees}, earn=${earnings}, incentives=${tokenIncentives}, users=${activeUsers}, pe=${priceToEarnings}, ps=${priceToSales} (${data.data.length} rows)`)

  return {
    projectId,
    revenue,
    fees,
    earnings,
    tokenIncentives,
    activeUsers,
    priceToEarnings,
    priceToSales,
    codeCommits7d: null,
  }
}

/** Batch-fetch TT metrics for all matched exchanges (5 at a time, 200ms gap). */
export async function fetchTTMetricsBatch(
  exchanges: EnrichedExchange[]
): Promise<Map<string, TTMetricSnapshot>> {
  if (!TT_ENABLED) return new Map()

  // Deduplicate: multiple DefiLlama slugs can map to the same TT project
  const slugToTT = new Map<string, string>()
  for (const ex of exchanges) {
    const ttId = resolveTTId(ex.slug)
    if (ttId && !slugToTT.has(ttId)) {
      slugToTT.set(ttId, ex.slug)
    }
  }

  const uniqueIds = [...slugToTT.keys()]
  const results = new Map<string, TTMetricSnapshot>()

  // Process in batches of 5 with 200ms delay between batches
  const BATCH_SIZE = 5
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((id) => fetchTTMetrics(id).catch(() => null))
    )
    for (const snap of batchResults) {
      if (snap) results.set(snap.projectId, snap)
    }
    // Rate limit: wait 200ms between batches (skip for last batch)
    if (i + BATCH_SIZE < uniqueIds.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return results
}

/** Compute sector aggregate from individual TT snapshots. */
export function computeTTAggregate(snapshots: Map<string, TTMetricSnapshot>): TTAggregateData {
  let sectorRevenue = 0
  let sectorEarnings = 0
  let sectorIncentives = 0
  let sectorActiveUsers = 0
  let coverageCount = 0

  for (const snap of snapshots.values()) {
    coverageCount++
    if (snap.revenue != null) sectorRevenue += snap.revenue
    if (snap.earnings != null) sectorEarnings += snap.earnings
    if (snap.tokenIncentives != null) sectorIncentives += snap.tokenIncentives
    if (snap.activeUsers != null) sectorActiveUsers += snap.activeUsers
  }

  return { sectorRevenue, sectorEarnings, sectorIncentives, sectorActiveUsers, coverageCount }
}

// ── LocalStorage caching (4h TTL) ──

const TT_CACHE_KEY = 'tt_metrics_batch'
const TT_CACHE_TS_KEY = 'tt_metrics_batch_ts'
const TT_CACHE_TTL = 4 * 3600000 // 4 hours

/** Read cached TT metrics from localStorage. */
export function getCachedTTMetrics(): Map<string, TTMetricSnapshot> {
  try {
    const cached = localStorage.getItem(TT_CACHE_KEY)
    const ts = localStorage.getItem(TT_CACHE_TS_KEY)
    if (cached && ts && Date.now() - Number(ts) < TT_CACHE_TTL) {
      const entries: [string, TTMetricSnapshot][] = JSON.parse(cached)
      return new Map(entries)
    }
  } catch { /* localStorage unavailable or corrupt */ }
  return new Map()
}

/** Write TT metrics cache to localStorage. */
export function cacheTTMetrics(data: Map<string, TTMetricSnapshot>): void {
  try {
    localStorage.setItem(TT_CACHE_KEY, JSON.stringify([...data.entries()]))
    localStorage.setItem(TT_CACHE_TS_KEY, String(Date.now()))
  } catch { /* localStorage full or unavailable */ }
}

/** Merge TT data into enriched exchanges (mutates in place for efficiency). */
export function mergeTTIntoExchanges(
  exchanges: EnrichedExchange[],
  ttData: Map<string, TTMetricSnapshot>
): EnrichedExchange[] {
  return exchanges.map((ex) => {
    const ttId = resolveTTId(ex.slug)
    if (!ttId) return ex
    const snap = ttData.get(ttId)
    if (!snap) return ex
    return {
      ...ex,
      ttRevenue: snap.revenue,
      ttEarnings: snap.earnings,
      ttTokenIncentives: snap.tokenIncentives,
      ttActiveUsers: snap.activeUsers,
      ttPE: snap.priceToEarnings,
      ttPS: snap.priceToSales,
      ttCodeCommits7d: snap.codeCommits7d,
    }
  })
}
