/**
 * Assembly guide: an ordered list of steps derived from the build and its
 * generated geometry, so it always matches what will actually be printed.
 */
import { componentById, syncCustomComponents } from '../catalog/components'
import type { GeometryResult } from '../geometry/caseBuilder'
import { INSERTS } from './hardware'
import { modulePlug, mountPoints } from './modules'
import { MATERIALS, printerById } from './printers'
import type { Build } from './schema'
import { effectiveWires } from './wiring'

export interface AssemblyStep {
  id: string
  title: string
  items: string[]
  note?: string
}

export function assemblySteps(build: Build, geo: GeometryResult | null, modules: Build[] = []): AssemblyStep[] {
  syncCustomComponents(build)
  const steps: AssemblyStep[] = []
  const add = (id: string, title: string, items: string[], note?: string) => items.length && steps.push({ id, title, items, note })
  const p = build.case.params
  const printer = printerById(build.print.printerId)
  const mat = MATERIALS[build.print.material]

  if (geo) {
    add(
      'print',
      `Print ${geo.pieces.length} pieces`,
      geo.pieces.map(pc => {
        const colors = [...new Set(pc.bodies.map(b => b.color.toUpperCase()))]
        const orient = pc.printFlip
          ? 'top surface down'
          : pc.name === 'Handle grip'
            ? 'standing on one end'
            : pc.name.startsWith('Screen carriage')
              ? 'channels down'
              : pc.name.startsWith('Screen bezel')
                ? 'flat'
                : pc.group === 'accessory'
                  ? 'mounting face down'
                  : 'open side up'
        return `${pc.name}: ${pc.size.map(v => Math.round(v)).join(' × ')} mm, ${orient}${colors.length > 1 ? `, ${colors.length} colours` : ''}`
      }),
      `${build.print.material} on the ${printer.name}, ${build.print.infillPercent}% infill. ${mat.note}`,
    )

    const bySize = new Map<string, { n: number; purposes: Set<string> }>()
    for (const f of geo.fasteners) {
      if (f.purpose === 'deckport' && build.kind === 'module') continue
      const e = bySize.get(f.size) ?? { n: 0, purposes: new Set() }
      e.n++
      e.purposes.add(f.purpose)
      bySize.set(f.size, e)
    }
    const label: Record<string, string> = { closure: 'lid closure (tray rim)', standoff: 'board standoffs', 'split-joint': 'split joints', accessory: 'accessory mounts', deckport: 'DeckPort sockets' }
    add(
      'inserts',
      'Melt in the heat-set inserts',
      [...bySize].map(([size, e]) => `${e.n} × ${size} (hole Ø${INSERTS[size as keyof typeof INSERTS].holeD} mm): ${[...e.purposes].map(x => label[x]).join(', ')}`),
      'About 220 °C for PLA, 240 °C for PETG, with an insert tip. Press straight, stop flush, let them cool before loading them.',
    )

    const joints = geo.fasteners.filter(f => f.purpose === 'split-joint')
    if (joints.length)
      add('join', 'Join the split pieces', [
        `${joints.length} × ${joints[0].size} × ${joints[0].screwLength} mm screws, one per joint block`,
        'Inserts go in the blocks on one side of each cut; drive the screws from the blocks on the other side, from inside the case',
        'Assemble each part (tray, lid) on a flat surface so the seams stay flush',
      ])
  }

  // Accessories
  const acc: string[] = []
  for (const a of build.accessories) {
    if (a.kind === 'picatinny') acc.push(`Picatinny rail on the ${a.part} ${a.face} face: M3 screws through its counterbores${a.port && a.port !== 'none' ? `; fit a USB-C panel receptacle in the port ${a.port === 'above' || a.port === 'below' ? a.port : `past the ${a.port}`} of the rail` : ''}`)
    else if (a.kind === 'handle' && a.style === 'tube') acc.push(`Tube handle on the ${a.part} ${a.face} face: screw both posts on (2 × M3 each), slide the grip between them, then push the M5 bolt through post, grip and post and tighten the nut in its hex trap`)
    else if (a.kind === 'handle') acc.push(`Handle on the ${a.part} ${a.face} face: 4 × M3 through its counterbores`)
    else if (a.kind === 'foot') acc.push(`Foot at (${Math.round(a.u)}, ${Math.round(a.v)}) on the bottom: 1 × M3, then a rubber bumper`)
    else if (a.kind === 'deckport' && build.kind === 'core') acc.push(`DeckPort socket on the ${a.part} ${a.face} face: ${a.connector === 'usb-c' ? 'glue or screw a USB-C receptacle (10 kΩ CC pull-up) behind the window' : 'fit the 8-pin pogo receptacle behind the window'}`)
    else if (a.kind === 'deckport' && a.mount === 'rail') acc.push('Rail clamp: screw it to the module with 4 × M3, then fit the USB-C receptacle (5.1 kΩ CC pull-down) in the end port')
    else if (a.kind === 'deckport') acc.push(`DeckPort plug: fit the ${a.connector === 'usb-c' ? 'USB-C male plug' : 'pogo pin block'} behind the window, pins facing out`)
    else if (a.kind === 'slider')
      acc.push(
        'Screen slider, in this order: screw the rails to the lid; put the display in the carriage and route its cable through the carriage slot and the lid slot; screw the bezel on; slide the carriage onto the rails from the front; screw on the four end stops',
      )
  }
  add('accessories', 'Fit the accessories', acc)

  // Electronics
  const elec: string[] = []
  for (const pl of build.placements) {
    const c = componentById(pl.componentId)
    if (!c) continue
    const name = pl.label ?? c.name
    const where = pl.part === 'tray' ? 'tray' : 'lid'
    if (pl.standoffs && c.mounting && (pl.rotX ?? 0) === 0 && (pl.rotY ?? 0) === 0)
      elec.push(`${name} in the ${where} at (${Math.round(pl.x)}, ${Math.round(pl.y)}): ${c.mounting.holes.length} × ${c.mounting.insert} screws into its standoffs`)
    else elec.push(`${name} in the ${where} at (${Math.round(pl.x)}, ${Math.round(pl.y)}): no standoffs — use double-sided foam tape, a bracket or a printed clip`)
  }
  add('electronics', 'Mount the electronics', elec, 'Fit batteries last, after the wiring is checked with a bench supply.')

  const names = new Map(build.placements.map(pl => [pl.id, pl.label ?? componentById(pl.componentId)?.name ?? pl.id]))
  const nodeName = (id: string) => names.get(id) ?? (id.startsWith('deckport') ? 'DeckPort' : id)
  const wires = effectiveWires(build)
  add('wiring', 'Wire it up', [
    ...wires.filter(w => w.kind === 'power').map(w => `Power: ${nodeName(w.from)} → ${nodeName(w.to)} (${w.label})`),
    ...wires.filter(w => w.kind !== 'power').map(w => `${w.kind === 'data' ? 'Data' : 'Signal'}: ${nodeName(w.from)} → ${nodeName(w.to)} (${w.label})`),
  ], 'Check polarity with a multimeter before the first power-on. Fuse the battery output.')

  // Modules
  const mods: string[] = []
  for (const point of mountPoints(build)) {
    const m = modules.find(x => x.id === point.moduleId)
    if (!m) continue
    if (point.kind === 'picatinny') mods.push(`${m.name}: slide its clamp onto the ${point.face} rail, bolt in the slot, M4 cross bolt and nut; plug the USB-C cable from its end port into the port by the rail`)
    else mods.push(`${m.name}: seat its key in the ${point.face} socket recess and drive its 4 × M3 screws from inside the module into the Core inserts`)
  }
  if (build.kind === 'module') {
    const plug = modulePlug(build)
    if (plug) mods.push(plug.mount === 'rail' ? 'This module clamps onto a Picatinny rail of its Core; see the Core’s guide for the cable' : 'This module mounts on a DeckPort socket of its Core with 4 × M3 screws from inside')
  }
  add('modules', 'Mount the modules', mods)

  // Closing
  const close: string[] = []
  if (p.hinge && geo?.hardware.hingePin) close.push(`Push the Ø3 mm steel pin (${geo.hardware.hingePin.length} mm) through the hinge knuckles; a drop of glue in the end knuckles keeps it in`)
  if (p.closure === 'magnets') close.push(`Press in ${geo?.hardware.magnets ?? 0} Ø6 × 3 mm magnets, tray and lid with opposite faces out so they attract`)
  else {
    const n = geo?.fasteners.filter(f => f.purpose === 'closure') ?? []
    if (n.length) close.push(`Close the lid with ${n.length} × ${n[0].size} × ${n[0].screwLength} mm screws from the top`)
  }
  add('close', 'Close the case', close)
  return steps
}
