import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { exampleBuilds } from '../catalog/templates'
import { buildBom } from '../domain/bom'
import { RAIL_MOUNT } from '../domain/deckport'
import { incompatibility } from '../domain/modules'
import { analysePorts } from '../domain/ports'
import { attachModules, modulesFor, snapToSlot } from '../geometry/attach'
import { generateCase } from '../geometry/caseBuilder'

it('clamps the LoRa module onto Vanguard’s right rail, off the face by the standoff', async () => {
  const wasm = await Module()
  wasm.setup()
  const library = exampleBuilds()
  const core = library.find(b => b.id === 'example-vanguard')!
  const lora = library.find(b => b.id === 'example-lora-module')!
  const gps = library.find(b => b.id === 'example-gps-module')!
  const rail = core.accessories.find(a => a.kind === 'picatinny')!
  const socket = core.accessories.find(a => a.kind === 'deckport')!

  expect(incompatibility(rail, lora)).toBeNull()
  expect(incompatibility(socket, lora)).toMatch(/rail/)
  expect(incompatibility(rail, gps)).toMatch(/socket/)

  const mod = generateCase(wasm, lora)
  expect(mod.pieces.some(p => p.name === 'Rail clamp')).toBe(true)
  expect(mod.hardware.railBolts).toBe(1)

  const [att] = attachModules(wasm, core, modulesFor(core, library))
  const half = core.case.params.width / 2
  let minX = Infinity
  for (const p of att.pieces.filter(p => p.name !== 'Rail clamp'))
    for (const b of p.bodies) {
      const m = p.assembly
      for (let i = 0; i < b.mesh.positions.length; i += 3) {
        const [x, y, z] = [b.mesh.positions[i], b.mesh.positions[i + 1], b.mesh.positions[i + 2]]
        minX = Math.min(minX, m[0] * x + m[4] * y + m[8] * z + m[12])
      }
    }
  // The module's floor sits the clamp standoff away from the Core's right face.
  expect(minX).toBeCloseTo(half + RAIL_MOUNT.standoff, 0)

  // The port past the rail end takes one of the Core's USB ports; the module brings its cable.
  expect(analysePorts(core).demand['usb-a']).toBeGreaterThanOrEqual(3)
  const bom = buildBom(lora, mod)
  expect(bom.some(l => l.name.startsWith('USB-C to USB-C cable'))).toBe(true)
  expect(bom.some(l => l.name.startsWith('M4 × 40'))).toBe(true)
  expect(snapToSlot(140, 3)).toBeCloseTo(0, 5)
})
