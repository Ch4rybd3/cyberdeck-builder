import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds, newBuild } from '../catalog/templates'
import { buildBom } from '../domain/bom'
import { generateCase } from '../geometry/caseBuilder'

it('cuts glands and grommets, prints the grommet, anchors zip ties', async () => {
  const wasm = await Module()
  wasm.setup()
  const b = newBuild('slab')
  b.print.printerId = 'bambu-p1s'
  b.case.params.width = 200
  b.case.params.depth = 150
  b.accessories = [
    { id: 'g', kind: 'gland', part: 'tray', face: 'back', u: -40, v: 0, length: 20, rotation: 0, gland: 'M16' },
    { id: 'r', kind: 'grommet', part: 'tray', face: 'back', u: 40, v: 0, length: 20, width: 8, rotation: 0 },
    { id: 't', kind: 'tiepoint', part: 'tray', face: 'bottom', u: 0, v: 0, length: 10, rotation: 0 },
  ]
  const plain = generateCase(wasm, { ...b, accessories: [] })
  const r = generateCase(wasm, b)
  const tray = (x: typeof r) => x.pieces.find(p => p.id === 'tray')!.bodies[0].volume
  // The gland hole and the slot remove more than the tie bridge adds.
  expect(tray(r)).toBeLessThan(tray(plain))
  const grommet = r.pieces.find(p => p.name.startsWith('Grommet'))!
  expect(grommet.size[2]).toBeGreaterThan(4)
  expect(r.hardware.glands).toEqual(['M16'])
  expect(r.hardware.tiePoints).toBe(1)
  const bom = buildBom(b, r)
  expect(bom.some(l => l.name.startsWith('Cable gland M16'))).toBe(true)
  expect(bom.some(l => l.name.startsWith('TPU'))).toBe(true)
  expect(r.issues.filter(i => i.message.includes('loose bit'))).toEqual([])

  const courier = exampleBuilds().find(x => x.id === 'example-courier')!
  expect(generateCase(wasm, courier).hardware.glands).toEqual(['PG9'])
})
