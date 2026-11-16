/**
 * Power budget: per-rail loads, converter capacity, battery draw, autonomy.
 *
 * Model: every battery is 1S and in parallel (the common cyberdeck case).
 * Loads sit on a rail; converters move power from one rail to another with an
 * efficiency; whatever reaches VBAT is drawn from the batteries. Rails are
 * resolved from the lowest voltage up so a 3.3 V regulator fed from 5 V adds
 * its input to the 5 V budget.
 */
import { componentById, syncCustomComponents } from '../catalog/components'
import { DECKPORT_VERSION, SOCKET_MAX_W } from './deckport'
import { incompatibility, mountPoints } from './modules'
import type { CatalogComponent, Rail } from '../catalog/types'
import type { Build, Placement } from './schema'

export const RAIL_ORDER: Rail[] = ['3V3', '5V', '12V', 'VBAT']
export const RAIL_VOLTS: Record<Rail, number> = { '3V3': 3.3, '5V': 5, '12V': 12, VBAT: 3.7 }

/** Usable fraction of a Li-ion pack's rated energy. */
export const USABLE_FRACTION = 0.85

export interface PowerItem {
  placement: Placement
  component: CatalogComponent
}

export interface LoadLine extends PowerItem {
  rail: Rail
  typW: number
  peakW: number
}

export interface ConverterLine extends PowerItem {
  in: Rail
  out: Rail
  maxW: number
  efficiency: number
  /** Share of the output rail assigned to this converter. */
  outTypW: number
  outPeakW: number
  inTypW: number
  inPeakW: number
  chargeW?: number
}

export interface RailLine {
  rail: Rail
  /** Direct loads plus converter inputs fed from this rail. */
  typW: number
  peakW: number
  capacityW: number | null
  feeders: string[]
}

export interface PowerIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  placementId?: string
}

export interface PowerReport {
  loads: LoadLine[]
  converters: ConverterLine[]
  rails: RailLine[]
  battery: { count: number; wh: number; maxW: number; nominalV: number | null; items: PowerItem[] }
  chargers: PowerItem[]
  drawTypW: number
  drawPeakW: number
  autonomyTypH: number | null
  autonomyPeakH: number | null
  chargeW: number
  chargeHours: number | null
  issues: PowerIssue[]
}

export function resolveItems(build: Build): PowerItem[] {
  syncCustomComponents(build)
  return build.placements
    .map(placement => ({ placement, component: componentById(placement.componentId) }))
    .filter((i): i is PowerItem => Boolean(i.component))
}

/** Total load a module puts on DeckPort VBUS, from its own budget. */
export function moduleDraw(module: Build): { typW: number; peakW: number } {
  const r = analysePower(module)
  return { typW: r.loads.reduce((a, l) => a + l.typW, 0), peakW: r.loads.reduce((a, l) => a + l.peakW, 0) }
}

export function analysePower(build: Build, modules: Build[] = []): PowerReport {
  // Modules first: each one syncs its own custom components, so the Core is resolved after.
  const attached = build.kind === 'core'
    ? mountPoints(build).flatMap(acc => {
        const m = acc.moduleId ? modules.find(x => x.id === acc.moduleId) : undefined
        return m && !incompatibility(acc, m) ? [{ acc, module: m, draw: moduleDraw(m) }] : []
      })
    : []
  const items = resolveItems(build)
  const issues: PowerIssue[] = []
  const loads: LoadLine[] = []
  const converters: ConverterLine[] = []
  const batteries: PowerItem[] = []
  const chargers: PowerItem[] = []
  // A module is powered by the Core through DeckPort VBUS.
  const viaDeckPort = build.kind === 'module' && build.accessories.some(a => a.kind === 'deckport')

  for (const it of items) {
    const pw = it.component.power
    if (!pw) continue
    if (pw.role === 'charger') chargers.push(it)
    else if (pw.role === 'load') loads.push({ ...it, rail: pw.rail, typW: pw.typW, peakW: pw.peakW })
    else if (pw.role === 'battery') batteries.push(it)
    else
      converters.push({
        ...it, in: pw.in, out: pw.out, maxW: pw.maxW, efficiency: pw.efficiency, chargeW: pw.chargeW,
        outTypW: 0, outPeakW: 0, inTypW: pw.quiescentW ?? 0, inPeakW: pw.quiescentW ?? 0,
      })
  }

  // An attached module is a load on the Core's 5 V rail, through its socket's VBUS.
  for (const { acc, module, draw } of attached) {
    const placement = { id: `module:${acc.id}`, componentId: module.id, label: `Module: ${module.name}`, part: acc.part, x: 0, y: 0, z: 0, rotation: 0, rotX: 0, rotY: 0, standoffs: false, window: false } as Placement
    const component: CatalogComponent = { id: module.id, name: module.name, category: 'connector', dims: { x: 1, y: 1, z: 1 }, mass: 0, price: 0, supplier: '' }
    loads.push({ placement, component, rail: '5V', typW: draw.typW, peakW: draw.peakW })
    if (draw.peakW > SOCKET_MAX_W)
      issues.push({ severity: 'high', message: `Module ${module.name} peaks at ${fmt(draw.peakW)} W; a DeckPort socket supplies ${SOCKET_MAX_W} W.` })
    if (module.deckport.split('.')[0] !== DECKPORT_VERSION.split('.')[0])
      issues.push({ severity: 'high', message: `Module ${module.name} implements DeckPort ${module.deckport}; this Core implements ${DECKPORT_VERSION}.` })
  }

  const railTyp: Record<Rail, number> = { '3V3': 0, '5V': 0, '12V': 0, VBAT: 0 }
  const railPeak: Record<Rail, number> = { '3V3': 0, '5V': 0, '12V': 0, VBAT: 0 }
  for (const l of loads) {
    railTyp[l.rail] += l.typW
    railPeak[l.rail] += l.peakW
  }

  const sbc = items.find(i => i.component.category === 'sbc')
  const rails: RailLine[] = []

  for (const rail of RAIL_ORDER) {
    if (rail === 'VBAT') continue
    const feeders = converters.filter(c => c.out === rail)
    const typ = railTyp[rail]
    const peak = railPeak[rail]
    const capacity = feeders.reduce((a, c) => a + c.maxW, 0)

    if (feeders.length) {
      for (const c of feeders) {
        const share = c.maxW / capacity
        c.outTypW = typ * share
        c.outPeakW = peak * share
        c.inTypW += c.outTypW / c.efficiency
        c.inPeakW += c.outPeakW / c.efficiency
        railTyp[c.in] += c.inTypW
        railPeak[c.in] += c.inPeakW
        if (c.outTypW > c.maxW)
          issues.push({ severity: 'critical', placementId: c.placement.id, message: `${label(c)} is overloaded: ${fmt(c.outTypW)} W typical on a ${c.maxW} W converter.` })
        else if (c.outPeakW > c.maxW)
          issues.push({ severity: 'high', placementId: c.placement.id, message: `${label(c)} peaks at ${fmt(c.outPeakW)} W, above its ${c.maxW} W rating. Expect brown-outs under load.` })
      }
    } else if (typ > 0) {
      if (rail === '5V' && viaDeckPort) {
        if (peak > SOCKET_MAX_W) issues.push({ severity: 'high', message: `${fmt(peak)} W on 5 V exceeds the ${SOCKET_MAX_W} W one DeckPort socket supplies.` })
      } else if (rail === '3V3' && (sbc || viaDeckPort)) {
        // Small 3.3 V loads hang off the SBC's own regulator.
        railTyp['5V'] += typ / 0.85
        railPeak['5V'] += peak / 0.85
        if (peak > 2.5) issues.push({ severity: 'medium', message: `${fmt(peak)} W on 3.3 V is a lot for the SBC regulator. Add a dedicated 3.3 V converter.` })
      } else {
        issues.push({ severity: batteries.length ? 'critical' : 'high', message: `Nothing supplies the ${rail} rail (${fmt(peak)} W peak). Add a converter that outputs ${rail}.` })
      }
    }
    const deckportFed = rail === '5V' && viaDeckPort && !feeders.length
    rails.push({ rail, typW: railTyp[rail], peakW: railPeak[rail], capacityW: feeders.length ? capacity : deckportFed ? SOCKET_MAX_W : null, feeders: deckportFed ? ['DeckPort VBUS (from the Core)'] : feeders.map(label) })
  }

  // Raspberry Pi 5 asks for 5 A at 5 V; below that it caps USB current.
  if (sbc && sbc.component.id.startsWith('rpi5')) {
    const cap5 = converters.filter(c => c.out === '5V').reduce((a, c) => a + c.maxW, 0)
    if (cap5 > 0 && cap5 < 25)
      issues.push({ severity: 'medium', message: `The 5 V supply is ${cap5} W. A Pi 5 below 25 W (5 V / 5 A) limits USB peripherals to 600 mA in total.` })
  }

  const wh = batteries.reduce((a, b) => a + (b.component.power?.role === 'battery' ? b.component.power.capacityWh : 0), 0)
  const maxW = batteries.reduce((a, b) => a + (b.component.power?.role === 'battery' ? b.component.power.maxW : 0), 0)
  const volts = new Set(batteries.map(b => (b.component.power?.role === 'battery' ? b.component.power.nominalV : 0)))
  if (volts.size > 1) issues.push({ severity: 'high', message: 'Batteries with different nominal voltages are modelled in parallel. Do not parallel unlike packs.' })

  const drawTyp = railTyp.VBAT
  const drawPeak = railPeak.VBAT
  rails.push({ rail: 'VBAT', typW: drawTyp, peakW: drawPeak, capacityW: batteries.length ? maxW : null, feeders: batteries.map(label) })

  if (batteries.length && drawPeak > maxW)
    issues.push({ severity: 'high', message: `Peak battery draw ${fmt(drawPeak)} W exceeds the ${fmt(maxW)} W the cells can deliver.` })
  if (!batteries.length && !viaDeckPort && (loads.length || converters.length))
    issues.push({ severity: 'info', message: 'No battery: this deck runs from an external supply.' })
  if (batteries.length && !converters.some(c => c.in === 'VBAT') && drawTyp === 0 && loads.length)
    issues.push({ severity: 'critical', message: 'The battery is not connected to anything: add a converter from VBAT.' })

  const chargeW = converters.reduce((a, c) => a + (c.chargeW ?? 0), 0) + chargers.reduce((a, c) => a + (c.component.power?.role === 'charger' ? c.component.power.chargeW : 0), 0)
  if (batteries.length && !chargeW)
    issues.push({ severity: 'low', message: 'No charger in the build. Add a power-bank board or UPS, or charge the cells externally.' })

  const usable = wh * USABLE_FRACTION
  return {
    loads,
    converters,
    rails,
    battery: { count: batteries.length, wh, maxW, nominalV: volts.size === 1 ? [...volts][0] : null, items: batteries },
    chargers,
    drawTypW: drawTyp,
    drawPeakW: drawPeak,
    autonomyTypH: batteries.length && drawTyp > 0 ? usable / drawTyp : null,
    autonomyPeakH: batteries.length && drawPeak > 0 ? usable / drawPeak : null,
    chargeW,
    chargeHours: batteries.length && chargeW ? wh / (chargeW * 0.85) : null,
    issues,
  }
}

/** Smallest common AWG for a current, with headroom for short runs in a warm case. */
export function awgFor(amps: number): number {
  const table: [number, number][] = [[0.5, 28], [1, 26], [2, 24], [3.5, 22], [5, 20], [7.5, 18], [10, 16], [15, 14]]
  return (table.find(([a]) => amps <= a) ?? [0, 12])[1]
}

function label(i: PowerItem): string {
  return i.placement.label ?? i.component.name
}

export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace(/\.0+$/, '')
}
