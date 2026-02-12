/**
 * Cluster wrapper: spawns one worker per CPU core.
 *
 * Each worker runs server/index.js with its own in-memory cache.
 * The background warmup loop in each worker keeps caches in sync since
 * they all hit the same upstream endpoints on the same schedule.
 *
 * Usage: node server/cluster.js (instead of node server/index.js)
 * Falls back to single-process mode with CLUSTER=false or 1 CPU.
 */

import cluster from 'node:cluster'
import { availableParallelism } from 'node:os'

const WORKERS = parseInt(process.env.WEB_CONCURRENCY || '', 10) || availableParallelism()
const CLUSTER_DISABLED = process.env.CLUSTER === 'false'

if (cluster.isPrimary && !CLUSTER_DISABLED && WORKERS > 1) {
  console.log(`[cluster] Primary ${process.pid} spawning ${WORKERS} workers`)

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code) => {
    console.warn(`[cluster] Worker ${worker.process.pid} exited (code ${code}), respawning...`)
    cluster.fork()
  })
} else {
  // Single worker — just run the server
  await import('./index.js')
}
