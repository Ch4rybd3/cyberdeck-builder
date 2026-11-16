/**
 * Geometry worker: runs the case generator off the main thread so dragging a
 * component or typing a dimension never stalls the interface.
 */
import type { Build } from '../domain/schema'
import { generateCase, type GeometryResult } from './caseBuilder'
import { loadKernel } from './kernel'

export type WorkerRequest = { id: number; build: Build }
export type WorkerResponse = { id: number; result?: GeometryResult; error?: string }

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, build } = e.data
  try {
    const wasm = await loadKernel()
    const result = generateCase(wasm, build)
    // Hand the mesh buffers over instead of copying them.
    const transfer = result.pieces.flatMap(p => p.bodies.flatMap(b => [b.mesh.positions.buffer, b.mesh.indices.buffer]))
    ;(self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse, transfer as ArrayBuffer[])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse)
  }
}
