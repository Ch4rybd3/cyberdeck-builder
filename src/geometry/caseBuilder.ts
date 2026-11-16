/**
 * Case generator: Build → printable pieces.
 *
 * Pipeline for each part (tray, lid):
 *   1. Shell — rounded box minus its interior.
 *   2. Closure — bosses with heat-set inserts in the tray, counterbored
 *      clearance holes in the lid, so screws are driven from the top.
 *   3. Placements — standoffs with inserts under each board, windows for
 *      screens, keyboards and ports.
 *   4. Features — the user's extrude / cut / inlay / boss operations.
 *   5. Accessories — insert bosses in the case, plus a separate bolt-on piece.
 *   6. Bed fit — if the part exceeds the printer bed it is cut into a grid of
 *      pieces. Every cut gets joint blocks: one side carries a heat-set insert,
 *      the other a clearance hole, so the screw is driven from the far side and
 *      clamps the two halves together.
 *
 * Coordinates follow domain/layout.ts. The lid is generated in its own frame
 * (z = 0 at its open rim) and lifted into place by its assembly matrix.
 */
import type { CrossSection, Manifold, ManifoldToplevel, Mat4, Vec2 } from 'manifold-3d'

import { componentById, syncCustomComponents } from '../catalog/components'
import { SOCKET } from '../domain/deckport'
import { INSERTS, screwLength, type FastenerUse, type InsertSpec } from '../domain/hardware'
import {
  faceFrame,
  frameMatrix,
  partOffsetZ,
  placementBox,
  isFlat,
  placedWindows,
  rotate2,
  rotatedFootprint,
  standoffHeight,
  type AABB,
  type Frame,
  type V3,
} from '../domain/layout'
import { BED_MARGIN, printerById } from '../domain/printers'
import type { Accessory, Build, Feature, PartId, Shape } from '../domain/schema'
import { Scope } from './kernel'
import { fontsReady, textContours } from './text'

// ── Output ───────────────────────────────────────────────────────────────────

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface GeneratedBody {
  color: string
  mesh: MeshData
  /** mm³ */
  volume: number
}

export interface GeneratedPiece {
  id: string
  name: string
  group: PartId | 'accessory'
  bodies: GeneratedBody[]
  /** Column-major matrix: piece-local → assembled deck. */
  assembly: number[]
  /** Direction the piece moves in the exploded view. */
  explode: V3
  /** Lids print upside down, top surface on the bed. */
  printFlip: boolean
  size: V3
  fitsBed: boolean
  /** Which part this piece moves with when the lid opens on its hinge. */
  attachedTo: PartId | null
  /** Pieces that slide (screen carriage, bezel): axis in assembled space and travel in mm. */
  slide?: { axis: V3; travel: number }
}

/** A display carried by a slider: drawn on the carriage, not in the case. */
export interface CarriedDisplay {
  placementId: string
  /** Box centre in assembled coordinates, closed position. */
  centre: V3
  size: V3
  axis: V3
  travel: number
}

export interface HardwareUse {
  magnets: number
  hingePin: { count: number; length: number } | null
}

export interface GeometryIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
}

export interface GeometryResult {
  pieces: GeneratedPiece[]
  fasteners: FastenerUse[]
  /** Split-joint blocks in assembled coordinates, for collision checks. */
  jointBoxes: AABB[]
  carried: CarriedDisplay[]
  hardware: HardwareUse
  issues: GeometryIssue[]
  durationMs: number
}

/** Placements held by a slider carriage: no standoffs, no case window, no case-fit check. */
export function carriedPlacementIds(build: Build): Set<string> {
  return new Set(build.accessories.filter(a => a.kind === 'slider' && a.targetId).map(a => a.targetId!))
}

/** Screen slider dimensions, shared by the generator and the checks. */
export const SLIDER = {
  clearance: 0.3,
  /** Dovetail rail: narrow at the lid, wide at the top, so it captures the carriage. */
  railBottom: 8,
  railTop: 12,
  railH: 5,
  base: 7.5,
  wall: 6.5,
  bezel: 2,
  /** Length of each separate end-stop block. */
  endStop: 6,
}

export function sliderGeometry(build: Build, acc: Accessory) {
  const target = acc.targetId ? build.placements.find(pl => pl.id === acc.targetId) : undefined
  const disp = target ? componentById(target.componentId) : undefined
  const fp = disp && target ? rotatedFootprint(disp, target.rotation) : { x: acc.width ?? 180, y: acc.length }
  const pocketW = fp.x + 1
  const pocketL = fp.y + 1
  // The carriage can be wider than its display so the rails clear a keyboard window in the lid.
  const CW = Math.max(pocketW + 2 * SLIDER.wall, acc.width ?? 0)
  const CL = pocketL + 2 * SLIDER.wall
  const dispZ = disp?.dims.z ?? 10
  const CH = SLIDER.base + dispZ + 0.5
  const travel = acc.travel ?? 80
  const railX = CW / 2 - 10
  return { target, disp, fp, pocketW, pocketL, CW, CL, CH, dispZ, travel, railX, span: CL + travel + 2 * SLIDER.endStop }
}

// ── Matrix helpers (column-major 4×4) ────────────────────────────────────────

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function mul(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return out
}

function translation(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]
}

// ── Generator ────────────────────────────────────────────────────────────────

interface PartBodies {
  add: Manifold[]
  cut: Manifold[]
  /** Inlay pockets: removed from the main body but not from inlay bodies. */
  pocket: Manifold[]
  colored: { color: string; m: Manifold }[]
}

export function generateCase(wasm: ManifoldToplevel, build: Build): GeometryResult {
  const t0 = performance.now()
  syncCustomComponents(build)
  const { Manifold: M, CrossSection: CS } = wasm
  const s = new Scope()
  const p = build.case.params
  const colors = build.case.colors
  const fasteners: FastenerUse[] = []
  const issues: GeometryIssue[] = []
  const jointBoxes: AABB[] = []
  const pieces: GeneratedPiece[] = []
  const isModule = build.kind === 'module'
  const spec3 = INSERTS.M3
  const printer = printerById(build.print.printerId)
  const bed = { x: printer.bed.x - BED_MARGIN * 2, y: printer.bed.y - BED_MARGIN * 2, z: printer.bed.z }
  const fitsBed = (a: number, b: number, h: number) => h <= bed.z && ((a <= bed.x && b <= bed.y) || (a <= bed.y && b <= bed.x))

  const H = { tray: p.trayHeight, lid: p.lidHeight }

  // ── primitives ──
  const rrect = (w: number, h: number, r: number): CrossSection => {
    const rr = Math.max(0, Math.min(r, w / 2 - 0.05, h / 2 - 0.05))
    if (rr < 0.05) return s.keep(CS.square([w, h], true))
    const core = s.keep(CS.square([w - 2 * rr, h - 2 * rr], true))
    return s.keep(core.offset(rr, 'Round'))
  }

  const shapeCS = (shape: Shape): CrossSection | null => {
    switch (shape.kind) {
      case 'rect':
        return rrect(shape.w, shape.h, shape.r ?? 0)
      case 'circle':
        return s.keep(CS.circle(shape.d / 2, 48))
      case 'slot': {
        const r = Math.min(shape.w, shape.h) / 2
        const len = Math.max(shape.w, shape.h) - 2 * r
        const a = s.keep(CS.circle(r, 32))
        const horiz = shape.w >= shape.h
        const off: Vec2 = horiz ? [len / 2, 0] : [0, len / 2]
        const c1 = s.keep(a.translate(off))
        const c2 = s.keep(a.translate([-off[0], -off[1]]))
        return s.keep(CS.hull([c1, c2]))
      }
      case 'polygon':
        return s.keep(CS.ofPolygons([shape.points as Vec2[]]))
      case 'text': {
        const contours = textContours(shape.text, shape.size, shape.font ?? 'mono')
        if (!contours) {
          issues.push({ severity: 'info', message: fontsReady(shape.font ?? 'mono') ? `Text “${shape.text}” has no printable glyphs.` : 'Fonts are still loading; text labels appear on the next rebuild.' })
          return null
        }
        return s.keep(CS.ofPolygons(contours as Vec2[][], 'NonZero'))
      }
    }
  }

  const extrudeZ = (cs: CrossSection, z0: number, z1: number): Manifold =>
    s.keep(s.keep(cs.extrude(z1 - z0)).translate([0, 0, z0]))

  const cylZ = (r: number, z0: number, z1: number, x = 0, y = 0): Manifold =>
    s.keep(s.keep(M.cylinder(z1 - z0, r, r, 0)).translate([x, y, z0]))

  const box = (min: V3, max: V3): Manifold =>
    s.keep(s.keep(M.cube([max[0] - min[0], max[1] - min[1], max[2] - min[2]])).translate(min))

  const inFrame = (m: Manifold, f: Frame, du = 0, dv = 0): Manifold =>
    s.keep(m.transform(frameMatrix(f, du, dv) as unknown as Mat4))

  const union = (ms: Manifold[]): Manifold | null => (ms.length ? s.keep(M.union(ms)) : null)

  const bodies: Record<PartId, PartBodies> = {
    tray: { add: [], cut: [], pocket: [], colored: [] },
    lid: { add: [], cut: [], pocket: [], colored: [] },
  }

  // ── 1. shells ──
  // Chamfered corners are an octagon; insetting a 45° chamfer by t shrinks it by t·tan(22.5°).
  const chamfer = p.cornerStyle === 'chamfer'
  const outline = (w: number, d: number, r: number): CrossSection => {
    if (!chamfer) return rrect(w, d, r)
    const c = Math.max(0, Math.min(r, w / 2 - 0.5, d / 2 - 0.5))
    const pts: Vec2[] = [
      [-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c],
      [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c],
    ]
    return s.keep(CS.ofPolygons([pts]))
  }
  const insetR = (r: number, t: number) => Math.max(0.5, chamfer ? r - t * 0.414 : r - t)
  const ri = insetR(p.cornerRadius, p.wall)
  const maxBevel = Math.max(0, p.wall + p.floor - 1.4)
  const bevel = Math.min(p.bevel, maxBevel, H.lid - p.floor - 1, H.tray - p.floor - 1)
  if (p.bevel > bevel + 0.01)
    issues.push({ severity: 'low', message: `Bevel limited to ${bevel.toFixed(1)} mm so the wall stays at least 1.4 mm thick (wall + floor − 1.4).` })
  /** Solid of the outline from z0 to z1, with a 45° bevel at the bottom or the top. */
  const bevelled = (z0: number, z1: number, at: 'bottom' | 'top'): Manifold => {
    if (bevel < 0.2) return extrudeZ(outline(p.width, p.depth, p.cornerRadius), z0, z1)
    const full = outline(p.width, p.depth, p.cornerRadius)
    const small = outline(p.width - 2 * bevel, p.depth - 2 * bevel, insetR(p.cornerRadius, bevel))
    const thin = 0.01
    if (at === 'bottom') {
      const ramp = s.keep(M.hull([extrudeZ(small, z0, z0 + thin), extrudeZ(full, z0 + bevel - thin, z0 + bevel)]))
      return s.keep(ramp.add(extrudeZ(full, z0 + bevel - thin, z1)))
    }
    const ramp = s.keep(M.hull([extrudeZ(full, z1 - bevel, z1 - bevel + thin), extrudeZ(small, z1 - thin, z1)]))
    return s.keep(ramp.add(extrudeZ(full, z0, z1 - bevel + thin)))
  }
  {
    bodies.tray.add.push(bevelled(0, H.tray, 'bottom'))
    bodies.tray.cut.push(extrudeZ(outline(p.width - 2 * p.wall, p.depth - 2 * p.wall, ri), p.floor, H.tray + 1))
  }
  {
    bodies.lid.add.push(bevelled(0, H.lid, 'top'))
    bodies.lid.cut.push(extrudeZ(outline(p.width - 2 * p.wall, p.depth - 2 * p.wall, ri), -1, H.lid - p.floor))
  }

  // ── 2. closure ──
  // Screws: inserts in the tray rim, counterbored screws through the lid.
  // Magnets: Ø6 × 3 mm discs pressed into matching pockets in both bosses.
  // With a hinge, only the front positions are used — the hinge holds the back.
  const hardware: HardwareUse = { magnets: 0, hingePin: null }
  {
    const spec = INSERTS[p.closureInsert]
    const magnet = { d: 6.2, h: 3.2 }
    const br = p.closure === 'magnets' ? Math.max(spec.bossD, magnet.d + 3) / 2 : spec.bossD / 2
    let pts = closurePoints(p.width, p.depth, p.wall, p.cornerRadius * (chamfer ? 0.6 : 1), br, p.closureScrews)
    if (p.hinge) pts = pts.filter(([, y]) => y < 0)
    const clamp = Math.min(H.lid, 5)
    for (const [x, y] of pts) {
      bodies.tray.add.push(cylZ(br, p.floor - 0.1, H.tray, x, y))
      bodies.lid.add.push(cylZ(br, 0, H.lid - p.floor + 0.1, x, y))
      if (p.closure === 'magnets') {
        bodies.tray.cut.push(cylZ(magnet.d / 2, H.tray - magnet.h, H.tray + 1, x, y))
        bodies.lid.cut.push(cylZ(magnet.d / 2, -1, magnet.h, x, y))
        hardware.magnets += 2
      } else {
        bodies.tray.cut.push(cylZ(spec.holeD / 2, H.tray - spec.holeDepth, H.tray + 1, x, y))
        bodies.lid.cut.push(cylZ(spec.clearanceD / 2, -1, H.lid + 1, x, y))
        if (H.lid > clamp + 0.5) bodies.lid.cut.push(cylZ(spec.headD / 2, clamp, H.lid + 1, x, y))
        fasteners.push({ size: spec.size, screwLength: screwLength(clamp, spec), purpose: 'closure' })
      }
    }
    if (p.closure === 'screws' && H.tray < spec.holeDepth + p.floor + 1)
      issues.push({ severity: 'high', message: `Tray height ${H.tray} mm is too low for ${spec.size} closure inserts (${spec.holeDepth} mm deep).` })
  }

  // ── 2b. hinge: alternating knuckles on a Ø3 mm pin along the back edge ──
  if (p.hinge) {
    const rk = 5
    const gap = 0.5
    const yh = p.depth / 2 + 0.5
    const margin = Math.max(p.cornerRadius, 8) + 6
    const span = p.width - 2 * margin
    const n = span > 200 ? 7 : 5
    const seg = (span - (n - 1) * gap) / n
    // Cylinder along X: rotate a Z cylinder by 90° about Y, z → +x.
    const knuckle = (r: number, x0: number, x1: number, z: number) => s.keep(s.keep(s.keep(M.cylinder(x1 - x0, r, r, 0)).rotate([0, 90, 0])).translate([x0, yh, z]))
    for (let k = 0; k < n; k++) {
      const x0 = -span / 2 + k * (seg + gap)
      const x1 = x0 + seg
      if (k % 2 === 0) {
        // Tray knuckle, centred on the seam; clear the lid around it.
        bodies.tray.add.push(knuckle(rk, x0, x1, H.tray), box([x0, p.depth / 2 - p.wall, H.tray - rk], [x1, yh, H.tray]))
        bodies.lid.cut.push(knuckle(rk + gap, x0 - gap, x1 + gap, 0))
      } else {
        bodies.lid.add.push(knuckle(rk, x0, x1, 0), box([x0, p.depth / 2 - p.wall, 0], [x1, yh, rk]))
        bodies.tray.cut.push(knuckle(rk + gap, x0 - gap, x1 + gap, H.tray))
      }
    }
    bodies.tray.cut.push(knuckle(1.6, -span / 2 - 1, span / 2 + 1, H.tray))
    bodies.lid.cut.push(knuckle(1.6, -span / 2 - 1, span / 2 + 1, 0))
    hardware.hingePin = { count: 1, length: Math.floor(span) }
    if (H.tray < rk + p.floor + 2) issues.push({ severity: 'high', message: `Tray height ${H.tray} mm is too low for the hinge knuckles.` })
  }

  // ── 3. placements: standoffs and windows ──
  const carriedIds = carriedPlacementIds(build)
  for (const pl of build.placements) {
    const c = componentById(pl.componentId)
    if (!c || carriedIds.has(pl.id)) continue
    const part = pl.part
    const hS = standoffHeight(c, pl)

    // Standoffs (flat boards only)
    if (pl.standoffs && c.mounting && isFlat(pl)) {
      const spec = INSERTS[c.mounting.insert]
      for (const [hx, hy] of c.mounting.holes) {
        const [rx, ry] = rotate2(hx, hy, pl.rotation)
        const x = pl.x + rx
        const y = pl.y + ry
        if (hS >= 3) {
          const depth = Math.min(spec.holeDepth, hS + p.floor - 0.8)
          if (part === 'tray') {
            bodies.tray.add.push(cylZ(spec.bossD / 2, p.floor - 0.1, p.floor + hS, x, y))
            bodies.tray.cut.push(cylZ(spec.holeD / 2, p.floor + hS - depth, p.floor + hS + 1, x, y))
          } else {
            const ceil = H.lid - p.floor
            bodies.lid.add.push(cylZ(spec.bossD / 2, ceil - hS, ceil + 0.1, x, y))
            bodies.lid.cut.push(cylZ(spec.holeD / 2, ceil - hS - 1, ceil - hS + depth, x, y))
          }
          if (depth < spec.length)
            issues.push({ severity: 'medium', message: `${c.name}: standoff too short for a full ${spec.size} insert (${depth.toFixed(1)} of ${spec.length} mm).` })
          fasteners.push({ size: spec.size, screwLength: screwLength(1.6, spec), purpose: 'standoff' })
        } else {
          // Too short for an insert: clearance hole through the plate, screw from outside.
          const z0 = part === 'tray' ? -1 : H.lid - p.floor - 1
          const z1 = part === 'tray' ? p.floor + 1 : H.lid + 1
          bodies[part].cut.push(cylZ(spec.clearanceD / 2, z0, z1, x, y))
          fasteners.push({ size: spec.size, screwLength: screwLength(p.floor + 1.6, spec), purpose: 'standoff' })
        }
      }
    }

    // Windows: resolved onto the case face the component's window points at.
    if (pl.window && c.windows) {
      for (const w of placedWindows(build, c, pl)) {
        const f = faceFrame(p, w.part, w.face)
        bodies[w.part].cut.push(inFrame(extrudeZ(rrect(w.w, w.h, w.r), -f.thickness - 2, 1), f, w.u, w.v))
        if (w.face !== 'top' && w.gap > 3)
          issues.push({ severity: 'low', message: `${pl.label ?? c.name}: ${w.face} window is ${w.gap.toFixed(0)} mm away from the wall. Move the component against it.` })
      }
    }
    if (pl.standoffs && c.mounting && !isFlat(pl))
      issues.push({ severity: 'info', message: `${pl.label ?? c.name} is tilted, so it gets no standoffs. Mount it with a bracket or a boss feature.` })
  }

  // ── 4. user features ──
  const insertMount = (part: PartId, f: Frame, u: number, v: number, spec: InsertSpec, purpose: FastenerUse['purpose'], clamp: number) => {
    const extra = Math.max(0, spec.holeDepth + 1.2 - f.thickness)
    if (extra > 0) {
      const boss = cylZ(spec.bossD / 2, -f.thickness - extra, -f.thickness + 0.2)
      bodies[part].add.push(inFrame(boss, f, u, v))
    }
    bodies[part].cut.push(inFrame(cylZ(spec.holeD / 2, -spec.holeDepth, 1), f, u, v))
    fasteners.push({ size: spec.size, screwLength: screwLength(clamp, spec), purpose })
  }

  for (const feat of build.features) {
    if (!feat.enabled) continue
    applyFeature(feat)
  }

  function applyFeature(feat: Feature) {
    const part = feat.part
    const f = faceFrame(p, part, feat.face)
    const partColor = colors[part]
    const pat = feat.pattern ?? { nu: 1, nv: 1, du: 0, dv: 0 }
    const sketch = shapeCS(feat.shape)
    if (!sketch) return
    let base = sketch
    if (feat.rotation) base = s.keep(base.rotate(feat.rotation))
    for (let i = 0; i < pat.nu; i++) {
      for (let j = 0; j < pat.nv; j++) {
        const u = feat.u + (i - (pat.nu - 1) / 2) * pat.du
        const v = feat.v + (j - (pat.nv - 1) / 2) * pat.dv
        switch (feat.op) {
          case 'extrude': {
            const depth = Math.max(0.2, feat.depth || 2)
            const color = feat.color ?? partColor
            if (color === partColor) {
              bodies[part].add.push(inFrame(extrudeZ(base, -0.2, depth), f, u, v))
            } else {
              bodies[part].colored.push({ color, m: inFrame(extrudeZ(base, 0, depth), f, u, v) })
            }
            break
          }
          case 'cut': {
            const depth = feat.depth > 0 ? feat.depth : f.thickness + 0.5
            bodies[part].cut.push(inFrame(extrudeZ(base, -depth, 1), f, u, v))
            break
          }
          case 'inlay': {
            const depth = feat.depth > 0 ? Math.min(feat.depth, f.thickness - 0.4) : 0.6
            bodies[part].pocket.push(inFrame(extrudeZ(base, -depth, 1), f, u, v))
            bodies[part].colored.push({ color: feat.color ?? colors.accessories, m: inFrame(extrudeZ(base, -depth, 0), f, u, v) })
            break
          }
          case 'boss': {
            const depth = Math.max(0.4, feat.depth || 5)
            bodies[part].add.push(inFrame(extrudeZ(base, -f.thickness - depth, -f.thickness + 0.2), f, u, v))
            break
          }
        }
      }
    }
  }

  // ── 5. accessories ──
  const accessoryPieces: { id: string; acc: Accessory; m: Manifold; frame: Frame; name: string; slide?: V3; travel?: number }[] = []
  const carried: CarriedDisplay[] = []
  for (const acc of build.accessories) {
    const f = faceFrame(p, acc.kind === 'slider' ? 'lid' : acc.part, acc.kind === 'slider' ? 'top' : acc.face)
    const spec = INSERTS.M3
    const rot = acc.rotation
    const place = (x: number, y: number): [number, number] => rotate2(x, y, rot)

    if (acc.kind === 'slider') {
      buildSlider(acc, f)
      continue
    }

    if (acc.kind === 'deckport') {
      const win = SOCKET.connectorWindow
      const winCS = rrect(rot === 90 ? win.h : win.w, rot === 90 ? win.w : win.h, 0.5)
      if (!isModule) {
        // Core socket: alignment recess, connector window, four inserts.
        const rec = SOCKET.recess
        const recCS = rrect(rot === 90 ? rec.h : rec.w, rot === 90 ? rec.w : rec.h, 1)
        bodies[acc.part].cut.push(inFrame(extrudeZ(recCS, -rec.depth, 1), f, acc.u, acc.v))
        bodies[acc.part].cut.push(inFrame(extrudeZ(winCS, -f.thickness - 2, 1), f, acc.u, acc.v))
        for (const [hx, hy] of SOCKET.holes) {
          const [x, y] = place(hx, hy)
          insertMount(acc.part, f, acc.u + x, acc.v + y, INSERTS[SOCKET.insert], 'deckport', p.wall)
        }
      } else {
        // Module plug: raised key that sits in the Core recess, window, clearance holes.
        const rec = SOCKET.recess
        const keyCS = rrect((rot === 90 ? rec.h : rec.w) - 0.4, (rot === 90 ? rec.w : rec.h) - 0.4, 1)
        bodies[acc.part].add.push(inFrame(extrudeZ(keyCS, -0.2, rec.depth - 0.2), f, acc.u, acc.v))
        bodies[acc.part].cut.push(inFrame(extrudeZ(winCS, -f.thickness - 2, rec.depth + 1), f, acc.u, acc.v))
        for (const [hx, hy] of SOCKET.holes) {
          const [x, y] = place(hx, hy)
          bodies[acc.part].cut.push(inFrame(cylZ(INSERTS.M3.clearanceD / 2, -f.thickness - 1, rec.depth + 1), f, acc.u + x, acc.v + y))
          fasteners.push({ size: 'M3', screwLength: screwLength(p.wall + rec.depth, INSERTS.M3), purpose: 'deckport' })
        }
      }
      continue
    }

    let local: Manifold
    let holes: [number, number][] = []
    let clamp = 4
    let name = ''

    if (acc.kind === 'picatinny') {
      name = `Picatinny rail ${acc.length} mm`
      const L = acc.length
      const profile: Vec2[] = [
        [-10.6, 0], [10.6, 0], [10.6, 2], [7.83, 2], [7.83, 3.85], [10.6, 6.62], [7.83, 9.39],
        [-7.83, 9.39], [-10.6, 6.62], [-7.83, 3.85], [-7.83, 2], [-10.6, 2],
      ]
      const cs = s.keep(CS.ofPolygons([profile]))
      const ext = s.keep(cs.extrude(L))
      // CS x → v, CS y → n, extrusion z → u.
      let rail = s.keep(ext.transform([0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, -L / 2, 0, 0, 1] as unknown as Mat4))
      const pitch = 10.01
      const nSlots = Math.max(1, Math.floor((L - 4) / pitch))
      const slots: Manifold[] = []
      for (let k = 0; k < nSlots; k++) {
        const cu = (k - (nSlots - 1) / 2) * pitch
        slots.push(box([cu - 5.23 / 2, -12, 6.39], [cu + 5.23 / 2, 12, 11]))
      }
      rail = s.keep(rail.subtract(union(slots)!))
      // Holes on lands (between slots), near both ends and the middle.
      const lands = Array.from({ length: nSlots - 1 }, (_, k) => (k - (nSlots - 2) / 2) * pitch)
      const wanted = L >= 120 ? [-(L / 2 - 10), 0, L / 2 - 10] : [-(L / 2 - 10), L / 2 - 10]
      const chosen = new Set<number>()
      for (const w of wanted) {
        const best = lands.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), lands[0] ?? 0)
        chosen.add(Math.round(best * 100) / 100)
      }
      holes = [...chosen].map(u => [u, 0])
      clamp = 3
      const hc = holes.map(([u, v]) => cylZ(spec.clearanceD / 2, -1, 11, u, v))
      const hb = holes.map(([u, v]) => cylZ(spec.headD / 2, clamp, 11, u, v))
      local = s.keep(rail.subtract(union([...hc, ...hb])!))
    } else if (acc.kind === 'handle') {
      name = `Handle ${acc.length} mm`
      const L = Math.max(80, acc.length)
      const Hh = 32
      const top = s.keep(rrect(L, Hh, 6).translate([0, Hh / 2]))
      const bottom = s.keep(s.keep(CS.square([L, Hh / 2])).translate([-L / 2, 0]))
      const opening = s.keep(rrect(L - 40, (Hh - 14) * 2, 4))
      const outline = s.keep(s.keep(top.add(bottom)).subtract(opening))
      const ext = s.keep(outline.extrude(20))
      // CS x → u, CS y → n, extrusion z → -v (kept right-handed), centred on v.
      const h = s.keep(ext.transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 10, 0, 1] as unknown as Mat4))
      holes = [
        [-(L / 2 - 10), -5], [-(L / 2 - 10), 5],
        [L / 2 - 10, -5], [L / 2 - 10, 5],
      ]
      clamp = 6
      const hc = holes.map(([u, v]) => cylZ(spec.clearanceD / 2, -1, Hh + 1, u, v))
      const hb = holes.map(([u, v]) => cylZ(spec.headD / 2, clamp, Hh + 1, u, v))
      local = s.keep(h.subtract(union([...hc, ...hb])!))
    } else {
      name = 'Foot'
      const foot = cylZ(9, 0, 5)
      holes = [[0, 0]]
      clamp = 2.5
      local = s.keep(foot.subtract(union([cylZ(spec.clearanceD / 2, -1, 6), cylZ(spec.headD / 2, clamp, 6)])!))
    }

    if (rot === 90) local = s.keep(local.rotate([0, 0, 90]))
    for (const [hx, hy] of holes) {
      const [x, y] = place(hx, hy)
      insertMount(acc.part, f, acc.u + x, acc.v + y, spec, 'accessory', clamp)
    }
    accessoryPieces.push({ id: `acc-${acc.id}`, acc, m: local, frame: f, name })
  }

  // ── 6. assemble each part, then fit it to the bed ──

  for (const part of ['tray', 'lid'] as PartId[]) {
    const pb = bodies[part]
    const partH = H[part]
    const splitWanted = build.print.autoSplit && !fitsBed(p.width, p.depth, partH)
    let grid = { nx: 1, ny: 1 }
    if (splitWanted) {
      const g = chooseGrid(p.width, p.depth, partH, fitsBed)
      if (g) grid = g
      else issues.push({ severity: 'critical', message: `${cap(part)} cannot be split to fit the ${printer.name} bed.` })
    }

    // Joint blocks across each cut, before the boolean so they fuse with the shell.
    const jSpec = INSERTS[build.print.jointInsert]
    const cutsX = Array.from({ length: grid.nx - 1 }, (_, k) => -p.width / 2 + ((k + 1) * p.width) / grid.nx)
    const cutsY = Array.from({ length: grid.ny - 1 }, (_, k) => -p.depth / 2 + ((k + 1) * p.depth) / grid.ny)
    const jointCuts: Manifold[] = []
    // Component envelopes in this part's local frame.
    const occupied: AABB[] = build.placements.flatMap(pl => {
      const comp = componentById(pl.componentId)
      if (!comp) return []
      const b = placementBox(build, comp, pl)
      const dz = partOffsetZ(p, part)
      return [{ min: [b.min[0], b.min[1], b.min[2] - dz], max: [b.max[0], b.max[1], b.max[2] - dz] } as AABB]
    })
    const addJoints = (axis: 'x' | 'y', c: number) => {
      const span = axis === 'x' ? p.depth : p.width
      const blockH = Math.min(12, partH - p.floor - 1)
      if (blockH < jSpec.bossD) {
        issues.push({ severity: 'high', message: `${cap(part)} is too shallow for ${jSpec.size} split joints. Increase its height or use a smaller joint insert.` })
        return
      }
      // Candidate spots: against both walls, then along the floor / ceiling.
      // Spots that would collide with a component are skipped, so a keyboard
      // spanning the cut does not end up sitting on a joint block.
      const wallT = span / 2 - p.wall - 6 + 0.5
      const zWall = part === 'tray' ? Math.max(p.floor, partH / 2 - blockH / 2) : partH - p.floor - blockH
      const zPlate = part === 'tray' ? p.floor - 0.1 : partH - p.floor - 10
      const perpendicular = axis === 'x' ? cutsY : cutsX
      const blockBox = (t: number, z0: number, h: number): AABB => ({
        min: axis === 'x' ? [c - 5, t - 6, z0] : [t - 6, c - 5, z0],
        max: axis === 'x' ? [c + 8, t + 6, z0 + h] : [t + 6, c + 8, z0 + h],
      })
      const free = (t: number, z0: number, h: number) => {
        if (perpendicular.some(q => Math.abs(q - t) < 10)) return false
        const b = blockBox(t, z0, h)
        return !occupied.some(o => aabbOverlap(o, b))
      }
      const across: { t: number; z0: number; h: number }[] = []
      for (const t of [wallT, -wallT]) if (free(t, zWall, blockH)) across.push({ t, z0: zWall, h: blockH })
      const wanted = Math.max(2, Math.floor((span - 2 * p.wall) / 70) + 1)
      const plateH = Math.min(10, blockH)
      const step = 10
      const limit = span / 2 - p.wall - 14
      const candidates: number[] = []
      for (let t = 0; t <= limit; t += step) candidates.push(t, -t)
      for (const t of candidates) {
        if (across.length >= wanted) break
        if (across.some(a => Math.abs(a.t - t) < 40)) continue
        if (free(t, zPlate, plateH)) across.push({ t, z0: zPlate, h: plateH })
      }
      if (across.length < 2) {
        issues.push({ severity: 'medium', message: `Few free spots for joints across the ${cap(part).toLowerCase()} cut at ${axis} = ${Math.round(c)} mm; joint blocks overlap components.` })
        for (const t of [wallT, -wallT]) if (!across.some(a => a.t === t)) across.push({ t, z0: zWall, h: blockH })
      }
      for (const { t, z0, h } of across) {
        const zc = z0 + h / 2
        const { min, max } = blockBox(t, z0, h)
        pb.add.push(box(min, max))
        jointBoxes.push({ min: [min[0], min[1], min[2] + partOffsetZ(p, part)], max: [max[0], max[1], max[2] + partOffsetZ(p, part)] })
        // Insert in the + side from the cut face, clearance through the − side.
        const ins = cylZ(jSpec.holeD / 2, 0, jSpec.holeDepth)
        const clr = cylZ(jSpec.clearanceD / 2, -6, 0.01)
        const orient = axis === 'x' ? [0, 90, 0] : [-90, 0, 0]
        const pos: V3 = axis === 'x' ? [c, t, zc] : [t, c, zc]
        for (const tool of [ins, clr]) jointCuts.push(s.keep(s.keep(tool.rotate(orient as V3)).translate(pos)))
        fasteners.push({ size: jSpec.size, screwLength: screwLength(5, jSpec), purpose: 'split-joint' })
      }
    }
    cutsX.forEach(c => addJoints('x', c))
    cutsY.forEach(c => addJoints('y', c))

    const added = union(pb.add)!
    const removed = union([...pb.cut, ...pb.pocket, ...jointCuts])
    const main = removed ? s.keep(added.subtract(removed)) : added
    const generalCut = union([...pb.cut, ...jointCuts])
    const colored = pb.colored.map(({ color, m }) => ({ color, m: generalCut ? s.keep(m.subtract(generalCut)) : m }))

    const xs = [-Infinity, ...cutsX, Infinity]
    const ys = [-Infinity, ...cutsY, Infinity]
    const offset = partOffsetZ(p, part)
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const trim = (m: Manifold) => {
          let r = m
          if (isFinite(xs[i])) r = s.keep(r.trimByPlane([1, 0, 0], xs[i]))
          if (isFinite(xs[i + 1])) r = s.keep(r.trimByPlane([-1, 0, 0], -xs[i + 1]))
          if (isFinite(ys[j])) r = s.keep(r.trimByPlane([0, 1, 0], ys[j]))
          if (isFinite(ys[j + 1])) r = s.keep(r.trimByPlane([0, -1, 0], -ys[j + 1]))
          return r
        }
        const all = [{ color: colors[part], m: trim(main) }, ...colored.map(b => ({ color: b.color, m: trim(b.m) }))].filter(b => !b.m.isEmpty())
        if (!all.length) continue
        const split = grid.nx * grid.ny > 1
        const label = split ? ` ${String.fromCharCode(65 + i)}${j + 1}` : ''
        const size = boundsSize(all.map(b => b.m))
        pieces.push({
          id: `${part}${split ? `-${i}-${j}` : ''}`,
          name: `${cap(part)}${label}`,
          group: part,
          bodies: all.map(b => toBody(b.m, b.color)),
          assembly: translation(0, 0, offset),
          explode: part === 'lid' ? [0, 0, 1] : [0, 0, 0],
          printFlip: part === 'lid',
          size,
          fitsBed: fitsBed(size[0], size[1], size[2]),
          attachedTo: part === 'lid' ? 'lid' : null,
        })
      }
    }
    if (grid.nx * grid.ny > 1)
      issues.push({ severity: 'info', message: `${cap(part)} split into ${grid.nx * grid.ny} pieces for the ${printer.name} bed, joined with ${jSpec.size} inserts.` })
  }

  for (const { id, acc, m, frame, name, slide, travel } of accessoryPieces) {
    const size = boundsSize([m])
    const part: PartId = acc.kind === 'slider' ? 'lid' : acc.part
    pieces.push({
      id,
      name,
      group: 'accessory',
      bodies: [toBody(m, acc.color ?? colors.accessories)],
      assembly: mul(translation(0, 0, partOffsetZ(p, part)), frameMatrix(frame, acc.u, acc.v)),
      explode: frame.n,
      printFlip: false,
      size,
      fitsBed: fitsBed(size[0], size[1], size[2]),
      attachedTo: part,
      slide: slide && travel ? { axis: slide, travel } : undefined,
    })
  }

  s.dispose()
  return { pieces, fasteners, jointBoxes, carried, hardware, issues, durationMs: performance.now() - t0 }

  /**
   * Screen slider: two dovetail rails bolted to the lid top, a carriage that
   * holds the display and slides on them, and a bezel screwed onto the
   * carriage. Built in the lid-top frame (x = u, y = v, z out of the lid),
   * then turned 90° for a slider that runs along u.
   */
  function buildSlider(acc: Accessory, f: Frame) {
    const g = sliderGeometry(build, acc)
    const S = SLIDER
    const rot = acc.rotation
    const turn = (m: Manifold) => (rot === 90 ? s.keep(m.rotate([0, 0, 90])) : m)
    const lift = 0.6
    const ins = INSERTS['M2.5']
    // Rails run exactly under the carriage's travel; the stops sit just beyond them.
    const r0 = -g.CL / 2
    const r1 = g.CL / 2 + g.travel
    const RL = r1 - r0
    const trimX = (m: Manifold, x0: number, x1: number) => {
      let r = m
      if (isFinite(x0)) r = s.keep(r.trimByPlane([1, 0, 0], x0))
      if (isFinite(x1)) r = s.keep(r.trimByPlane([-1, 0, 0], -x1))
      return r
    }
    const smallestSplit = (fit: (n: number) => boolean) => {
      for (let n = 1; n <= 6; n++) if (fit(n)) return n
      return 6
    }

    // ── rails: dovetail bars, split into segments that each have their own screws ──
    // CS x → x, CS y → z, extrusion → −y (kept right-handed), shifted to y1.
    const alongY = (cs: CrossSection, y0: number, y1: number) =>
      s.keep(s.keep(cs.extrude(y1 - y0)).transform([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, y1, 0, 1] as unknown as Mat4))
    const railCS = s.keep(CS.ofPolygons([[[-S.railBottom / 2, 0], [S.railBottom / 2, 0], [S.railTop / 2, S.railH], [-S.railTop / 2, S.railH]] as Vec2[]]))
    const nR = smallestSplit(n => fitsBed(RL / n, S.railTop, S.railH))
    const segL = RL / nR
    for (const side of [-1, 1]) {
      const x = side * g.railX
      for (let k = 0; k < nR; k++) {
        const a = r0 + k * segL
        const b = a + segL
        const ys = segL > 120 ? [a + 8, (a + b) / 2, b - 8] : [a + 8, b - 8]
        let rail = alongY(railCS, a, b - 0.2)
        const holes = ys.flatMap(y => [cylZ(spec3.clearanceD / 2, -1, S.railH + 1, 0, y), cylZ(spec3.headD / 2, 1.4, S.railH + 1, 0, y)])
        rail = s.keep(s.keep(rail.subtract(union(holes)!)).translate([x, 0, 0]))
        const label = nR > 1 ? ` ${k + 1}/${nR}` : ''
        accessoryPieces.push({ id: `acc-${acc.id}-rail-${side < 0 ? 'l' : 'r'}-${k}`, acc, m: turn(rail), frame: f, name: `Slider rail ${side < 0 ? 'left' : 'right'}${label}` })
        for (const y of ys) {
          const [hx, hy] = rotate2(x, y, rot)
          insertMountLid(f, acc.u + hx, acc.v + hy, 1.4)
        }
      }
      // End stops: screwed on after the carriage has been slid onto the rails.
      for (const [y0, y1, end] of [[r0 - S.endStop, r0, 'front'], [r1, r1 + S.endStop, 'back']] as [number, number, string][]) {
        const yc = (y0 + y1) / 2
        let stop = box([-S.railTop / 2, y0, 0], [S.railTop / 2, y1, S.railH + 4])
        stop = s.keep(stop.subtract(union([cylZ(spec3.clearanceD / 2, -1, S.railH + 5, 0, yc), cylZ(spec3.headD / 2, 3, S.railH + 5, 0, yc)])!))
        accessoryPieces.push({ id: `acc-${acc.id}-stop-${side}-${end}`, acc, m: turn(s.keep(stop.translate([x, 0, 0]))), frame: f, name: `Slider end stop, ${end} ${side < 0 ? 'left' : 'right'}` })
        const [hx, hy] = rotate2(x, yc, rot)
        insertMountLid(f, acc.u + hx, acc.v + hy, 3)
      }
    }
    if (g.travel < 12) issues.push({ severity: 'medium', message: 'Slider travel under 12 mm is barely a slide. Increase the travel.' })

    // ── carriage and bezel, split with staggered seams ──
    // The bezel bridges every carriage seam and the carriage bridges every bezel
    // seam; screws into inserts on both sides of each seam lock the stack together.
    const nC = smallestSplit(n => fitsBed(g.CW / n + 8, g.CL + 7, g.CH + lift))
    const carriageCuts = Array.from({ length: nC - 1 }, (_, k) => -g.CW / 2 + ((k + 1) * g.CW) / nC)
    const bezelCuts = nC > 1 ? Array.from({ length: nC }, (_, k) => -g.CW / 2 + ((k + 0.5) * g.CW) / nC) : []
    const yw = g.CL / 2 - S.wall / 2
    const screwPts: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * (g.CW / 2 - S.wall / 2), b * yw])
    for (const x0 of [...carriageCuts, ...bezelCuts]) for (const dx of [-8, 8]) for (const sy of [-1, 1]) screwPts.push([x0 + dx, sy * yw])

    let carriage = extrudeZ(rrect(g.CW, g.CL, 4), 0, g.CH)
    carriage = s.keep(carriage.add(box([-20, -g.CL / 2 - 6, 0], [20, -g.CL / 2 + 1, Math.min(g.CH, 12)])))
    const cuts: Manifold[] = [extrudeZ(rrect(g.pocketW, g.pocketL, 1), S.base, g.CH + 1)]
    // Channels: rail profile plus lateral clearance; the ceiling rests on the rail top.
    const c = S.clearance
    const channel = s.keep(CS.ofPolygons([[[-S.railBottom / 2 - c, -1], [S.railBottom / 2 + c, -1], [S.railTop / 2 + c, S.railH - lift], [-S.railTop / 2 - c, S.railH - lift]] as Vec2[]]))
    for (const side of [-1, 1]) cuts.push(s.keep(alongY(channel, -g.CL / 2 - 8, g.CL / 2 + 8).translate([side * g.railX, 0, 0])))
    const cableY = g.CL / 2 - S.wall - 12
    if (g.disp) cuts.push(box([-13, cableY - 5, -1], [13, cableY + 5, S.base + 1]))
    for (const [x, y] of screwPts) cuts.push(cylZ(ins.holeD / 2, g.CH - ins.holeDepth, g.CH + 1, x, y))
    carriage = s.keep(s.keep(carriage.subtract(union(cuts)!)).translate([0, 0, lift]))

    const axisLocal: V3 = rot === 90 ? [-1, 0, 0] : [0, 1, 0]
    const axis: V3 = [
      axisLocal[0] * f.u[0] + axisLocal[1] * f.v[0],
      axisLocal[0] * f.u[1] + axisLocal[1] * f.v[1],
      axisLocal[0] * f.u[2] + axisLocal[1] * f.v[2],
    ]
    const cx = [-Infinity, ...carriageCuts, Infinity]
    for (let k = 0; k < cx.length - 1; k++) {
      const label = nC > 1 ? ` ${String.fromCharCode(65 + k)}` : ''
      accessoryPieces.push({ id: `acc-${acc.id}-carriage-${k}`, acc, m: turn(trimX(carriage, cx[k], cx[k + 1])), frame: f, name: `Screen carriage${label}`, slide: axis, travel: g.travel })
    }

    let bezel = extrudeZ(rrect(g.CW, g.CL, 4), g.CH + lift, g.CH + lift + S.bezel)
    const w = g.disp?.windows?.find(x => x.face === 'top')
    const swap = g.target ? g.target.rotation % 180 !== 0 : false
    const ww = w ? (swap ? w.h : w.w) : g.pocketW - 8
    const wh = w ? (swap ? w.w : w.h) : g.pocketL - 8
    const bz: Manifold[] = [extrudeZ(rrect(ww, wh, 1.5), g.CH, g.CH + S.bezel + 2)]
    for (const [x, y] of screwPts) bz.push(cylZ(ins.clearanceD / 2, g.CH, g.CH + S.bezel + 2, x, y))
    bezel = s.keep(bezel.subtract(union(bz)!))
    const bx = [-Infinity, ...bezelCuts, Infinity]
    for (let k = 0; k < bx.length - 1; k++) {
      const label = bezelCuts.length ? ` ${k + 1}` : ''
      accessoryPieces.push({ id: `acc-${acc.id}-bezel-${k}`, acc, m: turn(trimX(bezel, bx[k], bx[k + 1])), frame: f, name: `Screen bezel${label}`, slide: axis, travel: g.travel })
    }
    for (let k = 0; k < screwPts.length; k++) fasteners.push({ size: 'M2.5', screwLength: screwLength(S.bezel, ins), purpose: 'accessory' })
    if (nC > 1) issues.push({ severity: 'info', message: `Screen carriage split into ${nC} and bezel into ${nC + 1} pieces with staggered seams, screwed together through the bezel.` })

    // Cable slot through the lid, as long as the travel.
    if (g.disp) {
      const [sx, sy] = rotate2(0, cableY + g.travel / 2, rot)
      const slot = rot === 90 ? rrect(g.travel + 16, 30, 3) : rrect(30, g.travel + 16, 3)
      bodies.lid.cut.push(inFrame(extrudeZ(slot, -f.thickness - 1, 1), f, acc.u + sx, acc.v + sy))
      carried.push({
        placementId: g.target!.id,
        centre: [acc.u, acc.v, p.trayHeight + p.lidHeight + lift + S.base + g.dispZ / 2],
        size: rot === 90 ? [g.fp.y, g.fp.x, g.dispZ] : [g.fp.x, g.fp.y, g.dispZ],
        axis,
        travel: g.travel,
      })
    }

    // Fit checks against the lid.
    const half = rot === 90 ? p.width / 2 : p.depth / 2
    const across = rot === 90 ? p.depth / 2 : p.width / 2
    const at = rot === 90 ? -acc.u : acc.v
    const along0 = at + r0 - S.endStop
    const along1 = at + r1 + S.endStop
    if (along0 < -half - 0.5 || along1 > half + 0.5)
      issues.push({ severity: 'high', message: `Slider rails and stops run past the lid (${Math.round(along1 - along0)} mm on a ${Math.round(2 * half)} mm lid). Reduce the travel or move the carriage.` })
    if (g.CW / 2 > across + 20)
      issues.push({ severity: 'medium', message: 'The screen carriage is much wider than the lid.' })
  }

  function insertMountLid(f: Frame, u: number, v: number, clamp: number) {
    const extra = Math.max(0, spec3.holeDepth + 1.2 - f.thickness)
    bodies.lid.add.push(inFrame(cylZ(spec3.bossD / 2, -f.thickness - extra, -f.thickness + 0.2), f, u, v))
    bodies.lid.cut.push(inFrame(cylZ(spec3.holeD / 2, -spec3.holeDepth, 1), f, u, v))
    fasteners.push({ size: 'M3', screwLength: screwLength(clamp, spec3), purpose: 'accessory' })
  }

  // ── local helpers needing the scope ──
  function toBody(m: Manifold, color: string): GeneratedBody {
    const mesh = m.getMesh()
    const np = mesh.numProp
    const vp = mesh.vertProperties
    const count = vp.length / np
    const positions = new Float32Array(count * 3)
    for (let k = 0; k < count; k++) {
      positions[k * 3] = vp[k * np]
      positions[k * 3 + 1] = vp[k * np + 1]
      positions[k * 3 + 2] = vp[k * np + 2]
    }
    return { color, mesh: { positions, indices: new Uint32Array(mesh.triVerts) }, volume: m.volume() }
  }

  function boundsSize(ms: Manifold[]): V3 {
    const min: V3 = [Infinity, Infinity, Infinity]
    const max: V3 = [-Infinity, -Infinity, -Infinity]
    for (const m of ms) {
      const b = m.boundingBox()
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], b.min[k])
        max[k] = Math.max(max[k], b.max[k])
      }
    }
    return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2]
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Smallest grid of pieces that fits the bed; prefers fewer pieces, then fewer cuts across the depth. */
export function chooseGrid(
  w: number,
  d: number,
  h: number,
  fits: (a: number, b: number, h: number) => boolean,
): { nx: number; ny: number } | null {
  let best: { nx: number; ny: number } | null = null
  for (let nx = 1; nx <= 4; nx++)
    for (let ny = 1; ny <= 4; ny++)
      if (fits(w / nx + 8, d / ny + 8, h)) {
        if (!best || nx * ny < best.nx * best.ny || (nx * ny === best.nx * best.ny && ny < best.ny)) best = { nx, ny }
      }
  return best
}

/**
 * Closure screw positions: four in the corners (pulled in along the diagonal
 * when the corners are rounded) plus extra pairs spread along the long edges.
 */
export function closurePoints(w: number, d: number, wall: number, r: number, br: number, count: number): [number, number][] {
  const inset = wall + br - 0.6
  let cx: number, cy: number
  if (r > inset) {
    const dist = Math.max(0, r - wall - br + 0.6)
    cx = w / 2 - r + dist / Math.SQRT2
    cy = d / 2 - r + dist / Math.SQRT2
  } else {
    cx = w / 2 - inset
    cy = d / 2 - inset
  }
  const pts: [number, number][] = [[-cx, -cy], [cx, -cy], [-cx, cy], [cx, cy]]
  const extraPairs = Math.floor(Math.max(0, count - 4) / 2)
  const alongX = w >= d
  for (let k = 1; k <= extraPairs; k++) {
    const t = -1 + (2 * k) / (extraPairs + 1)
    if (alongX) {
      const x = t * cx
      const y = d / 2 - wall - br + 0.6
      pts.push([x, -y], [x, y])
    } else {
      const y = t * cy
      const x = w / 2 - wall - br + 0.6
      pts.push([-x, y], [x, y])
    }
  }
  return pts
}

export { IDENTITY }
