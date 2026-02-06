import { useState, useEffect, useRef } from 'react'
import type { ExchangeProfileData } from '../types/profile'
import type { HistoricalDataPoint } from '../types'
import { fetchDerivativesSummary } from '../services/defillama'
import { fetchCGExchangeDetail } from '../services/coingecko'

interface UseExchangeProfileReturn {
  data: ExchangeProfileData | null
  loading: boolean
  error: string | null
}

export function useExchangeProfile(
  slug: string | undefined,
  cgId: string | null
): UseExchangeProfileReturn {
  const [data, setData] = useState<ExchangeProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!slug) return
    if (fetchedRef.current === slug) return
    fetchedRef.current = slug

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const [summary, cgDetail] = await Promise.all([
          fetchDerivativesSummary(slug!).catch(() => null),
          cgId ? fetchCGExchangeDetail(cgId).catch(() => null) : Promise.resolve(null),
        ])

        if (cancelled) return

        const historicalVolume: HistoricalDataPoint[] = (
          summary?.totalDataChart || []
        )
          .filter((entry): entry is [number, number] => Array.isArray(entry) && entry.length === 2)
          .map(([date, value]) => ({ date: date * 1000, value }))

        const tickers = cgDetail?.tickers || []

        const profileData: ExchangeProfileData = {
          summary: summary || null,
          historicalVolume,
          tickers,
          exchange: cgDetail || null,
        }

        setData(profileData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch exchange data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug, cgId])

  return { data, loading, error }
}
