/**
 * Port budget: who plugs into whom.
 *
 * Supply comes from components that provide ports (the SBC, hubs, HATs);
 * demand from components that consume them. Assignment is greedy: the SBC's
 * own ports first, then hubs and HATs, in placement order. The result drives
 * both the port check and the data wires in the wiring diagram.
 */
import { PORT_LABEL, type PortType } from '../catalog/types'
import { resolveItems, type PowerIssue } from './power'
import type { Build } from './schema'

/** Pseudo-node id for the DeckPort plug of a module. */
export const DECKPORT_NODE = 'deckport'

export interface PortAssignment {
  port: PortType
  providerId: string
  consumerId: string
}

export interface PortReport {
  supply: Partial<Record<PortType, number>>
  demand: Partial<Record<PortType, number>>
  assignments: PortAssignment[]
  issues: PowerIssue[]
}

export function analysePorts(build: Build): PortReport {
  const items = resolveItems(build)
  const supply: Partial<Record<PortType, number>> = {}
  const demand: Partial<Record<PortType, number>> = {}
  const free = new Map<string, Partial<Record<PortType, number>>>()

  const ordered = [...items].sort((a, b) => Number(b.component.category === 'sbc') - Number(a.component.category === 'sbc'))
  const providers: { id: string; provides: Partial<Record<PortType, number>> }[] = ordered.map(it => ({ id: it.placement.id, provides: it.component.ports?.provides ?? {} }))
  const consumers: { id: string; consumes: Partial<Record<PortType, number>> }[] = items.map(it => ({ id: it.placement.id, consumes: it.component.ports?.consumes ?? {} }))

  // DeckPort carries USB 2.0 and I²C. A module receives them from its plug;
  // a Core must route one USB port and the I²C bus to each socket.
  const sockets = build.accessories.filter(a => a.kind === 'deckport')
  if (build.kind === 'module' && sockets.length) providers.push({ id: DECKPORT_NODE, provides: { 'usb-a': 1, i2c: 8 } })
  if (build.kind === 'core') sockets.forEach(s => consumers.push({ id: `deckport:${s.id}`, consumes: { 'usb-a': 1 } }))

  for (const pv of providers) {
    free.set(pv.id, { ...pv.provides })
    for (const [k, n] of Object.entries(pv.provides)) supply[k as PortType] = (supply[k as PortType] ?? 0) + (n ?? 0)
  }

  const assignments: PortAssignment[] = []
  const issues: PowerIssue[] = []
  for (const it of consumers) {
    for (const [k, n] of Object.entries(it.consumes)) {
      const port = k as PortType
      demand[port] = (demand[port] ?? 0) + (n ?? 0)
      for (let i = 0; i < (n ?? 0); i++) {
        const provider = providers.find(o => o.id !== it.id && (free.get(o.id)?.[port] ?? 0) > 0)
        if (!provider) continue
        const f = free.get(provider.id)!
        f[port] = (f[port] ?? 0) - 1
        assignments.push({ port, providerId: provider.id, consumerId: it.id })
      }
    }
  }

  for (const [k, need] of Object.entries(demand)) {
    const have = supply[k as PortType] ?? 0
    if ((need ?? 0) > have) {
      const hint = k === 'usb-a' ? ' Add a USB hub.' : k === 'mipi' ? ' Use an HDMI display instead.' : k === 'micro-hdmi' ? ' The Pi 5 has two.' : ''
      issues.push({ severity: 'high', message: `Not enough ${PORT_LABEL[k as PortType]}: ${need} needed, ${have} available.${hint}` })
    }
  }
  return { supply, demand, assignments, issues }
}
