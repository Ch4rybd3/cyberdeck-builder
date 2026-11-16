/**
 * Pure layout maths shared by the geometry generator, the constraint engine
 * and the viewport: face frames, rotated footprints and world-space boxes.
 * No WASM here, so it is cheap to call on every render and easy to test.
 */
import type { CatalogComponent, Window } from '../catalog/types'
import type { Build, CaseParams, Face, PartId, Placement } from './schema'

export type V3 = [number, number, number]

export interface AABB {
  min: V3
  max: V3
}

/** A face's coordinate frame: origin at the face centre, u/v in-plane, n outward. */
export interface Frame {
  origin: V3
  u: V3
  v: V3
  n: V3
  /** Thickness of the material behind this face. */
  thickness: number
}

/** The part's local box, before the lid is lifted into assembly position. */
export function partBox(p: CaseParams, part: PartId): AABB {
  const h = part === 'tray' ? p.trayHeight : p.lidHeight
  return { min: [-p.width / 2, -p.depth / 2, 0], max: [p.width / 2, p.depth / 2, h] }
}

/** Z offset of a part in the assembled deck. */
export function partOffsetZ(p: CaseParams, part: PartId): number {
  return part === 'tray' ? 0 : p.trayHeight
}

export function faceFrame(p: CaseParams, part: PartId, face: Face): Frame {
  const b = partBox(p, part)
  const cz = (b.min[2] + b.max[2]) / 2
  const side = p.wall
  const plate = p.floor
  switch (face) {
    case 'top':    return { origin: [0, 0, b.max[2]], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], thickness: plate }
    case 'bottom': return { origin: [0, 0, b.min[2]], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1], thickness: plate }
    case 'front':  return { origin: [0, b.min[1], cz], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], thickness: side }
    case 'back':   return { origin: [0, b.max[1], cz], u: [-1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], thickness: side }
    case 'right':  return { origin: [b.max[0], 0, cz], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], thickness: side }
    case 'left':   return { origin: [b.min[0], 0, cz], u: [0, -1, 0], v: [0, 0, 1], n: [-1, 0, 0], thickness: side }
  }
}

/** Size of a face in (u, v), used to clamp offsets in the inspector. */
export function faceSize(p: CaseParams, part: PartId, face: Face): { u: number; v: number } {
  const h = part === 'tray' ? p.trayHeight : p.lidHeight
  switch (face) {
    case 'top':
    case 'bottom': return { u: p.width, v: p.depth }
    case 'front':
    case 'back': return { u: p.width, v: h }
    case 'left':
    case 'right': return { u: p.depth, v: h }
  }
}

/** Column-major 4×4 matrix mapping frame-local (u, v, n) to part space. */
export function frameMatrix(f: Frame, du = 0, dv = 0): number[] {
  const o: V3 = [
    f.origin[0] + f.u[0] * du + f.v[0] * dv,
    f.origin[1] + f.u[1] * du + f.v[1] * dv,
    f.origin[2] + f.u[2] * du + f.v[2] * dv,
  ]
  return [...f.u, 0, ...f.v, 0, ...f.n, 0, ...o, 1]
}

// ── Placements ───────────────────────────────────────────────────────────────

export function rotatedFootprint(c: CatalogComponent, rotation: number): { x: number; y: number } {
  return rotation % 180 === 0 ? { x: c.dims.x, y: c.dims.y } : { x: c.dims.y, y: c.dims.x }
}

/** Rotate a point in the component's frame by the placement rotation (CCW, degrees). */
export function rotate2(x: number, y: number, deg: number): [number, number] {
  switch (((deg % 360) + 360) % 360) {
    case 90: return [-y, x]
    case 180: return [-x, -y]
    case 270: return [y, -x]
    default: return [x, y]
  }
}

// ── 3D orientation (90° steps: X, then Y, then Z) ───────────────────────────

const cosQ = (d: number) => [1, 0, -1, 0][(((d / 90) % 4) + 4) % 4]
const sinQ = (d: number) => [0, 1, 0, -1][(((d / 90) % 4) + 4) % 4]

type Oriented = Pick<Placement, 'rotation' | 'rotX' | 'rotY'>

/** Rotate a vector from the component's frame into the case frame. */
export function orient(v: V3, pl: Oriented): V3 {
  let [x, y, z] = v
  const ax = pl.rotX ?? 0
  const ay = pl.rotY ?? 0
  const az = pl.rotation ?? 0
  ;[y, z] = [y * cosQ(ax) - z * sinQ(ax), y * sinQ(ax) + z * cosQ(ax)]
  ;[x, z] = [x * cosQ(ay) + z * sinQ(ay), -x * sinQ(ay) + z * cosQ(ay)]
  ;[x, y] = [x * cosQ(az) - y * sinQ(az), x * sinQ(az) + y * cosQ(az)]
  return [x, y, z]
}

/** True when the component lies flat (only turned about Z). */
export function isFlat(pl: Oriented): boolean {
  return (pl.rotX ?? 0) === 0 && (pl.rotY ?? 0) === 0
}

/** Envelope of the component after its orientation, along the case axes. */
export function orientedDims(c: CatalogComponent, pl: Oriented): V3 {
  const out: V3 = [0, 0, 0]
  const axes: V3[] = [[c.dims.x, 0, 0], [0, c.dims.y, 0], [0, 0, c.dims.z]]
  for (const a of axes) {
    const r = orient(a, pl)
    for (let k = 0; k < 3; k++) out[k] += Math.abs(r[k])
  }
  return out
}

/** Height of the standoff a placement sits on, or 0 without standoffs (only flat boards get them). */
export function standoffHeight(c: CatalogComponent, pl: Placement): number {
  return pl.standoffs && c.mounting && isFlat(pl) ? c.mounting.standoff : 0
}

/** World-space (assembled) box of a placed component. */
export function placementBox(build: Build, c: CatalogComponent, pl: Placement): AABB {
  const p = build.case.params
  const [dx, dy, dz] = orientedDims(c, pl)
  let z0: number
  if (pl.part === 'tray') {
    z0 = p.floor + Math.max(pl.z, standoffHeight(c, pl))
  } else {
    const ceiling = p.trayHeight + p.lidHeight - p.floor
    z0 = ceiling - Math.max(pl.z, standoffHeight(c, pl)) - dz
  }
  return {
    min: [pl.x - dx / 2, pl.y - dy / 2, z0],
    max: [pl.x + dx / 2, pl.y + dy / 2, z0 + dz],
  }
}

/** Inverse of placementBox's z: the `z` field that puts the box bottom at `bottom` (assembled coordinates). */
export function zFieldForBottom(build: Build, c: CatalogComponent, pl: Placement, bottom: number): number {
  const p = build.case.params
  if (pl.part === 'tray') return Math.max(0, bottom - p.floor)
  const ceiling = p.trayHeight + p.lidHeight - p.floor
  return Math.max(0, ceiling - (bottom + orientedDims(c, pl)[2]))
}

/** A component window resolved onto a case face, in that face's (u, v) coordinates. */
export interface PlacedWindow {
  part: PartId
  face: Face
  u: number
  v: number
  /** Extent along the face's u and v axes. */
  w: number
  h: number
  r: number
  /** Gap between the component's face and the inside of the case wall. */
  gap: number
}

const WINDOW_AXES: Record<Window['face'], { n: V3; u: V3; v: V3; half: (c: CatalogComponent) => number }> = {
  top: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], half: c => c.dims.z / 2 },
  front: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], half: c => c.dims.y / 2 },
  back: { n: [0, 1, 0], u: [-1, 0, 0], v: [0, 0, 1], half: c => c.dims.y / 2 },
  right: { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], half: c => c.dims.x / 2 },
  left: { n: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], half: c => c.dims.x / 2 },
}

const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Where each of a component's windows lands on the case, whatever its
 * orientation: a window facing up is cut through the lid, one facing down
 * through the tray floor, one facing sideways through that wall.
 */
export function placedWindows(build: Build, c: CatalogComponent, pl: Placement): PlacedWindow[] {
  if (!c.windows) return []
  const p = build.case.params
  const box = placementBox(build, c, pl)
  const centre: V3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2]
  return c.windows.map(w => {
    const ax = WINDOW_AXES[w.face]
    const local: V3 = [0, 1, 2].map(k => ax.n[k] * ax.half(c) + ax.u[k] * (w.u ?? 0) + ax.v[k] * (w.v ?? 0)) as V3
    const off = orient(local, pl)
    const n = orient(ax.n, pl)
    const ru = orient(ax.u, pl)
    const k = [0, 1, 2].reduce((a, b) => (Math.abs(n[b]) > Math.abs(n[a]) ? b : a), 0)
    const face: Face = k === 2 ? (n[2] > 0 ? 'top' : 'bottom') : k === 0 ? (n[0] > 0 ? 'right' : 'left') : n[1] > 0 ? 'back' : 'front'
    const part: PartId = face === 'top' ? 'lid' : face === 'bottom' ? 'tray' : pl.part
    const f = faceFrame(p, part, face)
    const world: V3 = [centre[0] + off[0], centre[1] + off[1], centre[2] + off[2] - partOffsetZ(p, part)]
    const rel: V3 = [world[0] - f.origin[0], world[1] - f.origin[1], world[2] - f.origin[2]]
    const alongU = Math.abs(dot3(ru, f.u)) > 0.5
    return {
      part,
      face,
      u: dot3(rel, f.u),
      v: dot3(rel, f.v),
      w: alongU ? w.w : w.h,
      h: alongU ? w.h : w.w,
      r: w.r ?? (face === 'top' ? 1 : 0.5),
      gap: Math.max(0, -dot3(rel, f.n) - f.thickness),
    }
  })
}

/** The usable interior of the assembled case. */
export function interiorBox(p: CaseParams): AABB {
  return {
    min: [-p.width / 2 + p.wall, -p.depth / 2 + p.wall, p.floor],
    max: [p.width / 2 - p.wall, p.depth / 2 - p.wall, p.trayHeight + p.lidHeight - p.floor],
  }
}

export function intersects(a: AABB, b: AABB, eps = 0.01): boolean {
  return (
    a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps &&
    a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps &&
    a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps
  )
}

export function contains(outer: AABB, inner: AABB, eps = 0.01): boolean {
  return (
    inner.min[0] >= outer.min[0] - eps && inner.max[0] <= outer.max[0] + eps &&
    inner.min[1] >= outer.min[1] - eps && inner.max[1] <= outer.max[1] + eps &&
    inner.min[2] >= outer.min[2] - eps && inner.max[2] <= outer.max[2] + eps
  )
}

/** Which case face a component-frame face points at, after rotation. */
export function windowCaseFace(w: Window, rotation: number): Face {
  if (w.face === 'top') return 'top'
  const dir: Record<string, [number, number]> = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }
  const [x, y] = rotate2(...dir[w.face], rotation)
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left'
  return y > 0 ? 'back' : 'front'
}

export function boxSize(b: AABB): V3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
}
