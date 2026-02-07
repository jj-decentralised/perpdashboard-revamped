import { useMemo, useState, useEffect } from 'react'
import type { EnrichedExchange } from '../../types'
import { COLORS } from '../../utils/chartTheme'
import { formatUSD, formatNumber, formatPercent } from '../../utils/format'
import { MetricInfo } from '../MetricInfo'

interface Props {
  exchanges: EnrichedExchange[]
}

interface EmissionEntry {
  name: string
  protocolId: string
  token: string
  circSupply: number | null
  totalLocked: number | null
  maxSupply: number | null
  mcap: number | null
  gecko_id: string | null
  events: any[]
  nextEvent: any | null
  unlocksPerDay: number | null
}

interface UnlockRow {
  name: string
  tokenSymbol: string | null
  mcap: number | null
  circSupply: number | null
  totalLocked: number | null
  maxSupply: number | null
  pctVested: number | null
  unlocksPerDay: number | null
  unlockPressure30d: number | null
  nextEvent: string | null
  volume24h: number
}

export function TokenUnlockCalendar({ exchanges }: Props) {
  const [emissions, setEmissions] = useState<EmissionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('https://api.llama.fi/emissions')
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setEmissions(data)
        }
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo((): UnlockRow[] => {
    if (emissions.length === 0) return []

    // Build lookup of exchanges by name/slug
    const exchangeMap = new Map<string, EnrichedExchange>()
    for (const e of exchanges) {
      if (!e.hasToken) continue
      exchangeMap.set(e.name.toLowerCase(), e)
      exchangeMap.set(e.slug.toLowerCase(), e)
      const stripped = e.slug.toLowerCase().replace(/-(perps?|perpetuals?|trade|pro|v\d+|exchange|protocol)$/i, '')
      if (stripped) exchangeMap.set(stripped, e)
      if (e.displayName) exchangeMap.set(e.displayName.toLowerCase(), e)
    }

    const matched: UnlockRow[] = []
    for (const em of emissions) {
      const nameLower = (em.name || '').toLowerCase()
      const pidLower = (em.protocolId || '').toString().toLowerCase()

      // Try matching
      let ex = exchangeMap.get(nameLower)
      if (!ex) {
        // Try partial match
        for (const [key, val] of exchangeMap) {
          if (nameLower.includes(key) || key.includes(nameLower) || pidLower.includes(key)) {
            ex = val
            break
          }
        }
      }
      if (!ex) continue

      const circSupply = em.circSupply || null
      const totalLocked = em.totalLocked || null
      const maxSupply = em.maxSupply || null
      const pctVested = circSupply && maxSupply && maxSupply > 0
        ? (circSupply / maxSupply) * 100
        : null

      const unlocksPerDay = em.unlocksPerDay || null
      const unlockPressure30d = unlocksPerDay && circSupply && circSupply > 0
        ? (unlocksPerDay * 30 / circSupply) * 100
        : null

      const nextEvent = em.nextEvent
        ? typeof em.nextEvent === 'object'
          ? em.nextEvent.description || em.nextEvent.date || null
          : String(em.nextEvent)
        : null

      matched.push({
        name: ex.displayName || ex.name,
        tokenSymbol: ex.tokenSymbol,
        mcap: em.mcap || ex.mcap || null,
        circSupply,
        totalLocked,
        maxSupply,
        pctVested,
        unlocksPerDay,
        unlockPressure30d,
        nextEvent,
        volume24h: ex.total24h || 0,
      })
    }

    return matched.sort((a, b) => (b.unlockPressure30d || 0) - (a.unlockPressure30d || 0))
  }, [emissions, exchanges])

  if (loading) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Token Unlock Calendar</h3>
        <p className="chart-subtitle">Loading emissions data...</p>
        <div className="loading-pulse h-40" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="chart-title">Token Unlock Calendar</h3>
        <p className="chart-subtitle">Token unlock data for perpetual exchanges</p>
        <p className="font-sans text-sm text-ink-muted py-8 text-center">
          No matching emission data found for tracked exchanges.
        </p>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <h3 className="chart-title">Token Unlock Calendar</h3>
      <p className="chart-subtitle">
        Vesting progress and unlock pressure for governance tokens of perpetual exchanges
      </p>
      <MetricInfo
        description="Token unlocks create sell pressure as vested tokens enter circulation. The 30-day unlock pressure score shows what percentage of circulating supply will be unlocked in the next month. High pressure combined with low P/E can signal buying opportunities, while high pressure with high valuation flags dilution risk."
        source="DeFiLlama emissions API providing circulating supply, total locked, daily unlock rates, and upcoming unlock events per protocol."
      />

      <div className="overflow-x-auto">
        <table className="data-table w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left">Protocol</th>
              <th className="text-right">Token</th>
              <th className="text-right">Mcap</th>
              <th className="text-right">% Vested</th>
              <th className="text-right">Locked</th>
              <th className="text-right">Unlocks/Day</th>
              <th className="text-right" title="Tokens unlocking in next 30d as % of circulating supply">30d Pressure</th>
              <th className="text-right">24h Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.name} className={i % 2 === 1 ? 'bg-paper-warm' : ''}>
                <td className="font-sans text-sm font-medium text-ink whitespace-nowrap">
                  {row.name}
                </td>
                <td className="text-right">
                  {row.tokenSymbol ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-paper-alt text-ink-light border border-rule">
                      {row.tokenSymbol}
                    </span>
                  ) : '\u2014'}
                </td>
                <td className="text-right font-mono text-xs">
                  {row.mcap ? formatUSD(row.mcap, true) : '\u2014'}
                </td>
                <td className="text-right">
                  {row.pctVested != null ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-paper-alt overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, row.pctVested)}%`,
                            backgroundColor: row.pctVested > 80 ? COLORS.green : row.pctVested > 50 ? COLORS.amber : COLORS.blue,
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-ink-muted">{row.pctVested.toFixed(0)}%</span>
                    </div>
                  ) : '\u2014'}
                </td>
                <td className="text-right font-mono text-xs text-ink-muted">
                  {row.totalLocked ? formatNumber(row.totalLocked, 0) : '\u2014'}
                </td>
                <td className="text-right font-mono text-xs text-ink-muted">
                  {row.unlocksPerDay ? formatNumber(row.unlocksPerDay, 0) : '\u2014'}
                </td>
                <td className="text-right">
                  {row.unlockPressure30d != null ? (
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: row.unlockPressure30d > 5 ? COLORS.red : row.unlockPressure30d > 2 ? COLORS.amber : COLORS.green }}
                    >
                      {row.unlockPressure30d.toFixed(2)}%
                    </span>
                  ) : '\u2014'}
                </td>
                <td className="text-right font-mono text-xs text-ink-muted">
                  {formatUSD(row.volume24h, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-[10px] text-ink-muted mt-3">
        <strong>30d Pressure</strong> = (daily unlocks × 30) / circulating supply. Red (&gt;5%) = high dilution risk, Amber (2-5%) = moderate, Green (&lt;2%) = low.
      </p>
    </div>
  )
}
