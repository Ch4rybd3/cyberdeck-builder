/**
 * DeckPort — the mechanical, electrical and logical interface between a Core
 * deck and its modules. A module designed against DeckPort 1.x attaches to
 * any Core that exposes a DeckPort 1.x socket.
 *
 * Human-readable specification: docs/deckport.md. This file is the source of
 * truth for the numbers; the docs page quotes them.
 */
import type { InsertSize } from './schema'

export const DECKPORT_VERSION = '1.1'

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

// ── DeckPort 1.1 additions ──────────────────────────────────────────────────

/**
 * USB-C connector option. Same 15 W budget (5 V / 3 A, advertised by the Core
 * with a 10 kΩ pull-up on CC), USB 2.0 data. No VBAT, and no I²C unless the
 * optional SBU1/SBU2 mapping is used with a full-featured cable.
 */
export const USB_C = {
  /** Panel cut-out for a USB-C receptacle (the Core side, and the module side of a rail mount). */
  receptacle: { w: 9.4, h: 3.6, r: 1.6 },
  /** Window for a USB-C plug overmould on a direct-mount module plug. */
  plugWindow: { w: 12.6, h: 6.8, r: 2.4 },
}

export const USB_C_PINOUT: DeckPortPin[] = [
  { pin: 1, name: 'VBUS', description: '5 V, 3 A max (15 W), sourced by the Core' },
  { pin: 2, name: 'GND', description: 'Ground' },
  { pin: 3, name: 'D+ / D−', description: 'USB 2.0 data' },
  { pin: 4, name: 'CC', description: 'Core: 10 kΩ pull-up (3 A advertised). Module: 5.1 kΩ pull-down (sink)' },
  { pin: 5, name: 'SBU1 / SBU2', description: 'Optional SDA / SCL, only with full-featured cables. Otherwise unused' },
]

/**
 * Rail mount: a module clamps onto a Picatinny rail on the Core with a
 * printed clamp, locked by an M4 cross bolt sitting in a rail slot. The cable
 * runs from a USB-C port on the module to a USB-C port cut beside the rail.
 */
export const RAIL_MOUNT = {
  /** Clamp length along the rail (spans four slots). */
  length: 40,
  /** Clamp width across the rail. */
  width: 36,
  /** The jaws stop this far above the Core face, clear of the rail's base plate. */
  jawGap: 2.3,
  /** Distance from the Core face to the module face when clamped. */
  standoff: 13,
  /** M4 cross bolt: clearance hole and its height above the Core face (inside a slot). */
  boltD: 4.5,
  boltZ: 8.6,
  /** Centre of the USB-C port beside the rail, from the rail centre line. */
  portOffset: 22,
  /** Centre of a USB-C port past a rail end, from that end. */
  portPastEnd: 10,
  /** Module mounting: four M3 screws through the jaws into inserts in the module. */
  holes: [[-14, -13.5], [14, -13.5], [-14, 13.5], [14, 13.5]] as [number, number][],
}

/** Slot pitch of a Picatinny rail; rail-mounted modules snap to it. */
export const PICATINNY_PITCH = 10.01
