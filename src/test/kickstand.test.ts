import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { buildBom } from '../domain/bom'
import { generateCase } from '../geometry/caseBuilder'

it('builds a kickstand that swings its leg away from the case', async () => {
  const wasm = await Module()
  wasm.setup()
  const w = exampleBuilds().find(b => b.id === 'example-wayfarer')!
  const r = generateCase(wasm, w)
  const leg = r.pieces.find(p => p.name === 'Kickstand leg')!
  expect(r.pieces.some(p => p.name === 'Kickstand hinge')).toBe(true)
  expect(leg.pivot).toBeDefined()
  // The pivot sits below the floor (bottom face, z < 0), and the axis runs along x.
  expect(leg.pivot!.origin[2]).toBeLessThan(0)
  expect(Math.abs(leg.pivot!.axis[0])).toBeCloseTo(1)
  // Rotating the leg tip (towards the front, −y) about the axis must move it down (−z).
  const [ax] = leg.pivot!.axis
  const tipDir = [0, -1, 0]
  const dz = ax * tipDir[1] // z of (axis × tip) for an axis along x: ax · ty
  expect(dz).toBeLessThan(0)
  expect(buildBom(w, r).some(l => l.name.startsWith('M3 × 60') || l.name.startsWith('M3 × 50'))).toBe(true)
  expect(r.issues.filter(i => i.message.includes('loose bit'))).toEqual([])
})
