/**
 * Wiring diagram derivation.
 *
 * The diagram is generated from the build — batteries to converters,
 * converters to the loads on their rail, ports to the devices plugged into
 * them — and then edited by hand. Derived wires carry deterministic ids, so a
 * wire the user deleted stays deleted (`suppressed`) and a wire the user drew
 * survives regeneration.
 */
import { SOCKET_MAX_W } from './deckport'
import { analysePorts, DECKPORT_NODE } from './ports'
import { analysePower, awgFor, fmt, RAIL_VOLTS } from './power'
import type { Build, Wire } from './schema'

export interface DerivedWire extends Wire {
  /** Current in amps, for power wires. */
  amps?: number
  awg?: number
}

export interface VirtualNode {
  id: string
  title: string
  subtitle: string
}

/** Nodes that are not placements: DeckPort sockets on a Core, the plug on a module. */
export function virtualNodes(build: Build): VirtualNode[] {
  const sockets = build.accessories.filter(a => a.kind === 'deckport')
  if (build.kind === 'module') return sockets.length ? [{ id: DECKPORT_NODE, title: 'DeckPort plug', subtitle: `5V · USB 2.0 · I²C from the Core` }] : []
  return sockets.map((s, i) => ({ id: `deckport:${s.id}`, title: `DeckPort socket ${i + 1}`, subtitle: `${s.part}/${s.face} · ${SOCKET_MAX_W} W VBUS` }))
}

export function deriveWires(build: Build): DerivedWire[] {
  const power = analysePower(build)
  const ports = analysePorts(build)
  const out: DerivedWire[] = []

  // Battery → every converter fed from VBAT.
  for (const bat of power.battery.items) {
    for (const c of power.converters.filter(c => c.in === 'VBAT')) {
      const amps = c.inPeakW / (power.battery.nominalV ?? RAIL_VOLTS.VBAT) / Math.max(1, power.battery.count)
      out.push(powerWire(bat.placement.id, c.placement.id, `VBAT · ${fmt(c.inPeakW / Math.max(1, power.battery.count))} W`, amps))
    }
  }

  // Charger → every battery.
  for (const ch of power.chargers)
    for (const bat of power.battery.items) {
      const w = ch.component.power?.role === 'charger' ? ch.component.power.chargeW : 0
      out.push(powerWire(ch.placement.id, bat.placement.id, `Charge · ${fmt(w)} W`, w / (power.battery.nominalV ?? 3.7)))
    }

  // Converter → loads (and downstream converters) on its output rail.
  for (const c of power.converters) {
    const downstream = [
      ...power.loads.filter(l => l.rail === c.out).map(l => ({ id: l.placement.id, w: l.peakW })),
      ...power.converters.filter(d => d.in === c.out && d.placement.id !== c.placement.id).map(d => ({ id: d.placement.id, w: d.inPeakW })),
    ]
    const feeders = power.converters.filter(o => o.out === c.out)
    // With several converters on one rail, each load is wired to the first.
    if (feeders[0]?.placement.id !== c.placement.id) continue
    for (const d of downstream) {
      const amps = d.w / RAIL_VOLTS[c.out]
      out.push(powerWire(c.placement.id, d.id, `${c.out} · ${fmt(d.w)} W`, amps))
    }
  }

  // DeckPort power: the Core's 5 V supply feeds each socket; a module's 5 V loads hang off its plug.
  const five = power.converters.find(c => c.out === '5V')
  for (const v of virtualNodes(build)) {
    if (build.kind === 'core' && five) out.push(powerWire(five.placement.id, v.id, `VBUS · ${SOCKET_MAX_W} W`, SOCKET_MAX_W / 5))
    if (build.kind === 'module' && !five)
      for (const l of power.loads.filter(l => l.rail === '5V')) out.push(powerWire(v.id, l.placement.id, `VBUS · ${fmt(l.peakW)} W`, l.peakW / 5))
  }

  // 3.3 V loads with no regulator hang off the SBC.
  const sbc = build.placements.find(p => p.componentId.startsWith('rpi'))
  if (sbc && !power.converters.some(c => c.out === '3V3')) {
    for (const l of power.loads.filter(l => l.rail === '3V3'))
      out.push(powerWire(sbc.id, l.placement.id, `3V3 · ${fmt(l.peakW)} W`, l.peakW / 3.3))
  }

  // Data: one wire per port assignment, merged when a pair shares several ports.
  const seen = new Map<string, DerivedWire>()
  for (const a of ports.assignments) {
    const id = `auto:data:${a.providerId}:${a.consumerId}`
    const existing = seen.get(id)
    if (existing) {
      if (!existing.label.includes(a.port)) existing.label += ` + ${a.port}`
      continue
    }
    const w: DerivedWire = { id, from: a.providerId, to: a.consumerId, kind: a.port === 'i2c' || a.port === 'gpio' ? 'signal' : 'data', label: a.port, auto: true }
    seen.set(id, w)
    out.push(w)
  }
  return out
}

function powerWire(from: string, to: string, label: string, amps: number): DerivedWire {
  const awg = awgFor(amps)
  return { id: `auto:power:${from}:${to}`, from, to, kind: 'power', label: `${label} · ${awg} AWG`, auto: true, amps, awg }
}

/** Derived wires minus the suppressed ones, plus the user's own. */
export function effectiveWires(build: Build): DerivedWire[] {
  const ids = new Set([...build.placements.map(p => p.id), ...virtualNodes(build).map(v => v.id)])
  const derived = deriveWires(build).filter(w => !build.wiring.suppressed.includes(w.id))
  const manual = build.wiring.wires.filter(w => !w.auto && ids.has(w.from) && ids.has(w.to))
  return [...derived, ...manual]
}
