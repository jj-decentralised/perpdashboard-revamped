import { useState, useEffect, useRef } from 'react'
import type { DashboardData } from '../types'
import { fetchDashboardData, fetchVolumeShareData, fetchSpotVolumeHistory, fetchHolderYieldBatch, fetchTreasuryBatch, getCachedTreasury } from '../services/defillama'

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

        // Seed with cached treasury data for instant display
        const cachedTreasury = getCachedTreasury()
        if (cachedTreasury.length > 0) {
          result.treasuryData = cachedTreasury
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
