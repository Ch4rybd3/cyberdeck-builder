/**
 * Derived geometry for the open build, recomputed on every change in a Web
 * Worker. Lives outside the build store because it is large, not
 * serialisable and never part of undo history.
 *
 * Only the latest request matters: while one build is being generated, newer
 * changes replace the queued one instead of piling up.
 */
import { useEffect } from 'react'
import { create } from 'zustand'

import type { Build } from '../domain/schema'
import { generateCase, type GeometryResult } from '../geometry/caseBuilder'
import { loadKernel } from '../geometry/kernel'
import type { WorkerResponse } from '../geometry/worker'
import { useBuild } from './buildStore'

interface GeoState {
  result: GeometryResult | null
  error: string | null
  busy: boolean
  /** Build revision the result belongs to. */
  forBuild: string | null
}

export const useGeometry = create<GeoState>(() => ({ result: null, error: null, busy: false, forBuild: null }))

const rev = (b: Build) => `${b.id}@${b.updatedAt}`

let worker: Worker | null = null
let nextId = 1
let inFlight: { id: number; rev: string } | null = null
let queued: Build | null = null
let latest: Build | null = null

function startWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker
  try {
    worker = new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const done = inFlight
      inFlight = null
      if (done && e.data.id === done.id) {
        if (e.data.result) useGeometry.setState({ result: e.data.result, error: null, forBuild: done.rev })
        else useGeometry.setState({ error: e.data.error ?? 'Geometry failed' })
      }
      if (queued) {
        const b = queued
        queued = null
        send(b)
      } else useGeometry.setState({ busy: false })
    }
    worker.onerror = () => {
      // Fall back to the main thread for the rest of the session.
      worker = null
      inFlight = null
      queued = null
      if (latest) runInline(latest)
    }
  } catch {
    worker = null
  }
  return worker
}

function send(build: Build) {
  const w = startWorker()
  if (!w) return runInline(build)
  inFlight = { id: nextId++, rev: rev(build) }
  w.postMessage({ id: inFlight.id, build })
}

let inlineTimer: ReturnType<typeof setTimeout> | undefined
function runInline(build: Build) {
  clearTimeout(inlineTimer)
  inlineTimer = setTimeout(async () => {
    try {
      const wasm = await loadKernel()
      useGeometry.setState({ result: generateCase(wasm, build), error: null, busy: false, forBuild: rev(build) })
    } catch (e) {
      useGeometry.setState({ error: e instanceof Error ? e.message : String(e), busy: false })
    }
  }, 120)
}

function schedule(build: Build) {
  latest = build
  useGeometry.setState({ busy: true })
  if (inFlight) queued = build
  else send(build)
}

/** Mount once near the root: keeps geometry in sync with the open build. */
export function useGeometrySync() {
  const build = useBuild(s => s.build)
  const ready = useBuild(s => s.ready)
  useEffect(() => {
    if (ready) schedule(build)
  }, [build, ready])
}
