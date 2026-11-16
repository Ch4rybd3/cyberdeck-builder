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

/** Height of the standoff a placement sits on, or 0 without standoffs. */
export function standoffHeight(c: CatalogComponent, pl: Placement): number {
  return pl.standoffs && c.mounting ? c.mounting.standoff : 0
}

/** World-space (assembled) box of a placed component. */
export function placementBox(build: Build, c: CatalogComponent, pl: Placement): AABB {
  const p = build.case.params
  const fp = rotatedFootprint(c, pl.rotation)
  let z0: number
  if (pl.part === 'tray') {
    z0 = p.floor + Math.max(pl.z, standoffHeight(c, pl))
  } else {
    const ceiling = p.trayHeight + p.lidHeight - p.floor
    z0 = ceiling - Math.max(pl.z, standoffHeight(c, pl)) - c.dims.z
  }
  return {
    min: [pl.x - fp.x / 2, pl.y - fp.y / 2, z0],
    max: [pl.x + fp.x / 2, pl.y + fp.y / 2, z0 + c.dims.z],
  }
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
