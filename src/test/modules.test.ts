import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { checkBuild } from '../domain/constraints'
import { analysePower } from '../domain/power'
import { attachModules, modulesFor } from '../geometry/attach'
import { generateCase } from '../geometry/caseBuilder'

it('mounts the SDR module on the right socket of Wayfarer and counts its draw', async () => {
  const wasm = await Module()
  wasm.setup()
  const library = exampleBuilds()
  const core = library.find(b => b.id === 'example-wayfarer')!
  const modules = modulesFor(core, library)
  expect(modules.map(m => m.id)).toEqual(['example-sdr-module'])

  const [att] = attachModules(wasm, core, modules)
  // Every vertex of the module lies outside the Core's right face, within the plug key depth.
  const half = core.case.params.width / 2
  let minX = Infinity
  for (const p of att.pieces)
    for (const b of p.bodies) {
      const m = p.assembly
      for (let i = 0; i < b.mesh.positions.length; i += 3) {
        const [x, y, z] = [b.mesh.positions[i], b.mesh.positions[i + 1], b.mesh.positions[i + 2]]
        minX = Math.min(minX, m[0] * x + m[4] * y + m[8] * z + m[12])
      }
    }
  expect(minX).toBeGreaterThan(half - 1.01)
  expect(minX).toBeLessThan(half + 0.5)

  const without = analysePower(core)
  const withMod = analysePower(core, modules)
  expect(withMod.drawPeakW).toBeGreaterThan(without.drawPeakW)
  expect(withMod.loads.some(l => l.placement.label === 'Module: SDR module')).toBe(true)
  const issues = checkBuild(core, generateCase(wasm, core), modules)
  expect(issues.some(i => i.message.includes('with a module attached'))).toBe(true)
})
