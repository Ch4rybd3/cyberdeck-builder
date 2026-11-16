import Module from 'manifold-3d'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'

import { exampleBuilds, newBuild } from '../catalog/templates'
import { checkBuild } from '../domain/constraints'
import { migrate } from '../domain/migrate'
import { generateCase } from '../geometry/caseBuilder'

let wasm: ManifoldToplevel
beforeAll(async () => {
  wasm = await Module()
  wasm.setup()
})

describe('formats', () => {
  it('builds every template on both an Ender 3 and an A1', () => {
    for (const id of ['slab', 'tactical', 'briefcase', 'suitcase', 'field-case', 'handheld', 'module-2u'])
      for (const printerId of ['ender-3', 'bambu-a1']) {
        const b = newBuild(id)
        b.print.printerId = printerId
        const r = generateCase(wasm, b)
        expect(r.pieces.every(p => p.fitsBed), `${id} on ${printerId}`).toBe(true)
      }
  })

  it('gives a hinged case a pin and magnets on the front only', () => {
    const r = generateCase(wasm, newBuild('briefcase'))
    expect(r.hardware.hingePin?.length).toBeGreaterThan(300)
    expect(r.hardware.magnets).toBe(6)
  })

  it('splits the Vanguard slider into fitting pieces that all slide together', () => {
    const v = exampleBuilds().find(b => b.id === 'example-vanguard')!
    const r = generateCase(wasm, v)
    const sliding = r.pieces.filter(p => p.slide)
    expect(sliding.length).toBeGreaterThanOrEqual(2)
    expect(new Set(sliding.map(p => p.slide!.travel)).size).toBe(1)
    expect(r.carried).toHaveLength(1)
    expect(r.pieces.every(p => p.fitsBed)).toBe(true)
    const blocking = checkBuild(v, r).filter(i => i.severity === 'critical' || i.severity === 'high')
    expect(blocking).toEqual([])
  })

  it('migrates a schema 1 build', () => {
    const old = { ...structuredClone(exampleBuilds()[0]), schemaVersion: 1 } as Record<string, unknown>
    const c = old.case as { params: Record<string, unknown> }
    delete c.params.cornerStyle
    delete c.params.hinge
    const { build } = migrate(old)
    expect(build?.schemaVersion).toBe(5)
    expect(build?.case.params.hinge).toBe(false)
  })
})
