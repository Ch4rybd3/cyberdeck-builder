import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { newBuild } from '../catalog/templates'
import { generateCase } from '../geometry/caseBuilder'
import { planarFaces, stepFile } from '../geometry/step'

it('merges coplanar triangles into faces with holes', () => {
  // A square with a square hole, triangulated: one face, two loops.
  const pts: [number, number, number][] = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [3, 3, 0], [7, 3, 0], [7, 7, 0], [3, 7, 0]]
  const tris: [number, number, number][] = [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]
  const faces = planarFaces(pts, tris)
  expect(faces).toHaveLength(1)
  expect(faces[0].loops).toHaveLength(2)
  expect(faces[0].loops[0]).toHaveLength(4)
})

it('writes a well-formed STEP file with one solid per body', async () => {
  const wasm = await Module()
  wasm.setup()
  const b = newBuild('handheld')
  const r = generateCase(wasm, b)
  const text = stepFile(b.name, r.pieces)
  expect(text.startsWith('ISO-10303-21;')).toBe(true)
  expect(text.trimEnd().endsWith('END-ISO-10303-21;')).toBe(true)
  expect((text.match(/FACETED_BREP\(/g) ?? []).length).toBe(r.pieces.reduce((a, p) => a + p.bodies.length, 0))
  // Every reference points at a defined entity.
  const defined = new Set([...text.matchAll(/^#(\d+)=/gm)].map(m => m[1]))
  const refs = [...text.matchAll(/#(\d+)(?!=)/g)].map(m => m[1])
  expect(refs.every(r => defined.has(r))).toBe(true)
  // Far fewer faces than triangles: flat walls are merged.
  const tris = r.pieces.reduce((a, p) => a + p.bodies.reduce((x, y) => x + y.mesh.indices.length / 3, 0), 0)
  expect((text.match(/FACE_SURFACE\(/g) ?? []).length).toBeLessThan(tris / 2)
})
