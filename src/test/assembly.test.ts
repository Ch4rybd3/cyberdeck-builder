import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { assemblySteps } from '../domain/assembly'
import { modulesFor } from '../domain/modules'
import { generateCase } from '../geometry/caseBuilder'

it('writes an assembly guide that covers the slider, the tube handle and the rail module', async () => {
  const wasm = await Module()
  wasm.setup()
  const library = exampleBuilds()
  const v = library.find(b => b.id === 'example-vanguard')!
  const steps = assemblySteps(v, generateCase(wasm, v), modulesFor(v, library))
  const ids = steps.map(s => s.id)
  expect(ids).toEqual(['print', 'inserts', 'join', 'accessories', 'electronics', 'wiring', 'modules', 'close'])
  const text = steps.flatMap(s => s.items).join('\n')
  expect(text).toMatch(/Screen slider, in this order/)
  expect(text).toMatch(/M5 bolt through post, grip and post/)
  expect(text).toMatch(/LoRa module: slide its clamp onto the right rail/)
})
