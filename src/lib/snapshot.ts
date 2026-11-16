/**
 * Snapshots of the Workshop's 3D view. The canvas keeps its drawing buffer,
 * so the last frame can be read back as an image.
 */
export function viewportCanvas(): HTMLCanvasElement | null {
  return document.querySelector('main canvas')
}

export function snapshotPng(): string | null {
  return viewportCanvas()?.toDataURL('image/png') ?? null
}

/** A JPEG no larger than `max` px on its long side, for the DeckID photo. */
export function snapshotJpeg(max = 1200): string | null {
  const src = viewportCanvas()
  if (!src) return null
  const scale = Math.min(1, max / Math.max(src.width, src.height))
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * scale)
  c.height = Math.round(src.height * scale)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}
