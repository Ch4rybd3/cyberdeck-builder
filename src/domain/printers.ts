/**
 * Printer profiles. The bed is the usable print area, already reduced by a
 * small safety margin, and `colors` is how many filaments the printer can use
 * in one print without a manual swap.
 */
export interface PrinterProfile {
  id: string
  name: string
  bed: { x: number; y: number; z: number }
  colors: number
  /** How multi-colour is achieved, shown in the print notes. */
  colorSystem: string
  /** Average effective volumetric rate in mm³/s for the time estimate (walls, infill and travel together). */
  flow: number
}

export const PRINTERS: PrinterProfile[] = [
  { id: 'ender-3', name: 'Creality Ender 3', bed: { x: 220, y: 220, z: 250 }, colors: 1, colorSystem: 'Manual filament swap (M600) at a layer height', flow: 5 },
  { id: 'ender-3-v3', name: 'Creality Ender 3 V3', bed: { x: 220, y: 220, z: 250 }, colors: 1, colorSystem: 'Manual filament swap (M600) at a layer height', flow: 9 },
  { id: 'bambu-a1', name: 'Bambu Lab A1', bed: { x: 256, y: 256, z: 256 }, colors: 4, colorSystem: 'AMS lite (4 slots)', flow: 11 },
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', bed: { x: 180, y: 180, z: 180 }, colors: 4, colorSystem: 'AMS lite (4 slots)', flow: 10 },
  { id: 'bambu-p1s', name: 'Bambu Lab P1S', bed: { x: 256, y: 256, z: 256 }, colors: 4, colorSystem: 'AMS (4 slots, up to 16 chained)', flow: 13 },
  { id: 'bambu-x1c', name: 'Bambu Lab X1 Carbon', bed: { x: 256, y: 256, z: 256 }, colors: 4, colorSystem: 'AMS (4 slots, up to 16 chained)', flow: 13 },
  { id: 'prusa-mk4', name: 'Prusa MK4', bed: { x: 250, y: 210, z: 220 }, colors: 1, colorSystem: 'Manual swap, or MMU3 (5 slots)', flow: 9 },
  { id: 'prusa-core-one', name: 'Prusa CORE One', bed: { x: 250, y: 220, z: 270 }, colors: 1, colorSystem: 'Manual swap, or MMU3 (5 slots)', flow: 10 },
]

export const BED_MARGIN = 5

export function printerById(id: string): PrinterProfile {
  return PRINTERS.find(p => p.id === id) ?? PRINTERS[0]
}

export const MATERIALS = {
  PLA: { density: 1.24, pricePerKg: 20, note: 'Easy to print. Softens around 55 °C — avoid for a deck left in a car.' },
  PETG: { density: 1.27, pricePerKg: 22, note: 'Tougher and more heat-resistant than PLA. Good default for cases.' },
  ASA: { density: 1.07, pricePerKg: 28, note: 'UV- and heat-resistant. Needs an enclosure.' },
  ABS: { density: 1.04, pricePerKg: 22, note: 'Heat-resistant. Needs an enclosure and ventilation.' },
} as const
