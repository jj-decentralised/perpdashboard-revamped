/**
 * Persistent TTL cache for API responses.
 *
 * In-memory Map for fast reads, with write-through to disk so data
 * survives server restarts. On startup, loads all valid entries from
 * disk into memory — gives instant warm cache without hitting APIs.
 *
 * Storage: data/cache/<md5-hash>.json per entry
 * Set DATA_DIR env var to a persistent volume mount for deploy survival.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data', 'cache')
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

// ── In-memory store (fast reads) ──
const store = new Map()

// ── Load persisted cache on startup ──
try {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
  const now = Date.now()
  let loaded = 0
  let expired = 0

  for (const file of files) {
    try {
      const raw = readFileSync(join(DATA_DIR, file), 'utf-8')
      const entry = JSON.parse(raw)
      if (entry.key && entry.data && now <= entry.expires) {
        store.set(entry.key, { data: entry.data, expires: entry.expires, storedAt: entry.storedAt })
        loaded++
      } else {
        expired++
        unlink(join(DATA_DIR, file)).catch(() => {})
      }
    } catch {
      // Corrupt file, delete it
      unlink(join(DATA_DIR, file)).catch(() => {})
    }
  }

  if (files.length > 0) {
    console.log(`[cache] Loaded ${loaded} entries from disk (${expired} expired, ${files.length} total files)`)
  }
} catch (err) {
  console.warn(`[cache] Disk persistence unavailable: ${err.message}`)
}

// ── Helpers ──
function hashKey(key) {
  return createHash('md5').update(key).digest('hex')
}

function persistToDisk(key, data, expires, storedAt) {
  try {
    const filePath = join(DATA_DIR, hashKey(key) + '.json')
    // Write asynchronously — don't block the request
    writeFile(filePath, JSON.stringify({ key, data, expires, storedAt })).catch(() => {})
  } catch {
    // Disk write failed, cache still works in-memory
  }
}

function deleteFromDisk(key) {
  try {
    unlink(join(DATA_DIR, hashKey(key) + '.json')).catch(() => {})
  } catch {
    // Ignore
  }
}

// ── Public API (same interface as before) ──

export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    store.delete(key)
    deleteFromDisk(key)
    return null
  }
  return entry.data
}

export function cacheSet(key, data, ttlMs = DEFAULT_TTL) {
  const expires = Date.now() + ttlMs
  const storedAt = Date.now()
  store.set(key, { data, expires, storedAt })
  persistToDisk(key, data, expires, storedAt)
}

export function cacheStats() {
  let valid = 0
  let expired = 0
  const now = Date.now()
  for (const [, entry] of store) {
    if (now > entry.expires) expired++
    else valid++
  }
  return { valid, expired, total: store.size, persistent: true }
}

export function cacheClear() {
  store.clear()
}
