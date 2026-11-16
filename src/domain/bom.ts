/**
 * Shopping list. Electronics come from placements; inserts and screws are
 * counted from the generated geometry, so the list always matches the case
 * you will actually print; filament is estimated from body volumes; wire is
 * estimated from the power wires in the diagram.
 */
import { componentById, syncCustomComponents } from '../catalog/components'
import type { GeometryResult } from '../geometry/caseBuilder'
import { INSERTS } from './hardware'
import { placementBox } from './layout'
import { MATERIALS } from './printers'
import type { Build } from './schema'
import { effectiveWires } from './wiring'

export type BomCategory = 'Electronics' | 'Hardware' | 'Filament' | 'Wiring'

export interface BomLine {
  key: string
  category: BomCategory
  name: string
  qty: number
  unit: string
  unitPrice: number
  supplier: string
  url?: string
  note?: string
}

/** Shells are mostly perimeters, so effective density sits well above the infill setting. */
function solidFraction(infill: number): number {
  return 0.55 + 0.45 * (infill / 100)
}

export function buildBom(build: Build, geo?: GeometryResult | null): BomLine[] {
  syncCustomComponents(build)
  const lines: BomLine[] = []

  // Electronics
  const groups = new Map<string, number>()
  for (const pl of build.placements) groups.set(pl.componentId, (groups.get(pl.componentId) ?? 0) + 1)
  for (const [id, qty] of groups) {
    const c = componentById(id)
    if (!c) continue
    lines.push({ key: `c:${id}`, category: 'Electronics', name: c.name, qty, unit: 'pcs', unitPrice: c.price, supplier: c.supplier, url: c.url })
  }
  // DeckPort connectors, from the sockets, rail ports and module plugs.
  const plugs = build.accessories.filter(a => a.kind === 'deckport')
  const pogo = plugs.filter(a => (a.connector ?? 'pogo') === 'pogo' && !(build.kind === 'module' && a.mount === 'rail')).length
  const usbReceptacles =
    plugs.filter(a => a.connector === 'usb-c' && build.kind === 'core').length +
    plugs.filter(a => build.kind === 'module' && a.mount === 'rail').length +
    build.accessories.filter(a => a.kind === 'picatinny' && a.port && a.port !== 'none').length
  const usbPlugs = plugs.filter(a => build.kind === 'module' && a.connector === 'usb-c' && a.mount !== 'rail').length
  const railCables = plugs.filter(a => build.kind === 'module' && a.mount === 'rail').length
  if (pogo && !groups.has('deckport-pogo-6p')) {
    const c = componentById('deckport-pogo-6p')!
    lines.push({ key: 'c:deckport', category: 'Electronics', name: c.name, qty: pogo, unit: 'pcs', unitPrice: c.price, supplier: c.supplier, note: build.kind === 'core' ? 'One per DeckPort socket' : 'The module half' })
  }
  if (usbReceptacles)
    lines.push({ key: 'c:usbc-f', category: 'Electronics', name: 'USB-C female receptacle, panel mount, with 5.1 kΩ / 10 kΩ CC resistors', qty: usbReceptacles, unit: 'pcs', unitPrice: 3, supplier: 'Any (USB-C breakout)', note: build.kind === 'core' ? 'Core side: 10 kΩ pull-up on CC' : 'Module side: 5.1 kΩ pull-down on CC' })
  if (usbPlugs)
    lines.push({ key: 'c:usbc-m', category: 'Electronics', name: 'USB-C male plug breakout', qty: usbPlugs, unit: 'pcs', unitPrice: 3, supplier: 'Any', note: 'Plugs into the Core socket' })
  if (railCables)
    lines.push({ key: 'c:usbc-cable', category: 'Wiring', name: 'USB-C to USB-C cable, 10 cm, right-angle', qty: railCables, unit: 'pcs', unitPrice: 4, supplier: 'Any (USB 2.0 is enough)', note: 'From the module to the port beside the rail' })

  // Hardware
  if (geo) {
    const inserts = new Map<string, number>()
    const screws = new Map<string, { size: string; len: number; n: number }>()
    for (const f of geo.fasteners) {
      if (!(f.purpose === 'deckport' && build.kind === 'module')) inserts.set(f.size, (inserts.get(f.size) ?? 0) + 1)
      const k = `${f.size}x${f.screwLength}`
      const s = screws.get(k) ?? { size: f.size, len: f.screwLength, n: 0 }
      s.n++
      screws.set(k, s)
    }
    for (const [size, n] of inserts) {
      const spec = INSERTS[size as keyof typeof INSERTS]
      lines.push({ key: `i:${size}`, category: 'Hardware', name: `Heat-set insert ${size} × ${spec.length} mm (short)`, qty: n, unit: 'pcs', unitPrice: spec.insertPrice, supplier: 'Ruthex / CNC Kitchen or equivalent', note: `Printed hole Ø${spec.holeD} mm` })
    }
    for (const s of [...screws.values()].sort((a, b) => a.size.localeCompare(b.size) || a.len - b.len)) {
      const spec = INSERTS[s.size as keyof typeof INSERTS]
      lines.push({ key: `s:${s.size}x${s.len}`, category: 'Hardware', name: `Socket head cap screw ${s.size} × ${s.len} mm (ISO 4762)`, qty: s.n, unit: 'pcs', unitPrice: spec.screwPrice, supplier: 'Any' })
    }

    if (geo.hardware.magnets)
      lines.push({ key: 'h:magnets', category: 'Hardware', name: 'Neodymium disc magnet Ø6 × 3 mm (N52)', qty: geo.hardware.magnets, unit: 'pcs', unitPrice: 0.15, supplier: 'Any', note: 'Press-fit; mind the polarity — see Printing' })
    if (geo.hardware.railBolts)
      lines.push({ key: 'h:railbolt', category: 'Hardware', name: 'M4 × 40 socket head bolt + M4 nyloc nut', qty: geo.hardware.railBolts, unit: 'sets', unitPrice: 0.3, supplier: 'Any', note: 'Rail clamp cross bolt' })
    if (geo.hardware.hingePin)
      lines.push({ key: 'h:pin', category: 'Hardware', name: `Steel rod Ø3 mm, cut to ${geo.hardware.hingePin.length} mm`, qty: geo.hardware.hingePin.count, unit: 'pcs', unitPrice: 1.5, supplier: 'Any (silver steel, or M3 threaded rod)', note: 'Hinge pin' })

    // Filament
    const mat = MATERIALS[build.print.material]
    const byColor = new Map<string, number>()
    for (const pc of geo.pieces) for (const b of pc.bodies) byColor.set(b.color, (byColor.get(b.color) ?? 0) + b.volume)
    for (const [color, mm3] of byColor) {
      const grams = (mm3 / 1000) * mat.density * solidFraction(build.print.infillPercent)
      lines.push({ key: `f:${color}`, category: 'Filament', name: `${build.print.material} filament ${color.toUpperCase()}`, qty: Math.ceil(grams), unit: 'g', unitPrice: mat.pricePerKg / 1000, supplier: 'Any', note: 'Estimate, +10% for purge and supports is wise' })
    }
  }

  // Wiring
  const byAwg = new Map<number, number>()
  for (const w of effectiveWires(build)) {
    if (w.kind !== 'power' || !w.awg) continue
    const a = build.placements.find(p => p.id === w.from)
    const b = build.placements.find(p => p.id === w.to)
    const ca = a && componentById(a.componentId)
    const cb = b && componentById(b.componentId)
    if (!a || !b || !ca || !cb) continue
    const ba = placementBox(build, ca, a)
    const bb = placementBox(build, cb, b)
    const mid = (bx: typeof ba) => bx.min.map((v, i) => (v + bx.max[i]) / 2)
    const [ma, mb] = [mid(ba), mid(bb)]
    const manhattan = Math.abs(ma[0] - mb[0]) + Math.abs(ma[1] - mb[1]) + Math.abs(ma[2] - mb[2])
    // Two conductors, routing slack, plus a little for strain relief.
    byAwg.set(w.awg, (byAwg.get(w.awg) ?? 0) + 2 * (manhattan * 1.3 + 40))
  }
  for (const [awg, mm] of [...byAwg].sort((a, b) => b[0] - a[0])) {
    const m = Math.max(0.5, Math.ceil(mm / 100) / 10)
    lines.push({ key: `w:${awg}`, category: 'Wiring', name: `Silicone wire ${awg} AWG, red + black`, qty: m, unit: 'm', unitPrice: 0.8, supplier: 'Any', note: 'Estimated from the wiring diagram' })
  }
  return lines
}

export function bomTotal(lines: BomLine[]): number {
  return lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)
}

export function bomCsv(lines: BomLine[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['Category', 'Item', 'Qty', 'Unit', 'Unit price (EUR)', 'Total (EUR)', 'Supplier', 'URL', 'Note']
  const rows = lines.map(l => [l.category, l.name, l.qty, l.unit, l.unitPrice.toFixed(3), (l.qty * l.unitPrice).toFixed(2), l.supplier, l.url ?? '', l.note ?? ''])
  return [header, ...rows].map(r => r.map(esc).join(',')).join('\n')
}
