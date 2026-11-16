import Module from 'manifold-3d'
import { expect, it } from 'vitest'

import { newBuild } from '../catalog/templates'
import { buildBom } from '../domain/bom'
import { analysePower } from '../domain/power'
import { generateCase } from '../geometry/caseBuilder'

it('uses a custom component in geometry, power and the shopping list', async () => {
  const wasm = await Module()
  wasm.setup()
  const b = newBuild('slab')
  b.print.printerId = 'bambu-p1s'
  b.case.params.width = 220
  b.case.params.depth = 160
  b.accessories = []
  b.customComponents.push({
    id: 'custom-sbc',
    name: 'My SBC',
    category: 'sbc',
    dims: { x: 60, y: 40, z: 15 },
    mass: 30,
    price: 42,
    supplier: 'Me',
    mounting: { insert: 'M2.5', holes: [[-25, -15], [25, -15], [-25, 15], [25, 15]], standoff: 5 },
    power: { role: 'load', rail: '5V', typW: 3, peakW: 6 },
  })
  b.placements.push({ id: 'p1', componentId: 'custom-sbc', part: 'tray', x: 0, y: 0, z: 0, rotation: 0, standoffs: true, window: true })
  const r = generateCase(wasm, b)
  expect(r.fasteners.filter(f => f.purpose === 'standoff')).toHaveLength(4)
  expect(analysePower(b).loads.map(l => l.component.name)).toEqual(['My SBC'])
  expect(buildBom(b, r).some(l => l.name === 'My SBC' && l.unitPrice === 42)).toBe(true)
})
