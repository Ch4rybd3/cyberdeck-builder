/**
 * Derived geometry for the open build, recomputed on every change in a Web
 * Worker. Lives outside the build store because it is large, not
 * serialisable and never part of undo history.
 *
 * Only the latest request matters: while one build is being generated, newer
 * changes replace the queued one instead of piling up. Modules attached to
 * the build's DeckPort sockets are generated with it.
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

import type { Build } from '../domain/schema'
import { attachModules, modulesFor, type AttachedModule } from '../geometry/attach'
import { generateCase, type GeometryResult } from '../geometry/caseBuilder'
import { loadKernel } from '../geometry/kernel'
import { loadFonts } from '../geometry/text'
import type { WorkerResponse } from '../geometry/worker'
import { useBuild } from './buildStore'

interface GeoState {
  result: GeometryResult | null
  attached: AttachedModule[]
  error: string | null
  busy: boolean
  /** Build revision the result belongs to. */
  forBuild: string | null
}

export const useGeometry = create<GeoState>(() => ({ result: null, attached: [], error: null, busy: false, forBuild: null }))

const rev = (b: Build) => `${b.id}@${b.updatedAt}`

interface Job {
  build: Build
  modules: Build[]
}

let worker: Worker | null = null
let nextId = 1
let inFlight: { id: number; rev: string } | null = null
let queued: Job | null = null
let latest: Job | null = null

function startWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker
  try {
    worker = new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const done = inFlight
      inFlight = null
      if (done && e.data.id === done.id) {
        if (e.data.result) useGeometry.setState({ result: e.data.result, attached: e.data.attached ?? [], error: null, forBuild: done.rev })
        else useGeometry.setState({ error: e.data.error ?? 'Geometry failed' })
      }
      if (queued) {
        const j = queued
        queued = null
        send(j)
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

function send(job: Job) {
  const w = startWorker()
  if (!w) return runInline(job)
  inFlight = { id: nextId++, rev: rev(job.build) }
  w.postMessage({ id: inFlight.id, build: job.build, modules: job.modules })
}

let inlineTimer: ReturnType<typeof setTimeout> | undefined
function runInline(job: Job) {
  clearTimeout(inlineTimer)
  inlineTimer = setTimeout(async () => {
    try {
      const [wasm] = await Promise.all([loadKernel(), loadFonts()])
      const attached = attachModules(wasm, job.build, job.modules)
      useGeometry.setState({ result: generateCase(wasm, job.build), attached, error: null, busy: false, forBuild: rev(job.build) })
    } catch (e) {
      useGeometry.setState({ error: e instanceof Error ? e.message : String(e), busy: false })
    }
  }, 120)
}

function schedule(job: Job) {
  latest = job
  useGeometry.setState({ busy: true })
  if (inFlight) queued = job
  else send(job)
}

/** The library modules attached to the open build's DeckPort sockets. */
export function useAttachedModules(): Build[] {
  const build = useBuild(s => s.build)
  const library = useBuild(s => s.library)
  return useMemo(() => modulesFor(build, library), [build, library])
}

/** Mount once near the root: keeps geometry in sync with the open build and its modules. */
export function useGeometrySync() {
  const build = useBuild(s => s.build)
  const ready = useBuild(s => s.ready)
  const modules = useAttachedModules()
  const modulesKey = modules.map(rev).join('|')
  useEffect(() => {
    if (ready) schedule({ build, modules })
    // modulesKey stands for `modules`: regenerate when an attached module changes, not on every library write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, ready, modulesKey])
}
