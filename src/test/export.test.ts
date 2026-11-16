import { strFromU8, unzipSync } from 'fflate'
import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { stlZip, threeMf } from '../geometry/export'
import { generateCase } from '../geometry/caseBuilder'

it('writes a multi-colour 3MF and an STL zip', async () => {
  const wasm = await Module()
  wasm.setup()
  const b = exampleBuilds()[0]
  const g = generateCase(wasm, b)
  const files = unzipSync(threeMf(b.name, g.pieces))
  const model = strFromU8(files['3D/3dmodel.model'])
  expect(model).toContain('<basematerials id="1">')
  expect(model).toContain('#2DD4BF')
  expect((model.match(/<item /g) ?? []).length).toBe(g.pieces.length)
  const stls = unzipSync(stlZip(b.name, g.pieces))
  const names = Object.keys(stls)
  expect(names.length).toBe(g.pieces.reduce((a, p) => a + p.bodies.length, 0))
  // Binary STL: 84-byte header + 50 bytes per triangle.
  const first = stls[names[0]]
  const tris = new DataView(first.buffer, first.byteOffset).getUint32(80, true)
  expect(first.length).toBe(84 + tris * 50)
})
