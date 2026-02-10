import { useState, useEffect, useRef } from 'react'
import type { DashboardData } from '../types'
import { fetchDashboardData, fetchVolumeShareData, fetchSpotVolumeHistory, fetchHolderYieldBatch, fetchTreasuryBatch, getCachedTreasury, fetchHistoricalFeeData, getCachedFeeHistory, fetchDexCexVolumeShare, fetchEnhancedDexCexShare } from '../services/defillama'
import { TT_ENABLED, COINGLASS_ENABLED } from '../config/api'
import { fetchCEXVolumeHistory } from '../services/coinglass'
import { getCachedTTMetrics, fetchTTMetricsBatch, cacheTTMetrics, computeTTAggregate, mergeTTIntoExchanges } from '../services/tokenterminal'

interface UseDashboardDataReturn {
  data: DashboardData | null
  loading: boolean
  error: string | null
}

export function useDashboardData(): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        // Fast initial load (lightweight overview, no breakdown data)
        const result = await fetchDashboardData()
        if (cancelled) return

        // Seed with cached data for instant display
        const cachedTreasury = getCachedTreasury()
        if (cachedTreasury.length > 0) {
          result.treasuryData = cachedTreasury
        }
        const cachedFeeHistory = getCachedFeeHistory()
        if (cachedFeeHistory.perpFeeBreakdown.length > 0) {
          result.perpFeeBreakdown = cachedFeeHistory.perpFeeBreakdown
          result.perpFeeBreakdownNames = cachedFeeHistory.perpFeeBreakdownNames
          result.perpFeeShareHistory = cachedFeeHistory.perpFeeShareHistory
        }

        // Seed with cached TT data if available
        if (TT_ENABLED) {
          const cachedTT = getCachedTTMetrics()
          if (cachedTT.size > 0) {
            result.enrichedExchanges = mergeTTIntoExchanges(result.enrichedExchanges, cachedTT)
            result.ttAggregate = computeTTAggregate(cachedTT)
          }
        }

        setData(result)
        setLoading(false)

        // Lazy load: fetch breakdown data, spot volume, holder yield, treasury in background
        const lazyPromises: Promise<void>[] = []

        if (result.topExchangeNames.length > 0) {
          lazyPromises.push(
            fetchVolumeShareData(result.topExchangeNames).then((volumeShareHistory) => {
              if (!cancelled && volumeShareHistory.length > 0) {
                setData((prev) => prev ? { ...prev, volumeShareHistory } : prev)
              }
            })
          )
        }

        lazyPromises.push(
          fetchSpotVolumeHistory().then((spotVolumeHistory) => {
            if (!cancelled && spotVolumeHistory.length > 0) {
              setData((prev) => prev ? { ...prev, spotVolumeHistory } : prev)
            }
          })
        )

        // DEX vs CEX volume share — use CoinGlass for accurate CEX data when available
        lazyPromises.push(
          (async () => {
            try {
              // Try CoinGlass first for accurate CEX volume
              const cexHistory = COINGLASS_ENABLED
                ? await fetchCEXVolumeHistory().catch(() => null)
                : null
              // Merge CoinGlass CEX + DefiLlama DEX (falls back to DefiLlama-only if null)
              const dexCexShareHistory = await fetchEnhancedDexCexShare(cexHistory)
              if (!cancelled && dexCexShareHistory.length > 0) {
                setData((prev) => prev ? { ...prev, dexCexShareHistory } : prev)
              }
            } catch {
              // Final fallback: pure DefiLlama
              const dexCexShareHistory = await fetchDexCexVolumeShare().catch(() => [])
              if (!cancelled && dexCexShareHistory.length > 0) {
                setData((prev) => prev ? { ...prev, dexCexShareHistory } : prev)
              }
            }
          })()
        )

        // Holder yield batch (top 20 token exchanges)
        lazyPromises.push(
          fetchHolderYieldBatch(result.enrichedExchanges).then((yieldMap) => {
            if (!cancelled && yieldMap.size > 0) {
              setData((prev) => {
                if (!prev) return prev
                const updated = prev.enrichedExchanges.map(ex => {
                  const y = yieldMap.get(ex.slug)
                  return y != null ? { ...ex, holderYield: y } : ex
                })
                return { ...prev, enrichedExchanges: updated }
              })
            }
          }).catch(() => {})
        )

        // Treasury batch (top 20 token exchanges)
        lazyPromises.push(
          fetchTreasuryBatch(result.enrichedExchanges).then((treasuryData) => {
            if (!cancelled && treasuryData.length > 0) {
              setData((prev) => prev ? { ...prev, treasuryData } : prev)
            }
          }).catch(() => {})
        )

        // Historical fee breakdown (perp revenue share + perps % of DeFi fees)
        const perpSlugs = new Set(result.enrichedExchanges.map(e => e.slug?.toLowerCase()).filter(Boolean))
        lazyPromises.push(
          fetchHistoricalFeeData(perpSlugs).then((feeHistory) => {
            if (!cancelled && feeHistory.perpFeeBreakdown.length > 0) {
              setData((prev) => prev ? {
                ...prev,
                perpFeeBreakdown: feeHistory.perpFeeBreakdown,
                perpFeeBreakdownNames: feeHistory.perpFeeBreakdownNames,
                perpFeeShareHistory: feeHistory.perpFeeShareHistory,
              } : prev)
            }
          }).catch(() => {})
        )

        // Token Terminal metrics (optional — only if API key configured)
        if (TT_ENABLED) {
          lazyPromises.push(
            fetchTTMetricsBatch(result.enrichedExchanges).then((ttData) => {
              if (!cancelled && ttData.size > 0) {
                cacheTTMetrics(ttData)
                const ttAggregate = computeTTAggregate(ttData)
                setData((prev) => {
                  if (!prev) return prev
                  const updated = mergeTTIntoExchanges(prev.enrichedExchanges, ttData)
                  return { ...prev, enrichedExchanges: updated, ttAggregate }
                })
              }
            }).catch(() => {})
          )
        }

        await Promise.all(lazyPromises)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch data'
          )
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
