/**
 * In-memory TTL cache for API responses.
 * Stores raw JSON strings keyed by URL path.
 */

const store = new Map()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function cacheSet(key, data, ttlMs = DEFAULT_TTL) {
  store.set(key, {
    data,
    expires: Date.now() + ttlMs,
    storedAt: Date.now(),
  })
}

export function cacheStats() {
  let valid = 0
  let expired = 0
  const now = Date.now()
  for (const [, entry] of store) {
    if (now > entry.expires) expired++
    else valid++
  }
  return { valid, expired, total: store.size }
}

export function cacheClear() {
  store.clear()
}
