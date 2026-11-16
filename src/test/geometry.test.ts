import Module from 'manifold-3d'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'

import { exampleBuilds, newBuild } from '../catalog/templates'
import { generateCase } from '../geometry/caseBuilder'

let wasm: ManifoldToplevel

beforeAll(async () => {
  wasm = await Module()
  wasm.setup()
})

describe('generateCase', () => {
  it('builds a tray and a lid for an empty slab', () => {
    const b = newBuild('slab')
    b.print.printerId = 'bambu-p1s'
    b.case.params.width = 200
    b.case.params.depth = 150
    b.accessories = []
    const r = generateCase(wasm, b)
    expect(r.pieces.map(p => p.id)).toEqual(['tray', 'lid'])
    for (const p of r.pieces) {
      expect(p.bodies[0].volume).toBeGreaterThan(1000)
      expect(p.fitsBed).toBe(true)
    }
    expect(r.fasteners.filter(f => f.purpose === 'closure').length).toBe(8)
  })

  it('splits a wide case for an Ender 3 and adds insert joints', () => {
    const b = newBuild('slab')
    b.print.printerId = 'ender-3'
    const r = generateCase(wasm, b)
    const trays = r.pieces.filter(p => p.group === 'tray')
    expect(trays.length).toBeGreaterThan(1)
    expect(trays.every(p => p.fitsBed)).toBe(true)
    expect(r.fasteners.some(f => f.purpose === 'split-joint')).toBe(true)
  })

  it('generates every example build without throwing', () => {
    for (const b of exampleBuilds()) {
      const r = generateCase(wasm, b)
      expect(r.pieces.length).toBeGreaterThan(1)
      for (const p of r.pieces) for (const body of p.bodies) expect(body.mesh.indices.length).toBeGreaterThan(0)
    }
  })
})
