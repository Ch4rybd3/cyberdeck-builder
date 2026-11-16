/**
 * How Cores and modules fit together, without any geometry:
 *
 *   Core mounting point        accepts             module plug
 *   DeckPort socket       →    direct mount   ←    DeckPort plug (mount: direct)
 *   Picatinny rail        →    rail mount     ←    rail clamp    (mount: rail)
 *
 * The connector (8-pin pogo or USB-C) must match on a direct mount. A rail
 * mount always uses a USB-C cable from the module to a port beside the rail.
 */
import type { Accessory, Build } from './schema'

export type Mount = 'direct' | 'rail'

/** Mounting points on a Core: DeckPort sockets and Picatinny rails. */
export function mountPoints(core: Build): Accessory[] {
  return core.kind === 'core' ? core.accessories.filter(a => a.kind === 'deckport' || a.kind === 'picatinny') : []
}

export function pointMount(point: Accessory): Mount {
  return point.kind === 'picatinny' ? 'rail' : 'direct'
}

export function modulePlug(module: Build): Accessory | undefined {
  return module.accessories.find(a => a.kind === 'deckport')
}

export function moduleMount(module: Build): Mount | null {
  const plug = modulePlug(module)
  return plug ? (plug.mount ?? 'direct') : null
}

export function connectorOf(a: Accessory): 'pogo' | 'usb-c' {
  return a.connector ?? 'pogo'
}

/** Why a module cannot go on a mounting point, or null when it fits. */
export function incompatibility(point: Accessory, module: Build): string | null {
  const plug = modulePlug(module)
  if (!plug) return `${module.name} has no DeckPort plug or rail clamp.`
  const want = pointMount(point)
  const has = plug.mount ?? 'direct'
  if (want !== has) return has === 'rail' ? `${module.name} clamps onto a Picatinny rail; it cannot go on a DeckPort socket.` : `${module.name} plugs into a DeckPort socket; it has no rail clamp.`
  if (want === 'direct' && connectorOf(point) !== connectorOf(plug))
    return `${module.name} has a ${connectorOf(plug) === 'usb-c' ? 'USB-C' : 'pogo'} plug; this socket is ${connectorOf(point) === 'usb-c' ? 'USB-C' : 'pogo'}.`
  return null
}

/** A label for a mounting point, for lists: "Socket · right" or "Rail · left, 140 mm". */
export function pointLabel(point: Accessory): string {
  const where = point.part === 'lid' ? `lid ${point.face}` : point.face
  return point.kind === 'picatinny' ? `Rail · ${where}, ${point.length} mm` : `Socket · ${where}${point.connector === 'usb-c' ? ', USB-C' : ''}`
}

export function modulesFor(core: Build, library: Build[]): Build[] {
  const ids = new Set(mountPoints(core).filter(a => a.moduleId).map(a => a.moduleId!))
  return library.filter(b => ids.has(b.id) && b.kind === 'module')
}
