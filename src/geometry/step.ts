/**
 * STEP export (ISO 10303-21, AP214), as faceted solids.
 *
 * Every body becomes a FACETED_BREP: a closed shell of planar faces bounded
 * by polygon loops. Coplanar triangles that touch are merged into one face
 * (with its holes), so a flat wall is one face rather than hundreds of
 * triangles — the file stays reasonable and CAD tools select whole faces.
 *
 * The result opens in FreeCAD, Fusion 360, Onshape or SolidWorks as solid
 * bodies you can measure, cut and add to. Curved surfaces stay faceted: this
 * is a mesh-accurate solid, not a parametric model.
 */
import type { GeneratedPiece } from './caseBuilder'

type V3 = [number, number, number]

class StepWriter {
  private next = 1
  readonly lines: string[] = []

  add(text: string): number {
    const id = this.next++
    this.lines.push(`#${id}=${text};`)
    return id
  }
}

/** STEP reals need a decimal point: 12 → "12.", 0.5 → "0.5". */
const num = (n: number) => (Math.abs(n) < 5e-7 ? 0 : n).toFixed(5).replace(/0+$/, '')
const str = (s: string) => `'${s.replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '_')}'`

function transform(m: number[], [x, y, z]: V3): V3 {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

interface Face {
  normal: V3
  /** Loops of vertex indices; the first is the outer boundary (counter-clockwise about the normal). */
  loops: number[][]
}

/**
 * Merge a triangle mesh into planar faces with holes. Falls back to single
 * triangles for any group whose boundary is not a clean set of loops.
 */
export function planarFaces(points: V3[], tris: [number, number, number][]): Face[] {
  const normals = tris.map(([a, b, c]) => norm(cross(sub(points[b], points[a]), sub(points[c], points[a]))))
  const planeKey = (i: number) => {
    const n = normals[i]
    const d = dot(n, points[tris[i][0]])
    return `${n.map(v => Math.round(v * 1e4)).join(',')}|${Math.round(d * 1e3)}`
  }
  const groups = new Map<string, number[]>()
  tris.forEach((_, i) => {
    const k = planeKey(i)
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  })

  const faces: Face[] = []
  for (const group of groups.values()) {
    // Connected components through shared edges.
    const edgeOwner = new Map<string, number[]>()
    for (const t of group) {
      const [a, b, c] = tris[t]
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const k = p < q ? `${p}_${q}` : `${q}_${p}`
        const list = edgeOwner.get(k)
        if (list) list.push(t)
        else edgeOwner.set(k, [t])
      }
    }
    const seen = new Set<number>()
    for (const start of group) {
      if (seen.has(start)) continue
      const comp: number[] = []
      const stack = [start]
      seen.add(start)
      while (stack.length) {
        const t = stack.pop()!
        comp.push(t)
        const [a, b, c] = tris[t]
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
          for (const o of edgeOwner.get(p < q ? `${p}_${q}` : `${q}_${p}`) ?? []) {
            if (!seen.has(o)) {
              seen.add(o)
              stack.push(o)
            }
          }
        }
      }
      const face = mergeComponent(points, tris, comp, normals[comp[0]])
      if (face) faces.push(face)
      else for (const t of comp) faces.push({ normal: normals[t], loops: [[...tris[t]]] })
    }
  }
  return faces
}

function mergeComponent(points: V3[], tris: [number, number, number][], comp: number[], normal: V3): Face | null {
  if (comp.length === 1) return { normal, loops: [[...tris[comp[0]]]] }
  const directed = new Set<string>()
  for (const t of comp) {
    const [a, b, c] = tris[t]
    directed.add(`${a}_${b}`).add(`${b}_${c}`).add(`${c}_${a}`)
  }
  // Boundary edges: those whose reverse is not in the component.
  const out = new Map<number, number[]>()
  let count = 0
  for (const t of comp) {
    const [a, b, c] = tris[t]
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      if (directed.has(`${q}_${p}`)) continue
      const list = out.get(p)
      if (list) list.push(q)
      else out.set(p, [q])
      count++
    }
  }
  // A vertex with two outgoing boundary edges is a pinch: keep it simple and fall back.
  for (const l of out.values()) if (l.length > 1) return null
  const loops: number[][] = []
  const used = new Set<number>()
  for (const startV of out.keys()) {
    if (used.has(startV)) continue
    const loop: number[] = []
    let v = startV
    while (!used.has(v)) {
      used.add(v)
      loop.push(v)
      const nxt = out.get(v)
      if (!nxt) return null
      v = nxt[0]
    }
    if (v !== startV || loop.length < 3) return null
    loops.push(loop)
  }
  if (loops.reduce((a, l) => a + l.length, 0) !== count) return null
  // Signed area about the normal: the outer loop is the only positive one.
  const area = (loop: number[]) => {
    let s: V3 = [0, 0, 0]
    for (let i = 0; i < loop.length; i++) s = [0, 1, 2].map(k => s[k] + cross(points[loop[i]], points[loop[(i + 1) % loop.length]])[k]) as V3
    return dot(s, normal) / 2
  }
  const signed = loops.map(area)
  const outer = signed.map((a, i) => (a > 0 ? i : -1)).filter(i => i >= 0)
  if (outer.length !== 1) return null
  return { normal, loops: [loops[outer[0]], ...loops.filter((_, i) => i !== outer[0])] }
}

/** One STEP file with every piece as a named solid, in assembled position (or laid flat side by side). */
export function stepFile(buildName: string, pieces: GeneratedPiece[], placeAssembled = true): string {
  const w = new StepWriter()
  const ctx = w.add("APPLICATION_CONTEXT('core data for automotive mechanical design processes')")
  w.add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${ctx})`)
  const pctx = w.add(`PRODUCT_CONTEXT('',#${ctx},'mechanical')`)
  const product = w.add(`PRODUCT(${str(buildName)},${str(buildName)},'',(#${pctx}))`)
  const pdf = w.add(`PRODUCT_DEFINITION_FORMATION('','',#${product})`)
  const pdc = w.add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${ctx},'design')`)
  const pd = w.add(`PRODUCT_DEFINITION('design','',#${pdf},#${pdc})`)
  const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`)
  const len = w.add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))')
  const ang = w.add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))')
  const sol = w.add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())')
  const unc = w.add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${len},'distance_accuracy_value','confusion accuracy')`)
  const gctx = w.add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${len},#${ang},#${sol}))REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY'))`)
  const o = w.add("CARTESIAN_POINT('',(0.,0.,0.))")
  const dz = w.add("DIRECTION('',(0.,0.,1.))")
  const dx = w.add("DIRECTION('',(1.,0.,0.))")
  const origin = w.add(`AXIS2_PLACEMENT_3D('',#${o},#${dz},#${dx})`)

  const breps: number[] = []
  let offsetX = 0
  for (const piece of pieces) {
    for (const [bi, body] of piece.bodies.entries()) {
      const pos = body.mesh.positions
      const raw: V3[] = []
      for (let i = 0; i < pos.length; i += 3) raw.push([pos[i], pos[i + 1], pos[i + 2]])
      const placed = placeAssembled ? raw.map(p => transform(piece.assembly, p)) : raw.map(p => [p[0] + offsetX, p[1], p[2]] as V3)
      // Weld coincident vertices so shared edges really are shared.
      const index = new Map<string, number>()
      const points: V3[] = []
      const remap = placed.map(p => {
        const k = p.map(v => Math.round(v * 1e4)).join(',')
        let i = index.get(k)
        if (i === undefined) {
          i = points.length
          points.push(p)
          index.set(k, i)
        }
        return i
      })
      const tris: [number, number, number][] = []
      for (let i = 0; i < body.mesh.indices.length; i += 3) {
        const t: [number, number, number] = [remap[body.mesh.indices[i]], remap[body.mesh.indices[i + 1]], remap[body.mesh.indices[i + 2]]]
        if (t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]) tris.push(t)
      }
      const faces = planarFaces(points, tris)
      const used = new Set(faces.flatMap(f => f.loops.flat()))
      const pointId = new Map<number, number>()
      for (const i of used) pointId.set(i, w.add(`CARTESIAN_POINT('',(${points[i].map(num).join(',')}))`))
      const faceIds = faces.map(f => {
        const n = f.normal
        const ref = norm(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
        const nd = w.add(`DIRECTION('',(${n.map(num).join(',')}))`)
        const rd = w.add(`DIRECTION('',(${ref.map(num).join(',')}))`)
        const ax = w.add(`AXIS2_PLACEMENT_3D('',#${pointId.get(f.loops[0][0])},#${nd},#${rd})`)
        const plane = w.add(`PLANE('',#${ax})`)
        const bounds = f.loops.map((loop, li) => {
          const pl = w.add(`POLY_LOOP('',(${loop.map(i => `#${pointId.get(i)}`).join(',')}))`)
          return w.add(`${li === 0 ? 'FACE_OUTER_BOUND' : 'FACE_BOUND'}('',#${pl},.T.)`)
        })
        return w.add(`FACE_SURFACE('',(${bounds.map(b => `#${b}`).join(',')}),#${plane},.T.)`)
      })
      const shell = w.add(`CLOSED_SHELL('',(${faceIds.map(f => `#${f}`).join(',')}))`)
      const name = piece.bodies.length > 1 ? `${piece.name} ${bi + 1}` : piece.name
      breps.push(w.add(`FACETED_BREP(${str(name)},#${shell})`))
    }
    if (!placeAssembled) offsetX += piece.size[0] + 20
  }
  const rep = w.add(`FACETED_BREP_SHAPE_REPRESENTATION(${str(buildName)},(#${origin},${breps.map(b => `#${b}`).join(',')}),#${gctx})`)
  w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`)

  const date = new Date().toISOString().slice(0, 19)
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('Cyberdeck Builder export: faceted solids'),'2;1');",
    `FILE_NAME(${str(`${buildName}.step`)},'${date}',('Cyberdeck Builder'),(''),'Cyberdeck Builder','Cyberdeck Builder','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    'ENDSEC;',
    'DATA;',
    ...w.lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n')
}

