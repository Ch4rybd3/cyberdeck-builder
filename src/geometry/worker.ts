/**
 * Geometry worker: runs the case generator off the main thread so dragging a
 * component or typing a dimension never stalls the interface.
 */
import type { Build } from '../domain/schema'
import { attachModules, type AttachedModule } from './attach'
import { generateCase, type GeometryResult } from './caseBuilder'
import { loadKernel } from './kernel'
import { loadFonts } from './text'

export type WorkerRequest = { id: number; build: Build; modules: Build[] }
export type WorkerResponse = { id: number; result?: GeometryResult; attached?: AttachedModule[]; error?: string }

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, build, modules } = e.data
  try {
    const [wasm] = await Promise.all([loadKernel(), loadFonts()])
    const attached = attachModules(wasm, build, modules)
    // The Core last, so its result is not affected by the modules' custom components.
    const result = generateCase(wasm, build)
    // Hand the mesh buffers over instead of copying them.
    const all = [...result.pieces, ...attached.flatMap(a => a.pieces)]
    const transfer = all.flatMap(p => p.bodies.flatMap(b => [b.mesh.positions.buffer, b.mesh.indices.buffer]))
    ;(self as unknown as Worker).postMessage({ id, result, attached } satisfies WorkerResponse, transfer as ArrayBuffer[])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse)
  }
}
