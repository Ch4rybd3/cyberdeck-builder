/**
 * DeckPort — the mechanical, electrical and logical interface between a Core
 * deck and its modules. A module designed against DeckPort 1.x attaches to
 * any Core that exposes a DeckPort 1.x socket.
 *
 * Human-readable specification: docs/deckport.md. This file is the source of
 * truth for the numbers; the docs page quotes them.
 */
import type { InsertSize } from './schema'

export const DECKPORT_VERSION = '1.0'

/** Module grid unit. Module footprints are whole multiples of this. */
export const GRID_UNIT = 20

export const SOCKET = {
  /** Socket footprint on the Core face: 2U × 1U. */
  width: 2 * GRID_UNIT,
  height: GRID_UNIT,
  /** Four M3 heat-set inserts on the Core side, screws from the module side. */
  insert: 'M3' as InsertSize,
  holes: [
    [-15, -5],
    [15, -5],
    [-15, 5],
    [15, 5],
  ] as [number, number][],
  /** Window for the 8-pin connector (2.54 mm pogo or magnetic pogo block). */
  connectorWindow: { w: 22, h: 5.5 },
  /** Shallow alignment recess the module plate's boss sits in. */
  recess: { w: 36, h: 14, depth: 1.0 },
}

export interface DeckPortPin {
  pin: number
  name: string
  description: string
}

export const PINOUT: DeckPortPin[] = [
  { pin: 1, name: 'VBUS', description: '5 V regulated, 3 A max per socket' },
  { pin: 2, name: 'GND', description: 'Ground' },
  { pin: 3, name: 'D+', description: 'USB 2.0 data +, from a Core USB port or hub' },
  { pin: 4, name: 'D−', description: 'USB 2.0 data −' },
  { pin: 5, name: 'SDA', description: 'I²C data, 3.3 V logic' },
  { pin: 6, name: 'SCL', description: 'I²C clock, 3.3 V logic' },
  { pin: 7, name: 'ID', description: 'Module identification: 1-Wire EEPROM or ID resistor to GND' },
  { pin: 8, name: 'VBAT', description: 'Raw battery rail, optional, fused at 3 A on the Core side' },
]

/** Power a module may draw from one socket, in watts, on the 5 V pin. */
export const SOCKET_MAX_W = 15
