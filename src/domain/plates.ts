/**
 * Print plates: lays the generated pieces out on the printer's bed with simple
 * shelf packing (largest first, rotating a piece 90° when that fits better),
 * and estimates print time from volume and the printer's effective flow.
 *
 * The estimate is deliberately rough — a slicer knows layer times, speeds and
 * travel; this only says "an evening" or "a weekend".
 */
import type { GeneratedPiece } from '../geometry/caseBuilder'
import { BED_MARGIN, MATERIALS, type PrinterProfile } from './printers'

export interface PlateItem {
  piece: GeneratedPiece
  /** Centre of the piece on the bed, in mm from the bed's front-left corner. */
  x: number
  y: number
  /** Footprint on the bed after rotation. */
  w: number
  d: number
  rotated: boolean
}

export interface Plate {
  items: PlateItem[]
  volume: number
  minutes: number
  colors: string[]
}

const GAP = 6

export function packPlates(pieces: GeneratedPiece[], printer: PrinterProfile, infillPercent: number): { plates: Plate[]; oversize: GeneratedPiece[] } {
  const W = printer.bed.x - 2 * BED_MARGIN
  const D = printer.bed.y - 2 * BED_MARGIN
  const oversize: GeneratedPiece[] = []
  const queue = pieces
    .filter(piece => {
      const [a, b, h] = piece.size
      const fits = h <= printer.bed.z && ((a <= W && b <= D) || (b <= W && a <= D))
      if (!fits) oversize.push(piece)
      return fits
    })
    // Largest footprint first: the big pieces set the shelves, the small ones fill the gaps.
    .sort((p, q) => q.size[0] * q.size[1] - p.size[0] * p.size[1])

  interface Shelf { y: number; h: number; x: number }
  interface Open { items: PlateItem[]; shelves: Shelf[] }
  const open: Open[] = []

  /** Try both orientations on one plate: an existing shelf with room, or a new shelf below. */
  const tryPlace = (plate: Open, piece: GeneratedPiece): boolean => {
    const [a, b] = piece.size
    const options = [
      { w: a, d: b, rotated: false },
      { w: b, d: a, rotated: true },
    ].filter(o => o.w <= W && o.d <= D)
    for (const shelf of plate.shelves)
      for (const o of options)
        if (shelf.x + o.w <= W && o.d <= shelf.h) {
          plate.items.push({ piece, x: BED_MARGIN + shelf.x + o.w / 2, y: BED_MARGIN + shelf.y + o.d / 2, w: o.w, d: o.d, rotated: o.rotated })
          shelf.x += o.w + GAP
          return true
        }
    const bottom = plate.shelves.reduce((m, sh) => Math.max(m, sh.y + sh.h + GAP), 0)
    // A new shelf takes the orientation that keeps it shallowest.
    for (const o of [...options].sort((p, q) => p.d - q.d))
      if (bottom + o.d <= D) {
        plate.shelves.push({ y: bottom, h: o.d, x: o.w + GAP })
        plate.items.push({ piece, x: BED_MARGIN + o.w / 2, y: BED_MARGIN + bottom + o.d / 2, w: o.w, d: o.d, rotated: o.rotated })
        return true
      }
    return false
  }

  for (const piece of queue) {
    if (open.some(plate => tryPlace(plate, piece))) continue
    const plate: Open = { items: [], shelves: [] }
    open.push(plate)
    tryPlace(plate, piece)
  }
  return { plates: open.map(p => summarise(p.items, printer, infillPercent)), oversize }
}

function summarise(items: PlateItem[], printer: PrinterProfile, infillPercent: number): Plate {
  const volume = items.reduce((a, it) => a + it.piece.bodies.reduce((x, b) => x + b.volume, 0), 0)
  const solid = 0.55 + 0.45 * (infillPercent / 100)
  const colors = [...new Set(items.flatMap(it => it.piece.bodies.map(b => b.color.toUpperCase())))]
  // Each extra colour on a single-nozzle printer costs purge and swap time.
  const swaps = Math.max(0, colors.length - 1) * (printer.colors > 1 ? 25 : 5)
  const minutes = (volume * solid) / printer.flow / 60 * 1.15 + 6 + swaps
  return { items, volume, minutes, colors }
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

export function filamentGrams(plate: Plate, material: keyof typeof MATERIALS, infillPercent: number): number {
  return (plate.volume / 1000) * MATERIALS[material].density * (0.55 + 0.45 * (infillPercent / 100))
}
