/**
 * Application state: the open build, its undo history, and the local library.
 *
 * Local-first: builds live in IndexedDB in this browser. Nothing is sent
 * anywhere. Export a .cyberdeck.json file or a share link to move a build.
 */
import { createStore, del, entries, set } from 'idb-keyval'
import { create } from 'zustand'

import { syncCustomComponents } from '../catalog/components'
import { exampleBuilds, newBuild } from '../catalog/templates'
import { migrate } from '../domain/migrate'
import type { Build } from '../domain/schema'
import { uid } from '../lib/id'

const db = createStore('cyberdeck-builder', 'builds')
const CURRENT_KEY = 'cdb.currentBuild'
const SEEDED_KEY = 'cdb.seededExamples'
const HISTORY_LIMIT = 80

interface State {
  ready: boolean
  build: Build
  library: Build[]
  past: Build[]
  future: Build[]
  selection: { kind: 'placement' | 'feature' | 'accessory' | 'case'; id?: string } | null

  init(): Promise<void>
  /** Apply a change to the open build. Records undo history and autosaves. */
  update(fn: (draft: Build) => void, opts?: { coalesce?: string }): void
  undo(): void
  redo(): void
  select(sel: State['selection']): void
  open(id: string): void
  create(templateId: string): Build
  saveAs(build: Build, opts?: { fork?: boolean }): Build
  remove(id: string): Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastCoalesce: { key: string; at: number } | null = null

function persist(build: Build) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    set(build.id, build, db).catch(() => undefined)
  }, 400)
  try {
    localStorage.setItem(CURRENT_KEY, build.id)
  } catch {
    // Private mode — the build still lives in IndexedDB.
  }
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

export const useBuild = create<State>((setState, get) => ({
  ready: false,
  build: exampleBuilds()[0],
  library: [],
  past: [],
  future: [],
  selection: null,

  async init() {
    let stored: Build[] = []
    try {
      const rows = await entries<string, unknown>(db)
      stored = rows.map(([, v]) => migrate(v).build).filter((b): b is Build => Boolean(b))
    } catch {
      stored = []
    }
    // Seed each example once. An example the user deleted is not brought back,
    // but examples added in a new version appear in an existing library.
    let seeded: string[] = []
    try {
      seeded = JSON.parse(localStorage.getItem(SEEDED_KEY) ?? '[]')
    } catch {
      seeded = []
    }
    const fresh = exampleBuilds().filter(e => !seeded.includes(e.id) && !stored.some(b => b.id === e.id))
    if (fresh.length) {
      await Promise.all(fresh.map(b => set(b.id, b, db).catch(() => undefined)))
      stored = [...stored, ...fresh]
    }
    try {
      localStorage.setItem(SEEDED_KEY, JSON.stringify([...new Set([...seeded, ...exampleBuilds().map(e => e.id)])]))
    } catch {
      // Private mode: examples are simply re-offered next time.
    }
    stored.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    let currentId: string | null = null
    try {
      currentId = localStorage.getItem(CURRENT_KEY)
    } catch {
      currentId = null
    }
    const current = stored.find(b => b.id === currentId) ?? stored[0]
    setState({ ready: true, library: stored, build: current, past: [], future: [] })
  },

  update(fn, opts) {
    const prev = get().build
    const next = clone(prev)
    fn(next)
    next.updatedAt = new Date().toISOString()
    // Typing in a numeric field produces one change per keystroke; group them.
    const now = Date.now()
    const coalesce = opts?.coalesce && lastCoalesce?.key === opts.coalesce && now - lastCoalesce.at < 1200
    lastCoalesce = opts?.coalesce ? { key: opts.coalesce, at: now } : null
    const past = coalesce ? get().past : [...get().past, prev].slice(-HISTORY_LIMIT)
    setState({ build: next, past, future: [], library: upsert(get().library, next) })
    persist(next)
  },

  undo() {
    const { past, build, future } = get()
    const prev = past[past.length - 1]
    if (!prev) return
    setState({ build: prev, past: past.slice(0, -1), future: [build, ...future], library: upsert(get().library, prev) })
    persist(prev)
  },

  redo() {
    const { past, build, future } = get()
    const next = future[0]
    if (!next) return
    setState({ build: next, past: [...past, build], future: future.slice(1), library: upsert(get().library, next) })
    persist(next)
  },

  select(selection) {
    setState({ selection })
  },

  open(id) {
    const b = get().library.find(x => x.id === id)
    if (!b) return
    setState({ build: b, past: [], future: [], selection: null })
    persist(b)
  },

  create(templateId) {
    const b = newBuild(templateId)
    setState({ build: b, library: upsert(get().library, b), past: [], future: [], selection: null })
    persist(b)
    return b
  },

  saveAs(build, opts) {
    const now = new Date().toISOString()
    const copy: Build = clone(build)
    if (opts?.fork || get().library.some(b => b.id === build.id)) {
      copy.forkedFrom = { id: build.id, name: build.name }
      copy.id = uid('build')
      copy.name = opts?.fork ? `${build.name} (fork)` : build.name
      copy.createdAt = now
    }
    copy.updatedAt = now
    setState({ build: copy, library: upsert(get().library, copy), past: [], future: [], selection: null })
    persist(copy)
    return copy
  },

  async remove(id) {
    await del(id, db).catch(() => undefined)
    const library = get().library.filter(b => b.id !== id)
    if (get().build.id === id) {
      const fallback = library[0] ?? newBuild('slab')
      setState({ build: fallback, library: library.length ? library : [fallback], past: [], future: [] })
      persist(fallback)
    } else {
      setState({ library })
    }
  },
}))

function upsert(list: Build[], b: Build): Build[] {
  const i = list.findIndex(x => x.id === b.id)
  if (i === -1) return [b, ...list]
  const copy = list.slice()
  copy[i] = b
  return copy
}

// Keep custom-component lookups pointing at the open build.
useBuild.subscribe(s => syncCustomComponents(s.build))
syncCustomComponents(useBuild.getState().build)
