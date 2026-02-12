/**
 * In-memory TTL cache with request coalescing and stale-while-revalidate.
 *
 * - Request coalescing: concurrent cache misses for the same key share a single
 *   in-flight fetch, preventing thundering-herd on upstream APIs.
 * - Stale-while-revalidate: expired entries are served immediately while a
 *   background refresh runs, so users never wait for upstream during revalidation.
 */

const store = new Map()

/** In-flight fetch promises, keyed by cache key. */
const inflight = new Map()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached value. Returns { data, stale } where stale=true means the entry
 * is expired but still usable while revalidating.
 */
export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    // Return stale data instead of deleting — caller can revalidate in background
    return { data: entry.data, stale: true }
  }
  return { data: entry.data, stale: false }
}

export function cacheSet(key, data, ttlMs = DEFAULT_TTL) {
  store.set(key, {
    data,
    expires: Date.now() + ttlMs,
    storedAt: Date.now(),
  })
}

/**
 * Request coalescing: if a fetch for this key is already in-flight, return the
 * same promise instead of firing a duplicate upstream request.
 *
 * @param {string} key - Cache key
 * @param {() => Promise<string>} fetchFn - Function that fetches fresh data
 * @param {number} ttlMs - Cache TTL
 * @returns {Promise<string>} The fetched (or coalesced) data
 */
export async function cacheGetOrFetch(key, fetchFn, ttlMs = DEFAULT_TTL) {
  // 1. Check cache
  const cached = cacheGet(key)
  if (cached && !cached.stale) {
    return { data: cached.data, fromCache: true }
  }

  // 2. If stale, serve stale data immediately and revalidate in background
  if (cached && cached.stale) {
    // Trigger background revalidation (coalesced)
    if (!inflight.has(key)) {
      const revalidate = fetchFn()
        .then(data => {
          cacheSet(key, data, ttlMs)
          return data
        })
        .finally(() => inflight.delete(key))
      inflight.set(key, revalidate)
    }
    return { data: cached.data, fromCache: true, stale: true }
  }

  // 3. Cache miss — coalesce concurrent requests
  if (inflight.has(key)) {
    const data = await inflight.get(key)
    return { data, fromCache: false }
  }

  const promise = fetchFn()
    .then(data => {
      cacheSet(key, data, ttlMs)
      return data
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, promise)
  const data = await promise
  return { data, fromCache: false }
}

export function cacheStats() {
  let valid = 0
  let expired = 0
  const now = Date.now()
  for (const [, entry] of store) {
    if (now > entry.expires) expired++
    else valid++
  }
  return { valid, expired, total: store.size, inflight: inflight.size }
}

export function cacheClear() {
  store.clear()
}
