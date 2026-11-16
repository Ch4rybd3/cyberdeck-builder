/**
 * Assembly simulation state: for a focused checklist item, where every piece
 * and component is (installed, being installed, not yet there) and how the
 * one being installed moves. Pure functions, so the viewer only renders.
 */
import type { AssemblyItem, AssemblyStep, Motion } from '../../domain/assembly'
import type { GeneratedPiece } from '../../geometry/caseBuilder'

export interface FlatItem extends AssemblyItem {
  stepIndex: number
  index: number
  key: string
}

export function flatten(steps: AssemblyStep[]): FlatItem[] {
  return steps.flatMap((s, stepIndex) => s.items.map((it, i) => ({ ...it, stepIndex, index: i, key: `${s.id}:${i}` })))
}

export function targetsPiece(item: AssemblyItem, piece: GeneratedPiece): boolean {
  if (item.pieces?.includes(piece.id)) return true
  if (item.piecePrefixes?.some(p => piece.id.startsWith(p))) return true
  // Parts mean the Core's own tray and lid, not those of a mounted module.
  if (item.parts && !piece.id.startsWith('mod-') && (piece.group === 'tray' || piece.group === 'lid') && item.parts.includes(piece.group)) return true
  return false
}

/** First item that installs an object (any motion except 'show'). */
export function installIndex(items: FlatItem[], match: (it: FlatItem) => boolean): number {
  const i = items.findIndex(it => it.motion && it.motion !== 'show' && match(it))
  return i
}

export type ObjectState = { visible: boolean; highlight: boolean; motion: Motion | null }

/**
 * State of one object at the focused item:
 *   – installed by an earlier item: visible, in place;
 *   – installed by the focused item: visible, animating with its motion;
 *   – installed later: hidden, unless the focused item just points at it ('show');
 *   – never installed by any item (e.g. the tray when nothing is split): always there.
 */
export function stateAt(items: FlatItem[], focus: number, installAt: number, targeted: boolean): ObjectState {
  const item = items[focus]
  if (installAt === -1) return { visible: true, highlight: targeted, motion: null }
  if (installAt < focus) return { visible: true, highlight: targeted, motion: null }
  if (installAt === focus) return { visible: true, highlight: true, motion: item?.motion ?? null }
  return { visible: targeted, highlight: targeted, motion: null }
}

/** Smoothstep of a looping 0 → 1 phase: hold, move, hold. */
export function phase(seconds: number): number {
  const cycle = 2.6
  const t = (seconds % cycle) / cycle
  const x = Math.min(1, Math.max(0, (t - 0.12) / 0.6))
  return x * x * (3 - 2 * x)
}
