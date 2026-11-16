import type { InsertSize } from '../domain/schema'

export type Category =
  | 'sbc'
  | 'display'
  | 'input'
  | 'power'
  | 'storage'
  | 'radio'
  | 'audio'
  | 'cooling'
  | 'io'
  | 'connector'

export const CATEGORY_LABEL: Record<Category, string> = {
  sbc: 'Single-board computers',
  display: 'Displays',
  input: 'Keyboards & pointing',
  power: 'Batteries & power',
  storage: 'Storage',
  radio: 'Radio & networking',
  audio: 'Audio',
  cooling: 'Cooling',
  io: 'Hubs & I/O',
  connector: 'Connectors & switches',
}

/** Categorical slot (Remora --data-1..6) used in the viewport and schematic. */
export const CATEGORY_DATA_SLOT: Record<Category, 1 | 2 | 3 | 4 | 5 | 6> = {
  sbc: 1,
  display: 2,
  input: 3,
  power: 4,
  storage: 6,
  radio: 5,
  audio: 5,
  cooling: 6,
  io: 5,
  connector: 3,
}

export type Rail = 'VBAT' | '5V' | '3V3' | '12V'

export type PowerSpec =
  | { role: 'load'; rail: Rail; typW: number; peakW: number }
  | { role: 'battery'; nominalV: number; capacityWh: number; maxW: number; chemistry: string }
  | { role: 'converter'; in: Rail; out: Rail; maxW: number; efficiency: number; chargeW?: number; quiescentW?: number }
  | { role: 'charger'; chargeW: number }

export type PortType =
  | 'usb-a'
  | 'usb-c'
  | 'micro-hdmi'
  | 'mipi'
  | 'gpio'
  | 'i2c'
  | 'pcie'
  | 'm2'
  | 'ethernet'
  | 'audio'
  | 'fan'

export const PORT_LABEL: Record<PortType, string> = {
  'usb-a': 'USB-A',
  'usb-c': 'USB-C',
  'micro-hdmi': 'Micro-HDMI',
  mipi: 'MIPI DSI/CSI',
  gpio: 'GPIO header',
  i2c: 'I²C',
  pcie: 'PCIe FPC',
  m2: 'M.2 slot',
  ethernet: 'Ethernet',
  audio: 'Audio',
  fan: 'Fan header',
}

export interface Window {
  /** Face of the component the window is on, in the component's own frame. */
  face: 'top' | 'front' | 'back' | 'left' | 'right'
  w: number
  h: number
  /** Offset of the window centre from the face centre. */
  u?: number
  v?: number
  r?: number
}

export interface CatalogComponent {
  id: string
  name: string
  category: Category
  /** Bounding box in mm, x = width, y = depth, z = height. */
  dims: { x: number; y: number; z: number }
  mass: number
  /** Indicative price in EUR. */
  price: number
  supplier: string
  url?: string
  mounting?: {
    insert: InsertSize
    /** Hole centres, relative to the component centre, in its own frame. */
    holes: [number, number][]
    /** Clearance under the board, i.e. standoff height. */
    standoff: number
  }
  windows?: Window[]
  power?: PowerSpec
  ports?: {
    provides?: Partial<Record<PortType, number>>
    consumes?: Partial<Record<PortType, number>>
  }
  notes?: string
}
