/**
 * Schema migrations. Every imported or loaded build passes through here, so
 * a file saved by an old version of the app keeps opening in a new one.
 *
 * To add a version: bump SCHEMA_VERSION in schema.ts, then add a step
 * `if (v === N) { ...transform...; v = N + 1 }` below.
 */
import { Build, SCHEMA_VERSION } from './schema'

export function migrate(raw: unknown): { build: Build | null; error?: string } {
  if (!raw || typeof raw !== 'object') return { build: null, error: 'Not a build object.' }
  const obj = { ...(raw as Record<string, unknown>) }
  let v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0
  if (v > SCHEMA_VERSION) return { build: null, error: `This build was made with a newer version of Cyberdeck Builder (schema ${v}).` }
  if (v === 0) {
    obj.schemaVersion = 1
    v = 1
  }
  // 1 → 2: case shape (cornerStyle, bevel), hinge, closure, slider accessory.
  // Every new field has a default, so the schema fills them in.
  if (v === 1) {
    obj.schemaVersion = 2
    v = 2
  }
  // 2 → 3: custom components carried in the build (defaults to none).
  if (v === 2) {
    obj.schemaVersion = 3
    v = 3
  }
  const parsed = Build.safeParse(obj)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { build: null, error: `Invalid build: ${first.path.join('.')} — ${first.message}` }
  }
  return { build: parsed.data }
}
