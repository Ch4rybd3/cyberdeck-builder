/**
 * Fastener geometry for heat-set inserts and the screws that go into them.
 *
 * Values follow common "short" brass heat-set inserts (the CNC Kitchen /
 * Ruthex style) and ISO 4762 socket head cap screws. Holes are modelled at
 * the size that prints correctly on a typical FDM printer with a 0.4 mm
 * nozzle; adjust `holeD` if your printer runs tight or loose.
 *
 * The joining rule used everywhere in the case generator:
 *   - one side receives the insert (blind hole, `holeD` × `holeDepth`),
 *   - the other side receives a clearance hole and a counterbore for the head,
 *     so the screw is driven from the far side and pulls both parts together.
 */
import type { InsertSize } from './schema'

export interface InsertSpec {
  size: InsertSize
  /** Printed hole diameter for the insert. */
  holeD: number
  /** Insert length; the hole is made 1 mm deeper for melt overflow. */
  length: number
  holeDepth: number
  /** Minimum boss diameter around the insert. */
  bossD: number
  /** Screw clearance hole diameter. */
  clearanceD: number
  /** Counterbore for a socket head cap screw head. */
  headD: number
  headH: number
  /** Price per unit, EUR, for the shopping list estimate. */
  insertPrice: number
  screwPrice: number
}

export const INSERTS: Record<InsertSize, InsertSpec> = {
  'M2':   { size: 'M2',   holeD: 3.2, length: 3.0, holeDepth: 4.0, bossD: 5.5, clearanceD: 2.4, headD: 4.2, headH: 2.2, insertPrice: 0.06, screwPrice: 0.05 },
  'M2.5': { size: 'M2.5', holeD: 3.6, length: 4.0, holeDepth: 5.0, bossD: 6.0, clearanceD: 2.9, headD: 5.0, headH: 2.7, insertPrice: 0.07, screwPrice: 0.05 },
  'M3':   { size: 'M3',   holeD: 4.0, length: 5.7, holeDepth: 6.7, bossD: 8.0, clearanceD: 3.4, headD: 6.0, headH: 3.4, insertPrice: 0.08, screwPrice: 0.06 },
  'M4':   { size: 'M4',   holeD: 5.6, length: 8.1, holeDepth: 9.1, bossD: 10.0, clearanceD: 4.5, headD: 7.6, headH: 4.4, insertPrice: 0.12, screwPrice: 0.08 },
}

/** ISO metric screw lengths commonly sold. */
const STOCK_LENGTHS = [4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40]

/**
 * The stock screw length for a joint: it must pass the clamped material and
 * engage most of the insert, without bottoming out in the blind hole.
 */
export function screwLength(clampedThickness: number, spec: InsertSpec): number {
  const ideal = clampedThickness + spec.length * 0.8
  const max = clampedThickness + spec.holeDepth - 0.3
  const fit = STOCK_LENGTHS.filter(l => l <= max)
  const best = fit.reduce((acc, l) => (Math.abs(l - ideal) < Math.abs(acc - ideal) ? l : acc), fit[0] ?? STOCK_LENGTHS[0])
  return best
}

/** A single fastener the geometry generator placed. Rolled up into the BOM. */
export interface FastenerUse {
  size: InsertSize
  screwLength: number
  /** What this joint holds together, for the assembly notes. */
  purpose: 'closure' | 'standoff' | 'split-joint' | 'accessory' | 'deckport'
}

/**
 * Cable glands: the printed hole is the thread's major diameter plus a little,
 * so the gland screws in and its locknut clamps from the inside.
 */
export const GLANDS = {
  PG7: { hole: 12.7, nut: 15, cable: '3–6.5 mm', price: 0.6 },
  PG9: { hole: 15.4, nut: 19, cable: '4–8 mm', price: 0.7 },
  M12: { hole: 12.3, nut: 15, cable: '3–6.5 mm', price: 0.6 },
  M16: { hole: 16.3, nut: 19, cable: '4–8 mm', price: 0.7 },
  M20: { hole: 20.3, nut: 24, cable: '6–12 mm', price: 0.9 },
} as const
export type GlandSize = keyof typeof GLANDS
