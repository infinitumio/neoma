// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * In-app PDF viewer, lazy-loaded so pdf.js stays out of the initial bundle.
 * Renders the document from the vault (never uploaded) with continuous
 * scrolling, page navigation, zoom, fit-to-width and a current-page
 * indicator. Every page reserves its correct height up front (via
 * aspect-ratio) so the layout never jumps, and renders on demand as it
 * scrolls into view. One measured display width drives all pages, so zoom
 * and fit-width stay consistent.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  ExternalLink,
} from 'lucide-react'
import { getAdapter } from '@/app/vaultStore'
import { downloadBlob } from '@/storage/import-export'
import { basename } from '@/utils/paths'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface PdfViewerProps {
  path: string
}

const MAX_PAGE_WIDTH = 900

export function PdfViewer({ path }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [baseWidth, setBaseWidth] = useState(MAX_PAGE_WIDTH)
  const [zoom, setZoom] = useState(1)
  /** aspect ratios (w/h) per page, filled in as pages load */
  const [ratios, setRatios] = useState<number[]>([])

  const displayWidth = Math.round(baseWidth * zoom)

  // Measure the available width so pages fit without a manual zoom.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const usable = Math.min(el.clientWidth - 48, MAX_PAGE_WIDTH)
      setBaseWidth(Math.max(240, usable))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

  // Load the document from the vault and read every page's aspect ratio.
  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    setDoc(null)
    setError(null)
    setRatios([])
    const adapter = getAdapter()
    if (!adapter) return
    void (async () => {
      try {
        const blob = await adapter.readBinary(path)
        blobRef.current = blob
        const data = new Uint8Array(await blob.arrayBuffer())
        loaded = await pdfjs.getDocument({ data }).promise
        if (cancelled) {
          loaded.destroy()
          return
        }
        setDoc(loaded)
        setNumPages(loaded.numPages)
        // Reserve correct height for every page before rendering.
        const collected: number[] = []
        for (let i = 1; i <= loaded.numPages; i++) {
          const p = await loaded.getPage(i)
          const vp = p.getViewport({ scale: 1 })
          collected[i - 1] = vp.width / vp.height
          if (cancelled) return
          if (i === 1 || i % 8 === 0) setRatios([...collected])
        }
        if (!cancelled) setRatios(collected)
      } catch {
        if (!cancelled) setError('This PDF could not be opened.')
      }
    })()
    return () => {
      cancelled = true
      loaded?.destroy()
    }
  }, [path])

  const openExternally = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="pdf-viewer" data-testid="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-page-indicator" role="status" aria-live="polite">
          Page {page} / {numPages || '…'}
        </span>
        <button
          className="icon-btn"
          aria-label="Previous page"
          onClick={() => scrollToPage(scrollRef.current, page - 1)}
        >
          <ChevronUp size={16} aria-hidden />
        </button>
        <button
          className="icon-btn"
          aria-label="Next page"
          onClick={() => scrollToPage(scrollRef.current, page + 1)}
        >
          <ChevronDown size={16} aria-hidden />
        </button>
        <span className="pdf-toolbar-sep" />
        <button
          className="icon-btn"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}
        >
          <ZoomOut size={16} aria-hidden />
        </button>
        <button
          className={`icon-btn${Math.abs(zoom - 1) < 0.01 ? ' active' : ''}`}
          aria-label="Fit width"
          aria-pressed={Math.abs(zoom - 1) < 0.01}
          onClick={() => setZoom(1)}
        >
          <Maximize2 size={16} aria-hidden />
        </button>
        <button
          className="icon-btn"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
        >
          <ZoomIn size={16} aria-hidden />
        </button>
        <span className="pdf-zoom-label text-small text-faint">{Math.round(zoom * 100)}%</span>
        <span className="pdf-toolbar-sep" />
        <button
          className="icon-btn"
          aria-label="Download PDF"
          onClick={() => blobRef.current && downloadBlob(blobRef.current, basename(path))}
        >
          <Download size={16} aria-hidden />
        </button>
        <button className="icon-btn" aria-label="Open in new window" onClick={openExternally}>
          <ExternalLink size={16} aria-hidden />
        </button>
      </div>

      <div className="pdf-pages" ref={scrollRef}>
        {error && (
          <div className="empty-state" role="alert">
            <p>{error}</p>
            <button
              className="btn"
              onClick={() => blobRef.current && downloadBlob(blobRef.current, basename(path))}
            >
              Download instead
            </button>
          </div>
        )}
        {!doc && !error && (
          <div className="empty-state" aria-busy="true">
            <p>Loading PDF…</p>
          </div>
        )}
        {doc &&
          Array.from({ length: numPages }, (_, i) => (
            <PdfPage
              key={i}
              doc={doc}
              pageNumber={i + 1}
              width={displayWidth}
              ratio={ratios[i] ?? 1 / 1.414}
              container={scrollRef.current}
              onVisible={setPage}
            />
          ))}
      </div>
    </div>
  )
}

interface PdfPageProps {
  doc: PDFDocumentProxy
  pageNumber: number
  width: number
  ratio: number
  container: HTMLElement | null
  onVisible: (page: number) => void
}

function PdfPage({ doc, pageNumber, width, ratio, container, onVisible }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  // Track whether the page is near the viewport (render on demand).
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            onVisible(pageNumber)
          }
        }
      },
      { root: container, rootMargin: '800px 0px' },
    )
    io.observe(wrap)
    return () => io.disconnect()
  }, [container, pageNumber, onVisible])

  // Render (or re-render on width change) when visible.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: pdfjs.RenderTask | null = null
    void (async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const p = await doc.getPage(pageNumber)
      const dpr = window.devicePixelRatio || 1
      const scale = width / p.getViewport({ scale: 1 }).width
      const viewport = p.getViewport({ scale: scale * dpr })
      if (cancelled) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      task = p.render({ canvasContext: ctx, viewport })
      try {
        await task.promise
      } catch {
        /* cancelled render */
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, width, doc, pageNumber])

  return (
    <div
      className="pdf-page"
      ref={wrapRef}
      data-page={pageNumber}
      style={{ width, aspectRatio: `${ratio}` }}
    >
      <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} />
    </div>
  )
}

function scrollToPage(container: HTMLElement | null, target: number): void {
  if (!container || target < 1) return
  const el = container.querySelector<HTMLElement>(`.pdf-page[data-page="${target}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
