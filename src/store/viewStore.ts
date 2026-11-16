/**
 * Viewport options. A store rather than component state so the toolbar, the
 * viewport and the documentation screenshot script all drive the same view.
 */
import { create } from 'zustand'

export interface ViewOptions {
  explode: number
  lid: 'solid' | 'ghost' | 'hidden'
  components: boolean
  accessories: boolean
  /** Hinged cases: lid opening angle in degrees. */
  lidOpen: number
  /** Screen sliders: 0 = closed, 1 = fully open. */
  slide: number
  /** Camera preset; `cameraRev` bumps to re-apply the same preset. */
  camera: 'iso' | 'top' | 'front' | 'side'
  cameraRev: number
  /** Placement under the pointer, for the name tooltip. */
  hovered: string | null
  /** Show modules attached to DeckPort sockets. */
  modules: boolean
  /** Kickstand legs: 0 = folded, 1 = fully open. */
  stand: number
  /** Workshop tool: select only, move along X/Y/Z, or rotate about X/Y/Z. */
  tool: 'select' | 'move' | 'rotate'
}

interface ViewState extends ViewOptions {
  set(patch: Partial<ViewOptions>): void
}

export const useView = create<ViewState>(set => ({
  explode: 0,
  lid: 'ghost',
  components: true,
  accessories: true,
  lidOpen: 0,
  slide: 0,
  camera: 'iso',
  cameraRev: 0,
  hovered: null,
  tool: 'select',
  modules: true,
  stand: 0,
  set: patch => set(patch),
}))
