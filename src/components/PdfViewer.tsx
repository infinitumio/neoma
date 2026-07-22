// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * In-app PDF viewer, lazy-loaded so pdf.js stays out of the initial bundle.
 * Renders a vault PDF (never uploaded) with continuous scrolling, a selectable
 * text layer (copy + search), thumbnails, page navigation, zoom, fit-width /
 * fit-page, rotation, fullscreen, print and download. Every page reserves its
 * height up front (via aspect-ratio) so the layout never jumps, and renders on
 * demand as it scrolls into view.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  RotateCw,
  Search,
  Printer,
  PanelLeft,
  StretchHorizontal,
  ScanLine,
  X,
} from 'lucide-react'
import { getAdapter } from '@/app/vaultStore'
import { downloadBlob } from '@/storage/import-export'
import { basename } from '@/utils/paths'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface PdfViewerProps {
  path: string
  initialPage?: number
  /** Rendered beside the pages when set (e.g. split-view toolbar button). */
  toolbarExtra?: React.ReactNode
  /** Inline in a note (constrained height, its own scroll), not a full tab. */
  inline?: boolean
}

const MAX_PAGE_WIDTH = 900
/** Absolute cap for inline embeds — must match `.pdf-inline` max-width so an
 *  embed in an auto-width container (table cell / column) can't feed its own
 *  width back into the measurement and grow without bound. */
const INLINE_MAX_WIDTH = 600

type FitMode = 'width' | 'page'

export function PdfViewer({ path, initialPage, toolbarExtra, inline }: PdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const pageTextRef = useRef<string[]>([])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [baseWidth, setBaseWidth] = useState(MAX_PAGE_WIDTH)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<FitMode>('width')
  const [rotation, setRotation] = useState(0)
  const [ratios, setRatios] = useState<number[]>([])
  const [showThumbs, setShowThumbs] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Array<{ page: number; local: number }>>([])
  const [activeMatch, setActiveMatch] = useState(0)

  const rot = ((rotation % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  // Effective aspect ratio (w/h) once rotation is applied.
  const effRatio = (i: number) => {
    const r = ratios[i] ?? 1 / 1.414
    return swap ? 1 / r : r
  }

  const displayWidth = Math.round(baseWidth * zoom)

  // Measure available space so pages fit without a manual zoom.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      if (fit === 'page') {
        const usableH = el.clientHeight - 56
        const w = usableH * effRatio(Math.max(0, page - 1))
        setBaseWidth(Math.max(240, Math.min(w, MAX_PAGE_WIDTH * 1.6)))
      } else {
        // Always cap at MAX_PAGE_WIDTH — without a cap, an embed inside a
        // shrink-to-fit container (a table cell or narrow column) feeds its own
        // width back into the measurement and grows without bound.
        const pad = inline ? 12 : 48
        const usable = Math.min(el.clientWidth - pad, inline ? INLINE_MAX_WIDTH : MAX_PAGE_WIDTH)
        setBaseWidth(Math.max(inline ? 160 : 240, usable))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, fit, rot, page, ratios])

  // Load the document and read every page's aspect ratio.
  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    setDoc(null)
    setError(null)
    setRatios([])
    pageTextRef.current = []
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

  // Jump to the initial page (e.g. from a `#page=12` link) once laid out.
  useEffect(() => {
    if (!doc || !initialPage) return
    const id = setTimeout(() => scrollToPage(scrollRef.current, initialPage), 120)
    return () => clearTimeout(id)
  }, [doc, initialPage])

  // Respond to `#page=` links that target an already-open viewer.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string; page: number }>).detail
      if (detail?.path === path) scrollToPage(scrollRef.current, detail.page)
    }
    window.addEventListener('neoma:pdf-goto', onGoto)
    return () => window.removeEventListener('neoma:pdf-goto', onGoto)
  }, [path])

  // Track fullscreen state.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }

  const openExternally = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const print = () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = url
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch {
        window.open(url, '_blank', 'noopener')
      }
      setTimeout(() => {
        iframe.remove()
        URL.revokeObjectURL(url)
      }, 60_000)
    }
    document.body.appendChild(iframe)
  }

  // Build a full-text index (lazily) and run the search.
  const runSearch = useCallback(
    async (q: string) => {
      setQuery(q)
      const needle = q.trim().toLowerCase()
      if (!doc || needle.length < 2) {
        setMatches([])
        setActiveMatch(0)
        return
      }
      // Ensure every page's text is cached.
      if (pageTextRef.current.length < doc.numPages) {
        const texts: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          const p = await doc.getPage(i)
          const content = await p.getTextContent()
          texts[i - 1] = content.items
            .map((it) => ('str' in it ? it.str : ''))
            .join(' ')
            .toLowerCase()
        }
        pageTextRef.current = texts
      }
      const found: Array<{ page: number; local: number }> = []
      pageTextRef.current.forEach((text, i) => {
        let from = 0
        let local = 0
        for (;;) {
          const at = text.indexOf(needle, from)
          if (at === -1) break
          found.push({ page: i + 1, local })
          local++
          from = at + needle.length
        }
      })
      setMatches(found)
      setActiveMatch(0)
      if (found[0]) scrollToPage(scrollRef.current, found[0].page)
    },
    [doc],
  )

  const gotoMatch = (delta: number) => {
    if (!matches.length) return
    const next = (activeMatch + delta + matches.length) % matches.length
    setActiveMatch(next)
    scrollToPage(scrollRef.current, matches[next].page)
  }

  // Which page owns the active match, and its local index on that page.
  const activeOnPage = useMemo(() => {
    const m = matches[activeMatch]
    return m ? { page: m.page, local: m.local } : null
  }, [matches, activeMatch])

  const rotate = () => setRotation((r) => (r + 90) % 360)
  const isFitWidth = fit === 'width' && Math.abs(zoom - 1) < 0.01

  // Inline embeds are sized to show exactly one page (toolbar + one page box).
  const TOOLBAR_AND_PADDING = 56
  const inlineHeight = inline
    ? Math.round(baseWidth / effRatio(0)) + TOOLBAR_AND_PADDING
    : undefined

  return (
    <div
      className={`pdf-viewer${inline ? ' pdf-viewer-inline' : ''}`}
      data-testid="pdf-viewer"
      ref={rootRef}
      style={inlineHeight ? { height: inlineHeight } : undefined}
    >
      <div className="pdf-toolbar">
        {!inline && (
          <>
            <button
              className={`icon-btn${showThumbs ? ' active' : ''}`}
              aria-label="Toggle thumbnails"
              aria-pressed={showThumbs}
              onClick={() => setShowThumbs((v) => !v)}
            >
              <PanelLeft size={16} aria-hidden />
            </button>
            <span className="pdf-toolbar-sep" />
          </>
        )}
        <div className="pdf-page-indicator" role="status" aria-live="polite">
          <input
            className="pdf-page-input"
            type="number"
            min={1}
            max={numPages || 1}
            value={page}
            aria-label="Current page"
            onChange={(e) => {
              const n = Number(e.target.value)
              if (n >= 1 && n <= numPages) scrollToPage(scrollRef.current, n)
            }}
          />
          <span className="text-faint">/ {numPages || '…'}</span>
        </div>
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
        <span className="pdf-zoom-label text-small text-faint">{Math.round(zoom * 100)}%</span>
        <button
          className="icon-btn"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
        >
          <ZoomIn size={16} aria-hidden />
        </button>
        {!inline && (
          <>
            <button
              className={`icon-btn${isFitWidth ? ' active' : ''}`}
              aria-label="Fit width"
              aria-pressed={isFitWidth}
              onClick={() => {
                setFit('width')
                setZoom(1)
              }}
            >
              <StretchHorizontal size={16} aria-hidden />
            </button>
            <button
              className={`icon-btn${fit === 'page' ? ' active' : ''}`}
              aria-label="Fit page"
              aria-pressed={fit === 'page'}
              onClick={() => {
                setFit('page')
                setZoom(1)
              }}
            >
              <ScanLine size={16} aria-hidden />
            </button>
            <button className="icon-btn" aria-label="Rotate clockwise" onClick={rotate}>
              <RotateCw size={16} aria-hidden />
            </button>
            <span className="pdf-toolbar-sep" />
            <button
              className={`icon-btn${searchOpen ? ' active' : ''}`}
              aria-label="Find in document"
              aria-pressed={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={16} aria-hidden />
            </button>
            <button className="icon-btn" aria-label="Print" onClick={print}>
              <Printer size={16} aria-hidden />
            </button>
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
            <button
              className="icon-btn"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize2 size={16} aria-hidden />
              ) : (
                <Maximize2 size={16} aria-hidden />
              )}
            </button>
            {toolbarExtra}
          </>
        )}
      </div>

      {searchOpen && (
        <div className="pdf-search">
          <Search size={14} aria-hidden />
          <input
            autoFocus
            className="pdf-search-input"
            placeholder="Find in document…"
            value={query}
            aria-label="Find in document"
            onChange={(e) => void runSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') gotoMatch(e.shiftKey ? -1 : 1)
              if (e.key === 'Escape') setSearchOpen(false)
            }}
          />
          <span className="pdf-search-count text-small text-faint">
            {matches.length ? `${activeMatch + 1} / ${matches.length}` : query.trim() ? '0 / 0' : ''}
          </span>
          <button
            className="icon-btn"
            aria-label="Previous match"
            disabled={!matches.length}
            onClick={() => gotoMatch(-1)}
          >
            <ChevronUp size={14} aria-hidden />
          </button>
          <button
            className="icon-btn"
            aria-label="Next match"
            disabled={!matches.length}
            onClick={() => gotoMatch(1)}
          >
            <ChevronDown size={14} aria-hidden />
          </button>
          <button className="icon-btn" aria-label="Close search" onClick={() => setSearchOpen(false)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <div className="pdf-body">
        {showThumbs && doc && (
          <div className="pdf-thumbs" aria-label="Page thumbnails">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfThumb
                key={i}
                doc={doc}
                pageNumber={i + 1}
                active={page === i + 1}
                ratio={ratios[i] ?? 1 / 1.414}
                onClick={() => scrollToPage(scrollRef.current, i + 1)}
              />
            ))}
          </div>
        )}

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
                ratio={effRatio(i)}
                rotation={rot}
                container={scrollRef.current}
                query={query.trim().toLowerCase()}
                activeLocal={activeOnPage?.page === i + 1 ? activeOnPage.local : -1}
                onVisible={setPage}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

interface PdfPageProps {
  doc: PDFDocumentProxy
  pageNumber: number
  width: number
  ratio: number
  rotation: number
  container: HTMLElement | null
  query: string
  activeLocal: number
  onVisible: (page: number) => void
}

function PdfPage({
  doc,
  pageNumber,
  width,
  ratio,
  rotation,
  container,
  query,
  activeLocal,
  onVisible,
}: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

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

  // Render the canvas + selectable text layer when visible.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: pdfjs.RenderTask | null = null
    setRendered(false)
    void (async () => {
      const canvas = canvasRef.current
      const textDiv = textRef.current
      if (!canvas || !textDiv) return
      const p = await doc.getPage(pageNumber)
      const dpr = window.devicePixelRatio || 1
      const base = p.getViewport({ scale: 1, rotation })
      const scale = width / base.width
      const viewport = p.getViewport({ scale: scale * dpr, rotation })
      if (cancelled) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      task = p.render({ canvasContext: ctx, viewport })
      try {
        await task.promise
      } catch {
        return
      }
      if (cancelled) return
      // Text layer at CSS scale (no dpr) for crisp, selectable text.
      textDiv.replaceChildren()
      textDiv.style.setProperty('--scale-factor', String(scale))
      const cssViewport = p.getViewport({ scale, rotation })
      const textContent = await p.getTextContent()
      if (cancelled) return
      const layer = new TextLayer({ textContentSource: textContent, container: textDiv, viewport: cssViewport })
      await layer.render()
      if (!cancelled) setRendered(true)
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, width, doc, pageNumber, rotation])

  // Highlight search matches in the rendered text layer.
  useEffect(() => {
    const textDiv = textRef.current
    if (!textDiv || !rendered) return
    highlightMatches(textDiv, query, activeLocal)
  }, [rendered, query, activeLocal])

  return (
    <div
      className="pdf-page"
      ref={wrapRef}
      data-page={pageNumber}
      style={{ width, aspectRatio: `${ratio}` }}
    >
      <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} />
      <div className="textLayer" ref={textRef} aria-hidden />
    </div>
  )
}

/** Wrap occurrences of `query` in each text span with a highlight mark. */
function highlightMatches(root: HTMLElement, query: string, activeLocal: number): void {
  const spans = root.querySelectorAll<HTMLElement>('span')
  let local = 0
  for (const span of spans) {
    const text = span.dataset.text ?? span.textContent ?? ''
    if (span.dataset.text === undefined) span.dataset.text = text
    if (!query || text.toLowerCase().indexOf(query) === -1) {
      if (span.dataset.text !== undefined && span.querySelector('mark')) span.textContent = text
      continue
    }
    const lower = text.toLowerCase()
    const frag = document.createDocumentFragment()
    let from = 0
    for (;;) {
      const at = lower.indexOf(query, from)
      if (at === -1) break
      frag.append(text.slice(from, at))
      const mark = document.createElement('mark')
      mark.className = 'pdf-hl'
      mark.textContent = text.slice(at, at + query.length)
      if (local === activeLocal) {
        mark.classList.add('active')
        setTimeout(() => mark.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0)
      }
      frag.append(mark)
      local++
      from = at + query.length
    }
    frag.append(text.slice(from))
    span.replaceChildren(frag)
  }
}

interface PdfThumbProps {
  doc: PDFDocumentProxy
  pageNumber: number
  active: boolean
  ratio: number
  onClick: () => void
}

function PdfThumb({ doc, pageNumber, active, ratio, onClick }: PdfThumbProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible(true),
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void (async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const p = await doc.getPage(pageNumber)
      const scale = 120 / p.getViewport({ scale: 1 }).width
      const viewport = p.getViewport({ scale })
      if (cancelled) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      try {
        await p.render({ canvasContext: ctx, viewport }).promise
      } catch {
        /* cancelled */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, doc, pageNumber])

  // Keep the active thumbnail in view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button
      ref={ref}
      className={`pdf-thumb${active ? ' active' : ''}`}
      onClick={onClick}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={active}
    >
      <span className="pdf-thumb-canvas" style={{ aspectRatio: `${ratio}` }}>
        <canvas ref={canvasRef} />
      </span>
      <span className="pdf-thumb-num">{pageNumber}</span>
    </button>
  )
}

function scrollToPage(container: HTMLElement | null, target: number): void {
  if (!container || target < 1) return
  const el = container.querySelector<HTMLElement>(`.pdf-page[data-page="${target}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
