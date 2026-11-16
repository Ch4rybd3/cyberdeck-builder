/**
 * Constraint engine. Collects every check into one ranked list so the
 * Workshop can show "what is wrong with this deck right now".
 *
 * Severities reuse Remora's scale: critical blocks a working build, high will
 * probably bite you, medium deserves a look, low is advice, info is context.
 */
import { componentById, syncCustomComponents } from '../catalog/components'
import { carriedPlacementIds, type GeometryResult } from '../geometry/caseBuilder'
import { SOCKET_MAX_W } from './deckport'
import { boxSize, contains, interiorBox, intersects, placementBox } from './layout'
import { analysePorts } from './ports'
import { analysePower, fmt } from './power'
import { printerById } from './printers'
import type { Build } from './schema'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type CheckCategory = 'fit' | 'power' | 'ports' | 'thermal' | 'print' | 'module'

export interface Issue {
  id: string
  severity: Severity
  category: CheckCategory
  message: string
  placementId?: string
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export function checkBuild(build: Build, geo?: GeometryResult | null): Issue[] {
  syncCustomComponents(build)
  const issues: Issue[] = []
  const push = (category: CheckCategory, severity: Severity, message: string, placementId?: string) =>
    issues.push({ id: `${category}-${issues.length}`, category, severity, message, placementId })

  const p = build.case.params
  const interior = interiorBox(p)
  const carried = carriedPlacementIds(build)
  const boxes = build.placements
    .filter(pl => !carried.has(pl.id))
    .map(pl => ({ pl, c: componentById(pl.componentId) }))
    .filter(x => x.c)
    .map(x => ({ ...x, c: x.c!, box: placementBox(build, x.c!, x.pl) }))

  // ── fit ──
  for (const { pl, c, box } of boxes) {
    if (!contains(interior, box)) {
      const over = [
        interior.min[0] - box.min[0], box.max[0] - interior.max[0],
        interior.min[1] - box.min[1], box.max[1] - interior.max[1],
        interior.min[2] - box.min[2], box.max[2] - interior.max[2],
      ]
      const worst = Math.max(...over)
      push('fit', 'critical', `${pl.label ?? c.name} sticks out of the case by ${fmt(worst)} mm.`, pl.id)
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (intersects(boxes[i].box, boxes[j].box))
        push('fit', 'high', `${boxes[i].pl.label ?? boxes[i].c.name} collides with ${boxes[j].pl.label ?? boxes[j].c.name}.`, boxes[i].pl.id)

  if (geo) {
    for (const { pl, c, box } of boxes)
      if (geo.jointBoxes.some(j => intersects(j, box)))
        push('fit', 'medium', `${pl.label ?? c.name} overlaps a split joint block. Move it, or change the printer.`, pl.id)
  }

  // ── power & ports ──
  const power = analysePower(build)
  power.issues.forEach(i => push('power', i.severity, i.message, i.placementId))
  analysePorts(build).issues.forEach(i => push('ports', i.severity, i.message))

  // ── thermal ──
  const vents = build.features.some(f => f.enabled && f.op === 'cut' && f.face !== 'top') || build.placements.some(pl => pl.componentId.startsWith('fan-'))
  const heat = power.loads.reduce((a, l) => a + l.typW, 0) + power.converters.reduce((a, c) => a + (c.inTypW - c.outTypW), 0)
  if (heat > 6 && !vents) push('thermal', 'medium', `About ${fmt(heat)} W of heat in a closed case with no vents or fan. Add vent cuts on a side or the bottom.`)
  const pi = build.placements.find(pl => pl.componentId.startsWith('rpi5-') && !pl.componentId.includes('cooler'))
  if (pi && !build.placements.some(pl => pl.componentId === 'rpi5-active-cooler' || pl.componentId.startsWith('fan-')))
    push('thermal', 'low', 'The Pi 5 throttles under sustained load without active cooling. Consider the Active Cooler or a fan.', pi.id)

  // ── print ──
  const printer = printerById(build.print.printerId)
  if (p.wall < 1.6) push('print', 'medium', `Walls of ${p.wall} mm are under four 0.4 mm perimeters. Use at least 1.6 mm.`)
  if (geo) {
    geo.issues.forEach(i => push('print', i.severity, i.message))
    for (const piece of geo.pieces)
      if (!piece.fitsBed) {
        const [x, y, z] = piece.size.map(v => Math.round(v))
        push('print', 'critical', `${piece.name} (${x} × ${y} × ${z} mm) does not fit the ${printer.name} bed.`)
      }
    const colors = new Set(geo.pieces.flatMap(pc => pc.bodies.map(b => b.color.toLowerCase())))
    const perPiece = Math.max(0, ...geo.pieces.map(pc => new Set(pc.bodies.map(b => b.color.toLowerCase())).size))
    if (perPiece > printer.colors)
      push('print', printer.colors === 1 ? 'low' : 'medium',
        printer.colors === 1
          ? `A piece uses ${perPiece} colours on a single-extruder printer. Inlays on a flat face print with one manual filament swap (M600) at the inlay layer.`
          : `A piece uses ${perPiece} colours; the ${printer.name} handles ${printer.colors} in one print.`)
    if (colors.size > 1) push('print', 'info', `${colors.size} filament colours across the build.`)
  }

  // ── sliders ──
  for (const a of build.accessories.filter(x => x.kind === 'slider')) {
    if (!a.targetId) push('fit', 'low', 'A screen slider has no display assigned. Pick one in its inspector so the carriage is sized for it.')
    else if (!build.placements.some(pl => pl.id === a.targetId)) push('fit', 'medium', 'A screen slider points at a display that is no longer in the build.')
  }
  if (p.hinge && build.placements.some(pl => pl.part === 'lid' && pl.window && componentById(pl.componentId)?.category === 'display'))
    push('fit', 'low', 'This case is hinged: a display in the lid usually faces inward. Turn off its window so the lid top stays closed.')

  // ── module / DeckPort ──
  const sockets = build.accessories.filter(a => a.kind === 'deckport')
  if (build.kind === 'module') {
    if (!sockets.length) push('module', 'high', 'A module needs a DeckPort plug. Add a DeckPort accessory to one face.')
    const peak = power.loads.reduce((a, l) => a + l.peakW, 0)
    if (peak > SOCKET_MAX_W) push('module', 'high', `This module peaks at ${fmt(peak)} W; one DeckPort socket supplies ${SOCKET_MAX_W} W.`)
    if (power.battery.count === 0 && power.converters.length === 0 && peak > 0)
      push('module', 'info', `Powered from the Core through DeckPort VBUS (${fmt(peak)} W peak).`)
  } else if (sockets.length) {
    push('module', 'info', `${sockets.length} DeckPort socket${sockets.length > 1 ? 's' : ''} ready for modules.`)
  }

  issues.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  return issues
}

/** Overall footprint of the assembled deck including accessories, from the case parameters. */
export function deckSize(build: Build): [number, number, number] {
  const p = build.case.params
  return [p.width, p.depth, p.trayHeight + p.lidHeight]
}

export { boxSize }
