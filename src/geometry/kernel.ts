/**
 * Manifold (WASM) loader and a small allocation scope.
 *
 * Every Manifold and CrossSection lives in WASM memory and must be freed with
 * `.delete()`. Generating a case creates hundreds of temporaries, so all of
 * them go through a Scope and are freed together once the meshes have been
 * copied out to JavaScript.
 */
import Module from 'manifold-3d'
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d'
import wasmUrl from 'manifold-3d/manifold.wasm?url'

let ready: Promise<ManifoldToplevel> | null = null

export function loadKernel(): Promise<ManifoldToplevel> {
  if (!ready) {
    ready = Module({ locateFile: () => wasmUrl }).then(wasm => {
      wasm.setup()
      wasm.setMinCircularAngle(6)
      wasm.setMinCircularEdgeLength(0.6)
      return wasm
    })
  }
  return ready
}

type Deletable = Manifold | CrossSection

export class Scope {
  private items: Deletable[] = []

  keep<T extends Deletable>(item: T): T {
    this.items.push(item)
    return item
  }

  keepAll<T extends Deletable>(items: T[]): T[] {
    items.forEach(i => this.items.push(i))
    return items
  }

  dispose(): void {
    for (const item of this.items) {
      try {
        item.delete()
      } catch {
        // Already freed — a result passed back to the caller twice.
      }
    }
    this.items = []
  }
}
