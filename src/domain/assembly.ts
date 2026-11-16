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

/**
 * How an item's parts move into place in the assembly simulation:
 *   drop    from above, into the case
 *   slide   in along the face they mount on (accessories, modules)
 *   join    split pieces of one part come together
 *   close   the lid comes down, or swings shut on its hinge
 *   show    highlighted where they are, no motion
 */
export type Motion = 'drop' | 'slide' | 'join' | 'close' | 'show'

export interface AssemblyItem {
  text: string
  /** Generated piece ids (case, accessories, mounted modules) this item is about. */
  pieces?: string[]
  /** Pieces whose id starts with one of these prefixes (an accessory's several pieces, a module). */
  piecePrefixes?: string[]
  /** Component placements this item is about. */
  placements?: string[]
  /** Whole parts this item is about ('tray', 'lid'). */
  parts?: ('tray' | 'lid')[]
  motion?: Motion
}

export interface AssemblyStep {
  id: string
  title: string
  items: AssemblyItem[]
  note?: string
}

export function assemblySteps(build: Build, geo: GeometryResult | null, modules: Build[] = []): AssemblyStep[] {
  syncCustomComponents(build)
  const steps: AssemblyStep[] = []
  const add = (id: string, title: string, items: (string | AssemblyItem)[], note?: string) =>
    items.length && steps.push({ id, title, items: items.map(i => (typeof i === 'string' ? { text: i } : i)), note })
  const p = build.case.params
  const printer = printerById(build.print.printerId)
  const mat = MATERIALS[build.print.material]

  if (geo) {
    add(
      'print',
      `Print ${geo.pieces.length} pieces`,
      geo.pieces.map((pc): AssemblyItem => {
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
        return { text: `${pc.name}: ${pc.size.map(v => Math.round(v)).join(' × ')} mm, ${orient}${colors.length > 1 ? `, ${colors.length} colours` : ''}`, pieces: [pc.id], motion: 'show' }
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
      [...bySize].map(([size, e]): AssemblyItem => ({ text: `${e.n} × ${size} (hole Ø${INSERTS[size as keyof typeof INSERTS].holeD} mm): ${[...e.purposes].map(x => label[x]).join(', ')}`, parts: ['tray', 'lid'], motion: 'show' })),
      'About 220 °C for PLA, 240 °C for PETG, with an insert tip. Press straight, stop flush, let them cool before loading them.',
    )

    const joints = geo.fasteners.filter(f => f.purpose === 'split-joint')
    if (joints.length)
      add('join', 'Join the split pieces', [
        ...(['tray', 'lid'] as const)
          .filter(part => geo.pieces.filter(pc => pc.group === part).length > 1)
          .map((part): AssemblyItem => ({ text: `${part === 'tray' ? 'Tray' : 'Lid'}: ${geo.pieces.filter(pc => pc.group === part).length} pieces, ${joints.length} × ${joints[0].size} × ${joints[0].screwLength} mm screws in all. Inserts go in the blocks on one side of each cut; drive the screws from the blocks on the other side`, parts: [part], motion: 'join' })),
        'Check the seams are flush on a flat surface before tightening fully',
      ])
  }

  // Accessories
  const acc: AssemblyItem[] = []
  const accItem = (a: { id: string }, text: string): AssemblyItem => ({ text, piecePrefixes: [`acc-${a.id}`], motion: 'slide' })
  for (const a of build.accessories) {
    if (a.kind === 'picatinny') acc.push(accItem(a, `Picatinny rail on the ${a.part} ${a.face} face: M3 screws through its counterbores${a.port && a.port !== 'none' ? `; fit a USB-C panel receptacle in the port ${a.port === 'above' || a.port === 'below' ? a.port : `past the ${a.port}`} of the rail` : ''}`))
    else if (a.kind === 'handle' && a.style === 'tube') acc.push(accItem(a, `Tube handle on the ${a.part} ${a.face} face: screw both posts on (2 × M3 each), slide the grip between them, then push the M5 bolt through post, grip and post and tighten the nut in its hex trap`))
    else if (a.kind === 'handle') acc.push(accItem(a, `Handle on the ${a.part} ${a.face} face: 4 × M3 through its counterbores`))
    else if (a.kind === 'foot') acc.push(accItem(a, `Foot at (${Math.round(a.u)}, ${Math.round(a.v)}) on the bottom: 1 × M3, then a rubber bumper`))
    else if (a.kind === 'deckport' && build.kind === 'core') acc.push({ text: `DeckPort socket on the ${a.part} ${a.face} face: ${a.connector === 'usb-c' ? 'glue or screw a USB-C receptacle (10 kΩ CC pull-up) behind the window' : 'fit the 8-pin pogo receptacle behind the window'}`, parts: [a.part], motion: 'show' })
    else if (a.kind === 'deckport' && a.mount === 'rail') acc.push(accItem(a, 'Rail clamp: screw it to the module with 4 × M3, then fit the USB-C receptacle (5.1 kΩ CC pull-down) in the end port'))
    else if (a.kind === 'deckport') acc.push({ text: `DeckPort plug: fit the ${a.connector === 'usb-c' ? 'USB-C male plug' : 'pogo pin block'} behind the window, pins facing out`, parts: [a.part], motion: 'show' })
    else if (a.kind === 'gland') acc.push({ text: `${a.gland ?? 'PG7'} cable gland in the ${a.part} ${a.face} hole: screw it in from outside, locknut inside; pass the cable before tightening the cap`, parts: [a.part], motion: 'show' })
    else if (a.kind === 'grommet') acc.push(accItem(a, `Grommet in the ${a.part} ${a.face} slot: push it in from outside until its lip snaps behind the wall`))
    else if (a.kind === 'tiepoint') continue
    else if (a.kind === 'kickstand') acc.push(accItem(a, 'Kickstand: put the leg between the hinge cheeks, push the M3 bolt through, add the nyloc nut and tighten until the leg holds its angle; then screw the hinge under the case with 2 × M3'))
    else if (a.kind === 'slider') {
      acc.push({ text: 'Slider: screw the rails to the lid', piecePrefixes: [`acc-${a.id}-rail`], motion: 'slide' })
      acc.push({ text: 'Put the display in the carriage, route its cable through the carriage slot and the lid slot, and screw the bezel on', piecePrefixes: [`acc-${a.id}-carriage`, `acc-${a.id}-bezel`], placements: a.targetId ? [a.targetId] : [], motion: 'drop' })
      acc.push({ text: 'Slide the carriage onto the rails from the front, then screw on the four end stops', piecePrefixes: [`acc-${a.id}-stop`], motion: 'slide' })
    }
  }
  add('accessories', 'Fit the accessories', acc)

  // Electronics (displays on a slider were handled with the slider)
  const carried = new Set(build.accessories.filter(a => a.kind === 'slider' && a.targetId).map(a => a.targetId!))
  const elec: AssemblyItem[] = []
  for (const pl of build.placements) {
    const c = componentById(pl.componentId)
    if (!c) continue
    const name = pl.label ?? c.name
    const where = pl.part === 'tray' ? 'tray' : 'lid'
    if (carried.has(pl.id)) continue
    const how =
      pl.standoffs && c.mounting && (pl.rotX ?? 0) === 0 && (pl.rotY ?? 0) === 0
        ? `${c.mounting.holes.length} × ${c.mounting.insert} screws into its standoffs`
        : 'no standoffs — use double-sided foam tape, a bracket or a printed clip'
    elec.push({ text: `${name} in the ${where} at (${Math.round(pl.x)}, ${Math.round(pl.y)}): ${how}`, placements: [pl.id], motion: 'drop' })
  }
  add('electronics', 'Mount the electronics', elec, 'Fit batteries last, after the wiring is checked with a bench supply.')

  const names = new Map(build.placements.map(pl => [pl.id, pl.label ?? componentById(pl.componentId)?.name ?? pl.id]))
  const nodeName = (id: string) => names.get(id) ?? (id.startsWith('deckport') ? 'DeckPort' : id)
  const wires = effectiveWires(build)
  const ends = (w: { from: string; to: string }) => [w.from, w.to].filter(id => names.has(id))
  const ties = build.accessories.filter(a => a.kind === 'tiepoint').length
  add('wiring', 'Wire it up', [
    ...(ties ? [{ text: `Bundle the wires with zip ties through the ${ties} tie point${ties > 1 ? 's' : ''}; leave slack at connectors and across the lid`, parts: ['tray' as const], motion: 'show' as const }] : []),
    ...wires.filter(w => w.kind === 'power').map((w): AssemblyItem => ({ text: `Power: ${nodeName(w.from)} → ${nodeName(w.to)} (${w.label})`, placements: ends(w), motion: 'show' })),
    ...wires.filter(w => w.kind !== 'power').map((w): AssemblyItem => ({ text: `${w.kind === 'data' ? 'Data' : 'Signal'}: ${nodeName(w.from)} → ${nodeName(w.to)} (${w.label})`, placements: ends(w), motion: 'show' })),
  ], 'Check polarity with a multimeter before the first power-on. Fuse the battery output.')

  // Modules
  const mods: AssemblyItem[] = []
  for (const point of mountPoints(build)) {
    const m = modules.find(x => x.id === point.moduleId)
    if (!m) continue
    const text = point.kind === 'picatinny'
      ? `${m.name}: slide its clamp onto the ${point.face} rail, bolt in the slot, M4 cross bolt and nut; plug the USB-C cable from its end port into the port by the rail`
      : `${m.name}: seat its key in the ${point.face} socket recess and drive its 4 × M3 screws from inside the module into the Core inserts`
    mods.push({ text, piecePrefixes: [`mod-${point.id}-`], motion: 'slide' })
  }
  if (build.kind === 'module') {
    const plug = modulePlug(build)
    if (plug) mods.push({ text: plug.mount === 'rail' ? 'This module clamps onto a Picatinny rail of its Core; see the Core’s guide for the cable' : 'This module mounts on a DeckPort socket of its Core with 4 × M3 screws from inside' })
  }
  add('modules', 'Mount the modules', mods)

  // Closing
  const close: AssemblyItem[] = []
  if (p.hinge && geo?.hardware.hingePin) close.push({ text: `Push the Ø3 mm steel pin (${geo.hardware.hingePin.length} mm) through the hinge knuckles; a drop of glue in the end knuckles keeps it in`, parts: ['lid'], motion: 'show' })
  if (p.closure === 'magnets') close.push({ text: `Press in ${geo?.hardware.magnets ?? 0} Ø6 × 3 mm magnets, tray and lid with opposite faces out so they attract, then close the lid`, parts: ['lid'], motion: 'close' })
  else {
    const n = geo?.fasteners.filter(f => f.purpose === 'closure') ?? []
    if (n.length) close.push({ text: `Close the lid with ${n.length} × ${n[0].size} × ${n[0].screwLength} mm screws from the top`, parts: ['lid'], motion: 'close' })
  }
  add('close', 'Close the case', close)
  return steps
}
