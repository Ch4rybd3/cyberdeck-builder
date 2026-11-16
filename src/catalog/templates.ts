/**
 * Case templates (formats) and the example builds shipped with the library.
 *
 * A template is a starting point, not a constraint: it sets the case
 * parameters and a few default accessories, and everything stays editable.
 */
import { DECKPORT_VERSION } from '../domain/deckport'
import { SCHEMA_VERSION, type Accessory, type Build, type BuildKind, type CaseParams, type Feature, type Placement } from '../domain/schema'
import { uid } from '../lib/id'

export interface CaseTemplate {
  id: string
  name: string
  description: string
  kind: BuildKind
  params: CaseParams
  accessories: Omit<Accessory, 'id'>[]
  features?: Omit<Feature, 'id'>[]
  colors?: { tray: string; lid: string; accessories: string }
}

export const DEFAULT_COLORS = { tray: '#2B2F36', lid: '#3A3F47', accessories: '#2DD4BF' }

const base = { closureInsert: 'M3' as const, cornerStyle: 'round' as const, bevel: 0, hinge: false, closure: 'screws' as const }

const foot = (u: number, v: number): Omit<Accessory, 'id'> => ({ kind: 'foot', part: 'tray', face: 'bottom', u, v, length: 18, rotation: 0 })

const rib = (name: string, face: Feature['face'], u: number, h: number, n: number, part: Feature['part'] = 'tray'): Omit<Feature, 'id'> => ({
  name, part, face, op: 'extrude', shape: { kind: 'rect', w: 6, h, r: 1.5 }, u, v: 0, depth: 3, rotation: 0, pattern: { nu: n, nv: 1, du: 12, dv: 0 }, enabled: true,
})

export const TEMPLATES: CaseTemplate[] = [
  {
    id: 'slab',
    name: 'Slab',
    description: 'Flat tray with a screen and keyboard set into the top plate. The classic field-deck format.',
    kind: 'core',
    params: { ...base, width: 300, depth: 200, trayHeight: 32, lidHeight: 14, wall: 3, floor: 2.4, cornerRadius: 8, closureScrews: 8 },
    accessories: [foot(-130, -80), foot(130, -80), foot(-130, 80), foot(130, 80)],
  },
  {
    id: 'tactical',
    name: 'Tactical',
    description: 'Faceted outline with bevelled edges, a side grip, accessory rails and a sliding screen carriage on the lid.',
    kind: 'core',
    params: { ...base, width: 320, depth: 250, trayHeight: 34, lidHeight: 12, wall: 3, floor: 2.4, cornerRadius: 18, cornerStyle: 'chamfer', bevel: 3.5, closureScrews: 8 },
    accessories: [
      { kind: 'handle', part: 'tray', face: 'left', u: 0, v: 0, length: 160, rotation: 0, style: 'tube', texture: 'knurled' },
      { kind: 'picatinny', part: 'tray', face: 'right', u: 0, v: 0, length: 140, rotation: 0 },
      { kind: 'slider', part: 'lid', face: 'top', u: 0, v: -39.5, length: 121, width: 320, travel: 79, rotation: 0 },
    ],
    // Ribs stay on the flat part of the front face (±142 mm with an 18 mm chamfer).
    features: [rib('Grip ribs left', 'front', -110, 20, 6), rib('Grip ribs right', 'front', 110, 20, 6)],
    colors: { tray: '#1E2126', lid: '#2A2E35', accessories: '#D64541' },
  },
  {
    id: 'briefcase',
    name: 'Briefcase',
    description: 'Hinged clamshell: the screen sits inside the lid and the keyboard in the tray, like a laptop. Magnet closure and a carry handle.',
    kind: 'core',
    params: { ...base, width: 420, depth: 300, trayHeight: 50, lidHeight: 28, wall: 3, floor: 2.6, cornerRadius: 12, closureScrews: 6, hinge: true, closure: 'magnets' },
    accessories: [{ kind: 'handle', part: 'tray', face: 'front', u: 0, v: 4, length: 140, rotation: 0, style: 'tube', texture: 'ribbed' }, foot(-185, -125), foot(185, -125), foot(-185, 125), foot(185, 125)],
  },
  {
    id: 'suitcase',
    name: 'Suitcase',
    description: 'Deep rugged case in the style of a hard-shell equipment case: hinge, magnets, handle, ribs and feet.',
    kind: 'core',
    params: { ...base, width: 460, depth: 340, trayHeight: 150, lidHeight: 50, wall: 3.6, floor: 3, cornerRadius: 16, closureScrews: 6, hinge: true, closure: 'magnets', bevel: 2 },
    accessories: [{ kind: 'handle', part: 'tray', face: 'front', u: 0, v: 40, length: 160, rotation: 0, style: 'tube', texture: 'knurled' }, foot(-200, -140), foot(200, -140), foot(-200, 140), foot(200, 140)],
    features: [rib('Front ribs left', 'front', -170, 120, 3), rib('Front ribs right', 'front', 170, 120, 3), rib('Back ribs left', 'back', -170, 120, 3), rib('Back ribs right', 'back', 170, 120, 3)],
  },
  {
    id: 'field-case',
    name: 'Field case',
    description: 'Deep tray for bulky radios and batteries, with a carry handle and side rails.',
    kind: 'core',
    params: { ...base, width: 320, depth: 220, trayHeight: 60, lidHeight: 16, wall: 3.2, floor: 2.8, cornerRadius: 10, closureScrews: 8 },
    accessories: [
      { kind: 'handle', part: 'tray', face: 'back', u: 0, v: 4, length: 140, rotation: 0 },
      { kind: 'picatinny', part: 'tray', face: 'left', u: 0, v: 0, length: 120, rotation: 0 },
      { kind: 'picatinny', part: 'tray', face: 'right', u: 0, v: 0, length: 120, rotation: 0 },
    ],
  },
  {
    id: 'handheld',
    name: 'Handheld',
    description: 'Compact two-hand device: a small screen over a thumb keyboard.',
    kind: 'core',
    params: { ...base, width: 170, depth: 110, trayHeight: 28, lidHeight: 10, wall: 2.4, floor: 2, cornerRadius: 14, closureInsert: 'M2.5', closureScrews: 4 },
    accessories: [],
  },
  {
    id: 'module-2u',
    name: 'DeckPort module (2U × 2U)',
    description: 'Small enclosure with a DeckPort plug on its back, for a module that attaches to a Core.',
    kind: 'module',
    params: { ...base, width: 60, depth: 40, trayHeight: 24, lidHeight: 8, wall: 2.4, floor: 2, cornerRadius: 4, closureInsert: 'M2.5', closureScrews: 4 },
    accessories: [{ kind: 'deckport', part: 'tray', face: 'back', u: 0, v: 0, length: 40, rotation: 0, mount: 'direct', connector: 'pogo' }],
  },
  {
    id: 'module-rail',
    name: 'Rail module (Picatinny)',
    description: 'A module with a printed Picatinny clamp on its bottom and a USB-C port on its end, for a Core with accessory rails.',
    kind: 'module',
    params: { ...base, width: 70, depth: 44, trayHeight: 24, lidHeight: 8, wall: 2.4, floor: 2.4, cornerRadius: 4, closureInsert: 'M2.5', closureScrews: 4 },
    accessories: [{ kind: 'deckport', part: 'tray', face: 'bottom', u: 0, v: 0, length: 40, rotation: 0, mount: 'rail', connector: 'usb-c' }],
  },
]

export function templateById(id: string): CaseTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
}

export function newBuild(templateId: string, name?: string): Build {
  const t = templateById(templateId)
  const now = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid('build'),
    name: name ?? `Untitled ${t.name}`,
    kind: t.kind,
    deckport: DECKPORT_VERSION,
    createdAt: now,
    updatedAt: now,
    case: { template: t.id, params: { ...t.params }, colors: { ...(t.colors ?? DEFAULT_COLORS) } },
    customComponents: [],
    placements: [],
    features: (t.features ?? []).map(f => ({ ...structuredClone(f), id: uid('ft') })),
    accessories: t.accessories.map(a => ({ ...a, id: uid('acc') })),
    wiring: { wires: [], suppressed: [], positions: {} },
    print: { printerId: 'ender-3', material: 'PETG', autoSplit: true, jointInsert: 'M3', infillPercent: 20 },
    identity: { codename: '', author: '', license: 'CERN-OHL-S-2.0', description: '', tags: [], status: 'concept', links: [] },
  }
}

// ── Examples ─────────────────────────────────────────────────────────────────

const pl = (componentId: string, x: number, y: number, extra: Partial<Placement> = {}): Placement => ({
  id: uid('pl'),
  componentId,
  part: 'tray',
  x,
  y,
  z: 0,
  rotation: 0,
  rotX: 0,
  rotY: 0,
  standoffs: true,
  window: true,
  ...extra,
} as Placement)

const feat = (f: Omit<Feature, 'id' | 'enabled' | 'rotation'> & Partial<Feature>): Feature => ({
  id: uid('ft'),
  enabled: true,
  rotation: 0,
  ...f,
})

export function exampleBuilds(): Build[] {
  const field = newBuild('slab', 'Wayfarer')
  field.id = 'example-wayfarer'
  field.identity = {
    ...field.identity,
    codename: 'WFR-01',
    description: 'A Pi 5 slab deck with a 7" touch display, a 60% keyboard and a 1S2P 18650 pack. One DeckPort socket on the right for modules.',
    tags: ['pi5', 'slab', 'field'],
  }
  field.case.params = { ...field.case.params, width: 310, depth: 230, trayHeight: 34 }
  field.placements = [
    pl('rpi-touch-display-2-7', 40, 50, { part: 'lid', label: 'Display' }),
    pl('kb-60-mechanical', 0, -62, { z: 2, label: 'Keyboard' }),
    pl('rpi5-8gb', -100, 50, { label: 'Pi 5' }),
    pl('pack-1s2p-18650', 110, 45, { label: 'Battery' }),
    pl('boost-5v-5a', 60, 20, { label: 'Boost' }),
    pl('panel-usb-c', -130, 104, { rotation: 180, label: 'Charge port' }),
    pl('charger-1s-usbc', -90, 102, { label: 'Charger' }),
  ]
  field.features = [
    feat({ name: 'Side vents', part: 'tray', face: 'left', op: 'cut', shape: { kind: 'slot', w: 30, h: 4 }, u: -50, v: 2, depth: 0, pattern: { nu: 1, nv: 4, du: 0, dv: 6 } }),
    feat({ name: 'Accent stripe', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'rect', w: 290, h: 4, r: 2 }, u: 0, v: 104, depth: 0.6, color: '#2DD4BF' }),
  ]
  field.accessories.push({ id: uid('acc'), kind: 'deckport', part: 'tray', face: 'right', u: 0, v: 0, length: 40, rotation: 0, moduleId: 'example-sdr-module' })
  // Zip-tie anchors on the tray floor (bottom face: u = x, v = −y), in the gaps between parts.
  for (const [x, y] of [[-20, 10], [40, -5], [-50, 0]] as [number, number][])
    field.accessories.push({ id: uid('acc'), kind: 'tiepoint', part: 'tray', face: 'bottom', u: x, v: -y, length: 10, rotation: 0 })
  field.features.push(feat({ name: 'Codename', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'text', text: 'WFR-01', size: 7, font: 'mono' }, u: -95, v: 50, depth: 0.6, color: '#2DD4BF' }))

  const scout = newBuild('handheld', 'Scout')
  scout.id = 'example-scout'
  scout.identity = { ...scout.identity, codename: 'SCT-02', description: 'Pocketable Pi 5 handheld with a 5" DSI screen and a BlackBerry keyboard.', tags: ['pi5', 'handheld'] }
  scout.case.params = { ...scout.case.params, depth: 120 }
  scout.placements = [
    pl('waveshare-5-dsi', 0, 18, { part: 'lid', label: 'Display' }),
    pl('kb-bbq20', 0, -38, { z: 25, label: 'Keyboard' }),
    pl('rpi5-4gb', 22, 10, { label: 'Pi 5' }),
    pl('pack-1s2p-18650', -60, 0, { label: 'Battery' }),
    pl('boost-5v-5a', 55, -40, { label: 'Boost' }),
    pl('charger-1s-usbc', -60, -46, { label: 'Charger' }),
  ]
  scout.features = [
    feat({ name: 'Bottom vents', part: 'tray', face: 'bottom', op: 'cut', shape: { kind: 'slot', w: 40, h: 3 }, u: 22, v: -10, depth: 0, pattern: { nu: 1, nv: 5, du: 0, dv: 7 } }),
  ]

  const sdr = newBuild('module-2u', 'SDR module')
  sdr.id = 'example-sdr-module'
  sdr.targetCore = { id: field.id, name: field.name }
  sdr.identity = { ...sdr.identity, codename: 'MOD-SDR', description: 'RTL-SDR V4 in a DeckPort module. SMA antenna through the left side.', tags: ['module', 'sdr'] }
  sdr.case.params = { ...sdr.case.params, width: 80, depth: 40, trayHeight: 22 }
  sdr.placements = [pl('rtl-sdr-v4', 0, -4, { label: 'RTL-SDR' }), pl('deckport-pogo-6p', 0, 13, { z: 4, label: 'Pogo connector' })]
  sdr.features = [
    feat({ name: 'SMA antenna hole', part: 'tray', face: 'left', op: 'cut', shape: { kind: 'circle', d: 6.6 }, u: 4, v: 0, depth: 0 }),
    feat({ name: 'Label', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'text', text: 'SDR', size: 7, font: 'mono' }, u: 0, v: 0, depth: 0.6, color: '#2DD4BF' }),
  ]

  // LoRa / Meshtastic radio module, mounted on Vanguard's back socket.
  const lora = newBuild('module-rail', 'LoRa module')
  lora.id = 'example-lora-module'
  lora.identity = { ...lora.identity, codename: 'MOD-LORA', description: 'Heltec LoRa 32 V3 running Meshtastic. Clamps onto a Picatinny rail; USB-C cable to the port past the rail end. SMA antenna through the left side.', tags: ['module', 'lora', 'meshtastic', 'rail'] }
  lora.case.colors = { tray: '#1E2126', lid: '#2A2E35', accessories: '#D64541' }
  // Lifted over the clamp's insert bosses in the floor.
  lora.placements = [pl('lora-heltec-v3', 0, 0, { z: 7, label: 'Heltec V3' })]
  lora.features = [
    feat({ name: 'SMA antenna hole', part: 'tray', face: 'left', op: 'cut', shape: { kind: 'circle', d: 6.6 }, u: 0, v: 3, depth: 0 }),
    feat({ name: 'Label', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'text', text: 'LORA', size: 7, font: 'mono' }, u: 0, v: 0, depth: 0.6, color: '#D64541' }),
  ]

  // GPS module, mounted on Courier's right socket.
  const gps = newBuild('module-2u', 'GPS module')
  gps.id = 'example-gps-module'
  gps.identity = { ...gps.identity, codename: 'MOD-GPS', description: 'u-blox 7 USB receiver in a DeckPort module, for position and a PPS-free time source.', tags: ['module', 'gps'] }
  gps.case.params = { ...gps.case.params, width: 60, depth: 50, trayHeight: 22 }
  gps.placements = [pl('gps-usb-ublox', 0, -4, { label: 'u-blox 7' })]
  gps.accessories = gps.accessories.map(a => (a.kind === 'deckport' ? { ...a, connector: 'usb-c' as const } : a))
  gps.identity.description += ' Plugs into a USB-C DeckPort socket.'
  gps.features = [feat({ name: 'Label', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'text', text: 'GPS', size: 7, font: 'mono' }, u: 0, v: -4, depth: 0.6, color: '#2DD4BF' })]

  // Tactical deck: the 7" display rides on a carriage that slides back to uncover the keyboard.
  const vanguard = newBuild('tactical', 'Vanguard')
  vanguard.id = 'example-vanguard'
  vanguard.identity = {
    ...vanguard.identity,
    codename: 'VGD-03',
    description: 'Faceted Pi 5 field deck. The 7" display rides on a sliding carriage that covers the keyboard for transport and slides back to uncover it. Side grip, a LoRa module clamped on its right Picatinny rail, and a free DeckPort socket at the back.',
    tags: ['pi5', 'tactical', 'slider'],
  }
  const vDisplay = pl('rpi-touch-display-2-7', 0, 0, { part: 'lid', window: false, standoffs: false, label: 'Display (on slider)' })
  vanguard.placements = [
    vDisplay,
    pl('kb-60-mechanical', 0, -74, { z: 9, label: 'Keyboard' }),
    pl('rpi5-8gb', -95, 60, { label: 'Pi 5' }),
    pl('pack-1s2p-18650', 100, 60, { label: 'Battery' }),
    pl('boost-5v-5a', 40, 40, { label: 'Boost' }),
    pl('charger-1s-usbc', 40, 90, { label: 'Charger' }),
    pl('panel-usb-c', -130, 113, { rotation: 180, label: 'Charge port' }),
  ]
  const slider = vanguard.accessories.find(a => a.kind === 'slider')!
  slider.targetId = vDisplay.id
  vanguard.accessories.push({ id: uid('acc'), kind: 'deckport', part: 'tray', face: 'back', u: -60, v: 0, length: 40, rotation: 0 })
  // The LoRa module rides on the right rail, cabled to a USB-C port past the rail's end.
  const vRail = vanguard.accessories.find(a => a.kind === 'picatinny')!
  Object.assign(vRail, { moduleId: lora.id, port: 'end', moduleAt: 0 })
  lora.targetCore = { id: vanguard.id, name: vanguard.name }
  vanguard.features.push(feat({ name: 'Front label', part: 'tray', face: 'front', op: 'inlay', shape: { kind: 'text', text: 'VGD-03', size: 7, font: 'mono' }, u: 0, v: 0, depth: 0.6, color: '#D64541' }))
  vanguard.features.push(feat({ name: 'Bottom vents', part: 'tray', face: 'bottom', op: 'cut', shape: { kind: 'slot', w: 50, h: 3 }, u: -95, v: -60, depth: 0, pattern: { nu: 1, nv: 6, du: 0, dv: 7 } }))

  // Briefcase: laptop-style clamshell on a hinge.
  const courier = newBuild('briefcase', 'Courier')
  courier.id = 'example-courier'
  courier.identity = {
    ...courier.identity,
    codename: 'CRR-04',
    description: 'Briefcase deck that opens like a laptop: 10.1" screen in the lid, 60% keyboard, SDR and LoRa radios and a USB hub in the tray, and a GPS module on its right USB-C DeckPort socket. Hinged on a 3 mm steel pin, held shut by magnets.',
    tags: ['pi5', 'briefcase', 'radio'],
  }
  courier.placements = [
    pl('waveshare-10-1-hdmi', 0, 40, { part: 'lid', window: false, label: 'Display' }),
    pl('kb-60-mechanical', 0, -80, { z: 2, window: false, label: 'Keyboard' }),
    pl('rpi5-8gb', -120, 60, { label: 'Pi 5' }),
    pl('rtl-sdr-v4', -40, 70, { label: 'RTL-SDR' }),
    pl('lora-heltec-v3', -40, 110, { label: 'LoRa' }),
    pl('usb-hub-4p', -40, 20, { label: 'USB hub' }),
    pl('pack-1s2p-18650', 100, 60, { label: 'Battery' }),
    pl('boost-5v-5a', 40, 50, { label: 'Boost' }),
    pl('charger-1s-usbc', 40, 100, { label: 'Charger' }),
    pl('panel-usb-c', 199, 100, { rotation: 90, label: 'Charge port' }),
  ]
  courier.accessories.push({ id: uid('acc'), kind: 'deckport', part: 'tray', face: 'right', u: -60, v: 0, length: 40, rotation: 0, connector: 'usb-c', moduleId: gps.id })
  // External antenna coax out through a PG9 gland on the left side, and tie points on the floor.
  courier.accessories.push({ id: uid('acc'), kind: 'gland', part: 'tray', face: 'left', u: -100, v: 8, length: 20, rotation: 0, gland: 'PG9' })
  for (const [x, y] of [[-150, 5], [0, 5], [100, 5]] as [number, number][])
    courier.accessories.push({ id: uid('acc'), kind: 'tiepoint', part: 'tray', face: 'bottom', u: x, v: -y, length: 10, rotation: 0 })
  gps.targetCore = { id: courier.id, name: courier.name }
  courier.features = [
    feat({ name: 'Bottom vents', part: 'tray', face: 'bottom', op: 'cut', shape: { kind: 'slot', w: 60, h: 3 }, u: -120, v: -60, depth: 0, pattern: { nu: 1, nv: 6, du: 0, dv: 7 } }),
    feat({ name: 'Lid stripe', part: 'lid', face: 'top', op: 'inlay', shape: { kind: 'rect', w: 380, h: 5, r: 2.5 }, u: 0, v: -120, depth: 0.6, color: '#2DD4BF' }),
  ]

  return [field, vanguard, courier, scout, sdr, lora, gps]
}
