import Module from 'manifold-3d'
import { beforeAll, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'

import { exampleBuilds, newBuild, TEMPLATES } from '../catalog/templates'
import { INSERTS } from '../domain/hardware'
import { closurePoints, generateCase } from '../geometry/caseBuilder'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await Module()
  wasm.setup()
})

it('keeps chamfered-corner closure bosses inside the outline', () => {
  const W = 320, D = 250, c = 18, wall = 3
  const br = INSERTS.M3.bossD / 2
  for (const [x, y] of closurePoints(W, D, wall, c, br, 8, true)) {
    // Distance from the boss centre to the 45° chamfer face must cover the boss radius.
    expect((W / 2 + D / 2 - c - (Math.abs(x) + Math.abs(y))) / Math.SQRT2).toBeGreaterThanOrEqual(br + 0.39)
    expect(Math.abs(x)).toBeLessThanOrEqual(W / 2 - br)
    expect(Math.abs(y)).toBeLessThanOrEqual(D / 2 - br)
  }
})

it('leaves no loose bits in any template or example', () => {
  const builds = [...TEMPLATES.map(t => newBuild(t.id)), ...exampleBuilds()]
  const loose = builds.flatMap(b => generateCase(wasm, b).issues.filter(i => i.message.includes('loose bit')).map(i => `${b.name}: ${i.message}`))
  expect(loose).toEqual([])
})

it('builds a tube handle as two posts, a grip and one M5 bolt', () => {
  const b = newBuild('tactical')
  const r = generateCase(wasm, b)
  const names = r.pieces.filter(p => p.group === 'accessory').map(p => p.name)
  expect(names).toEqual(expect.arrayContaining(['Handle post A', 'Handle post B', 'Handle grip']))
  expect(r.hardware.handleBolts).toEqual([150])
  const grip = r.pieces.find(p => p.name === 'Handle grip')!
  // Printed standing: the bounding box is tall and round.
  expect(grip.size[2]).toBeCloseTo(119, 0)
  expect(grip.size[0]).toBeLessThan(25)
})
