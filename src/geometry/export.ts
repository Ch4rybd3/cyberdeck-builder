/**
 * Print exports.
 *
 *   STL  one file per body (piece × colour), in print orientation, zipped.
 *   3MF  one file with every piece as a multi-part object; each colour is a
 *        separate part with its own base material, so Bambu Studio, OrcaSlicer
 *        and PrusaSlicer keep the parts together and let you assign one
 *        filament per part.
 *
 * Print orientation: lids are flipped so their top surface lies on the bed;
 * every piece is dropped to z = 0 and centred on the origin.
 */
import { strToU8, zipSync } from 'fflate'

import type { GeneratedBody, GeneratedPiece } from './caseBuilder'

interface Oriented {
  positions: Float32Array
  indices: Uint32Array
}

/** Orient every body of a piece with the same transform so the parts stay registered. */
export function orientPiece(piece: GeneratedPiece): Oriented[] {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const flipped = piece.bodies.map(b => {
    const p = new Float32Array(b.mesh.positions)
    if (piece.printFlip) for (let i = 0; i < p.length; i += 3) { p[i + 1] = -p[i + 1]; p[i + 2] = -p[i + 2] }
    for (let i = 0; i < p.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[i + k])
        max[k] = Math.max(max[k], p[i + k])
      }
    return { positions: p, indices: b.mesh.indices }
  })
  const off = [-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2, -min[2]]
  for (const f of flipped) for (let i = 0; i < f.positions.length; i += 3) for (let k = 0; k < 3; k++) f.positions[i + k] += off[k]
  return flipped
}

export function binaryStl(mesh: Oriented, name: string): Uint8Array {
  const tris = mesh.indices.length / 3
  const buf = new ArrayBuffer(84 + tris * 50)
  const dv = new DataView(buf)
  const header = strToU8(`Cyberdeck Builder: ${name}`.slice(0, 79))
  new Uint8Array(buf, 0, 80).set(header)
  dv.setUint32(80, tris, true)
  const P = mesh.positions
  let o = 84
  for (let t = 0; t < tris; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2]
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    for (const v of [nx, ny, nz, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]]) {
      dv.setFloat32(o, v, true)
      o += 4
    }
    dv.setUint16(o, 0, true)
    o += 2
  }
  return new Uint8Array(buf)
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function stlZip(buildName: string, pieces: GeneratedPiece[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const seen = new Map<string, number>()
  for (const piece of pieces) {
    const oriented = orientPiece(piece)
    // Identical accessories (four feet) share a name; number them.
    const base = slug(piece.name)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const stem = pieces.filter(p => slug(p.name) === base).length > 1 ? `${base}-${n}` : base
    piece.bodies.forEach((b: GeneratedBody, i) => {
      const suffix = piece.bodies.length > 1 ? `-${i + 1}-${b.color.replace('#', '').toLowerCase()}` : ''
      files[`${slug(buildName)}/${stem}${suffix}.stl`] = binaryStl(oriented[i], `${piece.name} ${b.color}`)
    })
  }
  return zipSync(files, { level: 6 })
}

export function threeMf(buildName: string, pieces: GeneratedPiece[]): Uint8Array {
  const colors = [...new Set(pieces.flatMap(p => p.bodies.map(b => b.color.toUpperCase())))]
  let nextId = 2
  const objects: string[] = []
  const items: string[] = []
  // Lay pieces out on a loose grid so the plate is readable when opened.
  let cursorX = 0
  let rowY = 0
  let rowH = 0
  const rowLimit = 600

  for (const piece of pieces) {
    const oriented = orientPiece(piece)
    const componentIds: number[] = []
    piece.bodies.forEach((b, i) => {
      const id = nextId++
      componentIds.push(id)
      const m = oriented[i]
      const verts: string[] = []
      for (let k = 0; k < m.positions.length; k += 3)
        verts.push(`<vertex x="${m.positions[k].toFixed(4)}" y="${m.positions[k + 1].toFixed(4)}" z="${m.positions[k + 2].toFixed(4)}"/>`)
      const tris: string[] = []
      for (let k = 0; k < m.indices.length; k += 3)
        tris.push(`<triangle v1="${m.indices[k]}" v2="${m.indices[k + 1]}" v3="${m.indices[k + 2]}"/>`)
      objects.push(
        `<object id="${id}" name="${xml(piece.name)} ${xml(b.color)}" type="model" pid="1" pindex="${colors.indexOf(b.color.toUpperCase())}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`,
      )
    })
    const parent = nextId++
    objects.push(`<object id="${parent}" name="${xml(piece.name)}" type="model"><components>${componentIds.map(c => `<component objectid="${c}"/>`).join('')}</components></object>`)
    const [w, d] = piece.size
    if (cursorX + w > rowLimit && cursorX > 0) {
      cursorX = 0
      rowY += rowH + 15
      rowH = 0
    }
    items.push(`<item objectid="${parent}" transform="1 0 0 0 1 0 0 0 1 ${(cursorX + w / 2).toFixed(2)} ${(rowY + d / 2).toFixed(2)} 0"/>`)
    cursorX += w + 15
    rowH = Math.max(rowH, d)
  }

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xml(buildName)}</metadata>
<metadata name="Application">Cyberdeck Builder</metadata>
<resources>
<basematerials id="1">${colors.map(c => `<base name="${c}" displaycolor="${c}FF"/>`).join('')}</basematerials>
${objects.join('\n')}
</resources>
<build>${items.join('')}</build>
</model>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`

  return zipSync({ '[Content_Types].xml': strToU8(contentTypes), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(model) }, { level: 6 })
}

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
