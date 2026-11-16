/**
 * Modules on a Core: places each attached module's printed pieces on its
 * DeckPort socket, plug face against socket face.
 *
 * The module's plug frame (u_m, v_m, n_m) is mapped onto the Core's socket
 * frame so that the faces touch (n_m → −n_c), "up" stays up (v_m → v_c) and
 * therefore u_m → −u_c. The socket pattern is symmetric, so this is the only
 * orientation needed.
 */
import type { ManifoldToplevel } from 'manifold-3d'

import { faceFrame, partOffsetZ, type V3 } from '../domain/layout'
import type { Build } from '../domain/schema'
import { generateCase, type GeneratedPiece } from './caseBuilder'

export interface AttachedModule {
  accessoryId: string
  moduleId: string
  name: string
  /** Pieces with `assembly` already expressed in the Core's assembled frame. */
  pieces: GeneratedPiece[]
  /** Which Core part the socket is on, so the module follows a hinged lid. */
  attachedTo: 'tray' | 'lid'
  /** Outward direction of the socket, for the exploded view. */
  normal: V3
}

type M4 = number[]

function mul(a: M4, b: M4): M4 {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return out
}

/** Column-major matrix of a frame placed at a point. */
function frameAt(u: V3, v: V3, n: V3, o: V3): M4 {
  return [...u, 0, ...v, 0, ...n, 0, ...o, 1]
}

/** Inverse of a rigid frame matrix (transpose the rotation, rotate the translation). */
function invertFrame(u: V3, v: V3, n: V3, o: V3): M4 {
  const d = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return [u[0], v[0], n[0], 0, u[1], v[1], n[1], 0, u[2], v[2], n[2], 0, -d(u, o), -d(v, o), -d(n, o), 1]
}

function socketPoint(build: Build, part: 'tray' | 'lid', face: Parameters<typeof faceFrame>[2], u: number, v: number) {
  const f = faceFrame(build.case.params, part, face)
  const dz = partOffsetZ(build.case.params, part)
  const o: V3 = [f.origin[0] + f.u[0] * u + f.v[0] * v, f.origin[1] + f.u[1] * u + f.v[1] * v, f.origin[2] + f.u[2] * u + f.v[2] * v + dz]
  return { f, o }
}

export function modulesFor(core: Build, library: Build[]): Build[] {
  const ids = new Set(core.accessories.filter(a => a.kind === 'deckport' && a.moduleId).map(a => a.moduleId!))
  return library.filter(b => ids.has(b.id) && b.kind === 'module')
}

export function attachModules(wasm: ManifoldToplevel, core: Build, modules: Build[]): AttachedModule[] {
  if (core.kind !== 'core') return []
  const out: AttachedModule[] = []
  for (const acc of core.accessories) {
    if (acc.kind !== 'deckport' || !acc.moduleId) continue
    const mod = modules.find(m => m.id === acc.moduleId)
    const plug = mod?.accessories.find(a => a.kind === 'deckport')
    if (!mod || !plug) continue
    const c = socketPoint(core, acc.part, acc.face, acc.u, acc.v)
    const m = socketPoint(mod, plug.part, plug.face, plug.u, plug.v)
    const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]]
    // module socket frame → core socket frame (u flipped, n flipped), then module assembly → module socket frame.
    const toCore = frameAt(neg(c.f.u), c.f.v, neg(c.f.n), c.o)
    const fromModule = invertFrame(m.f.u, m.f.v, m.f.n, m.o)
    const place = mul(toCore, fromModule)
    const result = generateCase(wasm, mod)
    out.push({
      accessoryId: acc.id,
      moduleId: mod.id,
      name: mod.name,
      attachedTo: acc.part,
      normal: c.f.n,
      pieces: result.pieces.map(p => ({ ...p, id: `mod-${acc.id}-${p.id}`, assembly: mul(place, p.assembly), explode: c.f.n, attachedTo: acc.part, slide: undefined })),
    })
  }
  return out
}
