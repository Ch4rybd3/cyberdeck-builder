import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { newBuild } from '../catalog/templates'
import { generateCase } from '../geometry/caseBuilder'
import type { Build, Placement } from '../domain/schema'

// Regression: the interior cavity used to be subtracted after the internal
// bosses were added, erasing standoffs, joint blocks and tie points.
it('keeps everything added inside the case', async () => {
  const wasm = await Module()
  wasm.setup()
  const b = newBuild('slab')
  b.print.printerId = 'bambu-p1s'
  b.case.params.width = 200
  b.case.params.depth = 150
  b.accessories = []
  const tray = (x: Build) => generateCase(wasm, x).pieces.find(p => p.id === 'tray')!.bodies[0].volume
  const base = tray(b)
  const pi: Placement = { id: 'p', componentId: 'rpi5-8gb', part: 'tray', x: 0, y: 0, z: 0, rotation: 0, rotX: 0, rotY: 0, standoffs: true, window: true }
  expect(tray({ ...b, placements: [pi] }) - base).toBeGreaterThan(4 * 60)
  expect(tray({ ...b, accessories: [{ id: 't', kind: 'tiepoint', part: 'tray', face: 'bottom', u: 0, v: 0, length: 10, rotation: 0 }] }) - base).toBeGreaterThan(150)
  // Split joints: the blocks add material on both sides of the cut.
  const split = newBuild('slab')
  split.print.printerId = 'ender-3'
  split.accessories = []
  const whole = { ...split, print: { ...split.print, autoSplit: false, printerId: 'bambu-x1c' } }
  const sum = (x: Build) => generateCase(wasm, x).pieces.filter(p => p.group === 'tray').reduce((a, p) => a + p.bodies[0].volume, 0)
  expect(sum(split) - sum(whole)).toBeGreaterThan(2000)
})
