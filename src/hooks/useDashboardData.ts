import { useState, useEffect, useRef } from 'react'
import type { DashboardData } from '../types'
import { fetchDashboardData, fetchVolumeShareData } from '../services/defillama'

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
        setData(result)
        setLoading(false)

        // Lazy load: fetch breakdown for volume share chart in background
        if (result.topExchangeNames.length > 0) {
          const volumeShareHistory = await fetchVolumeShareData(result.topExchangeNames)
          if (!cancelled && volumeShareHistory.length > 0) {
            setData((prev) => prev ? { ...prev, volumeShareHistory } : prev)
          }
        }
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
