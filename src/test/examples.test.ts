import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { checkBuild } from '../domain/constraints'
import { attachModules, modulesFor } from '../geometry/attach'
import { generateCase } from '../geometry/caseBuilder'

it('ships examples without blocking issues, with every module attached', async () => {
  const wasm = await Module()
  wasm.setup()
  const library = exampleBuilds()
  const report: string[] = []
  for (const b of library) {
    const modules = modulesFor(b, library)
    const geo = generateCase(wasm, b)
    for (const i of checkBuild(b, geo, modules)) if (i.severity === 'critical' || i.severity === 'high') report.push(`${b.name}: ${i.message}`)
    if (b.kind === 'core') expect(attachModules(wasm, b, modules).length).toBe(b.accessories.filter(a => a.moduleId).length)
  }
  expect(report).toEqual([])
  const attached = library.flatMap(b => b.accessories.filter(a => a.moduleId).map(a => a.moduleId))
  expect(attached.sort()).toEqual(['example-gps-module', 'example-lora-module', 'example-sdr-module'])
})
