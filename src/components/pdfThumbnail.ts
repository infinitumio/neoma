// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * First-page thumbnail generation for PDF preview cards. pdf.js is imported
 * dynamically so it stays out of the initial bundle and only loads when a
 * note actually references a PDF. Results are cached per vault path.
 */
import { getAdapter } from '@/app/vaultStore'

const cache = new Map<string, string>()

export async function pdfThumbnail(path: string, width = 160): Promise<string | null> {
  if (cache.has(path)) return cache.get(path)!
  const adapter = getAdapter()
  if (!adapter) return null
  try {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const blob = await adapter.readBinary(path)
    const data = new Uint8Array(await blob.arrayBuffer())
    const doc = await pdfjs.getDocument({ data }).promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = width / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await page.render({ canvasContext: ctx, viewport }).promise
    const url = canvas.toDataURL('image/png')
    doc.destroy()
    cache.set(path, url)
    return url
  } catch {
    return null
  }
}
