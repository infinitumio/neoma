// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rendered markdown preview (reading view and split preview). Handles wiki
 * link navigation, tag clicks, and resolves vault-relative images/embeds to
 * blob URLs through the storage adapter — never via the network.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderMarkdown } from '@/markdown/render'
import { getAdapter, getLinkGraph, updateNoteContent, useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { openNoteByTarget } from '@/app/navigation'
import { pdfThumbnail } from './pdfThumbnail'
import { basename, dirname, isImage, isPdf, joinPath, normalizePath } from '@/utils/paths'
import { isTaskCheckbox, isTasksHeading } from '@/tasks/tasks'
import 'katex/dist/katex.min.css'

// Lazy so pdf.js stays out of the initial bundle; embeds render it inline.
const PdfViewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })))

interface PreviewProps {
  path: string
  content: string
}

/** Matches a GFM task-list marker at the start of a list item. */
const TASK_MARKER_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm

/** Toggle the checked state of the nth task-list item in the markdown. */
export function toggleTaskInMarkdown(content: string, index: number): string {
  let i = 0
  return content.replace(TASK_MARKER_RE, (full, prefix: string, mark: string) => {
    if (i++ !== index) return full
    return `${prefix}[${mark === ' ' ? 'x' : ' '}]`
  })
}

/** The nearest heading preceding an element's (top-level) list, for deciding
 *  whether checkboxes sit under a "Tasks"/"To-do" heading. */
function nearestHeadingText(el: Element): string {
  let list: Element | null = el.closest('ul, ol')
  while (list?.parentElement?.closest('ul, ol')) list = list.parentElement.closest('ul, ol')
  let sib = list?.previousElementSibling ?? null
  while (sib) {
    if (/^H[1-6]$/.test(sib.tagName)) return sib.textContent ?? ''
    sib = sib.previousElementSibling
  }
  return ''
}

/** Extract a YouTube video id from common URL shapes, or null. */
export function youtubeId(url: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(
      url,
    )
  return m ? m[1] : null
}

/** Split a PDF reference like `lecture.pdf#page=12` into its path and page. */
export function parsePdfRef(ref: string): { path: string; page?: number } {
  const match = /^(.*?)#page=(\d+)$/i.exec(ref)
  if (match) return { path: match[1], page: Number(match[2]) }
  return { path: ref }
}

/** Build a PDF preview card that opens the in-app viewer, with a lazily
 *  rendered first-page thumbnail. */
function makePdfCard(resolvedPath: string, label: string): HTMLButtonElement {
  const card = document.createElement('button')
  card.className = 'pdf-embed-card'
  card.type = 'button'
  card.dataset.pdf = resolvedPath
  const thumb = document.createElement('span')
  thumb.className = 'pdf-embed-thumb'
  const body = document.createElement('span')
  body.className = 'pdf-embed-body'
  body.innerHTML = `<span class="pdf-embed-name"><span class="pdf-embed-icon">PDF</span>${basename(
    label,
  )}</span><span class="pdf-embed-hint">Open in viewer</span>`
  card.append(thumb, body)
  void pdfThumbnail(resolvedPath).then((url) => {
    if (url) thumb.style.backgroundImage = `url(${url})`
    else thumb.classList.add('pdf-embed-thumb-empty')
  })
  return card
}

export function Preview({ path, content }: PreviewProps) {
  const [html, setHtml] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const metaVersion = useVault((s) => s.metaVersion)

  useEffect(() => {
    let cancelled = false
    void renderMarkdown(content, {
      resolveLink: (target) => getLinkGraph().resolve(target, path),
    }).then((rendered) => {
      if (!cancelled) setHtml(rendered)
    })
    return () => {
      cancelled = true
    }
  }, [content, path, metaVersion])

  // Resolve local images to blob URLs after each render.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const urls: string[] = []
    const roots: Root[] = []
    const adapter = getAdapter()
    if (!adapter) return

    const resolveTo = async (raw: string): Promise<string | null> => {
      const clean = normalizePath(decodeURIComponent(raw))
      for (const candidate of [clean, joinPath(dirname(path), clean)]) {
        try {
          const blob = await adapter.readBinary(candidate)
          const url = URL.createObjectURL(blob)
          urls.push(url)
          return url
        } catch {
          // try next candidate
        }
      }
      return null
    }

    for (const img of container.querySelectorAll<HTMLImageElement>('img')) {
      const src = img.getAttribute('src') ?? ''
      if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('blob:')) continue
      void resolveTo(src).then((url) => {
        if (url) img.src = url
        else img.alt = `Missing attachment: ${src}`
      })
    }
    for (const embed of container.querySelectorAll<HTMLElement>('.embed[data-embed]')) {
      const target = embed.dataset.embed ?? ''
      if (isImage(target)) {
        void resolveTo(target).then((url) => {
          if (!url) return
          const img = document.createElement('img')
          img.src = url
          img.alt = target
          img.className = 'embed-image'
          embed.replaceWith(img)
        })
      } else if (isPdf(target)) {
        // An embed shows the PDF inline, scrollable, in the reading view.
        const resolved = getLinkGraph().resolve(target, path) ?? target
        const host = document.createElement('div')
        host.className = 'pdf-inline'
        embed.replaceWith(host)
        const root = createRoot(host)
        root.render(
          <Suspense fallback={<div className="pdf-inline-loading">Loading PDF…</div>}>
            <PdfViewer path={resolved} inline />
          </Suspense>,
        )
        roots.push(root)
      }
    }
    // PDF links (`[label](file.pdf)`) get a preview card that opens the viewer.
    for (const link of container.querySelectorAll<HTMLElement>('a[data-internal]')) {
      const internal = decodeURIComponent(link.dataset.internal ?? '')
      if (!isPdf(internal)) continue
      link.replaceWith(makePdfCard(getLinkGraph().resolve(internal, path) ?? internal, internal))
    }
    // Calendar references render as chips: dates (`[[2026-07-25]]`) and links to
    // event/exam pages get a small icon and pill styling.
    for (const link of container.querySelectorAll<HTMLElement>('a.wiki-link')) {
      const target = link.dataset.target ?? ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(target)) {
        link.classList.add('cal-ref', 'cal-ref-date')
        continue
      }
      const resolved = link.dataset.resolved
      const type = resolved ? useVault.getState().metas.get(resolved)?.frontmatter?.type : undefined
      if (type === 'event') link.classList.add('cal-ref', 'cal-ref-event')
      else if (type === 'exam') link.classList.add('cal-ref', 'cal-ref-exam')
    }
    // YouTube links become a responsive inline player (loads only when online).
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const id = youtubeId(link.getAttribute('href') ?? '')
      if (!id) continue
      const figure = document.createElement('figure')
      figure.className = 'youtube-embed'
      const frame = document.createElement('iframe')
      frame.src = `https://www.youtube-nocookie.com/embed/${id}`
      frame.title = link.textContent?.trim() || 'YouTube video'
      frame.allow =
        'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
      frame.allowFullscreen = true
      frame.loading = 'lazy'
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      figure.appendChild(frame)
      const caption = link.textContent?.trim()
      if (caption && !/^https?:/i.test(caption)) {
        const figcaption = document.createElement('figcaption')
        figcaption.textContent = caption
        figure.appendChild(figcaption)
      }
      link.replaceWith(figure)
    }
    // Make task-list checkboxes tickable (GFM renders them disabled) and index
    // them in document order so a click maps back to the right source line.
    container
      .querySelectorAll<HTMLInputElement>('li.task-list-item input[type="checkbox"]')
      .forEach((box, i) => {
        box.disabled = false
        box.dataset.taskIndex = String(i)
        // Mark real "tasks" (metadata, or under a Tasks/To-do heading) so they
        // read differently from plain checklist items.
        const li = box.closest('li.task-list-item')
        if (li && (isTaskCheckbox(li.textContent ?? '') || isTasksHeading(nearestHeadingText(li))))
          li.classList.add('is-task')
      })
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      // Unmount inline viewers asynchronously (can't unmount during render).
      const toUnmount = roots.slice()
      setTimeout(() => toUnmount.forEach((r) => r.unmount()), 0)
    }
  }, [html, path])

  // Double-click a rendered equation to copy its LaTeX source (KaTeX keeps
  // the original TeX in an <annotation> element).
  const onDoubleClick = (event: React.MouseEvent) => {
    const katexEl = (event.target as HTMLElement).closest('.katex')
    if (!katexEl) return
    const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
    const tex = annotation?.textContent
    if (tex) {
      void navigator.clipboard
        .writeText(tex)
        .then(() => useUi.getState().toast('Equation LaTeX copied', 'success'))
        .catch(() => useUi.getState().toast('Could not copy equation', 'error'))
    }
  }

  const onClick = (event: React.MouseEvent) => {
    // Task-list checkbox → toggle the matching `- [ ]` in the source.
    const box = (event.target as HTMLElement).closest<HTMLInputElement>(
      'li.task-list-item input[type="checkbox"]',
    )
    if (box?.dataset.taskIndex !== undefined) {
      const index = Number(box.dataset.taskIndex)
      const next = toggleTaskInMarkdown(content, index)
      if (next !== content) updateNoteContent(path, next)
      return
    }
    // Flashcard → flip to reveal the answer.
    const card = (event.target as HTMLElement).closest<HTMLElement>('.flashcard-embed')
    if (card) {
      card.classList.toggle('flipped')
      return
    }
    // Embedded-PDF card → open the in-app viewer.
    const pdfCard = (event.target as HTMLElement).closest<HTMLElement>('.pdf-embed-card')
    if (pdfCard?.dataset.pdf) {
      event.preventDefault()
      useTabs.getState().openPdf(pdfCard.dataset.pdf)
      return
    }
    const target = (event.target as HTMLElement).closest('a')
    if (!target) return
    if (target.classList.contains('wiki-link')) {
      event.preventDefault()
      const name = target.dataset.resolved ?? target.dataset.target
      if (!name) return
      // `[[lecture.pdf#page=12]]` → open the PDF at that page.
      if (isPdf(name)) {
        const resolved = getLinkGraph().resolve(name, path) ?? name
        const heading = target.dataset.heading
        const page = heading ? parsePdfRef(`x#${heading}`).page : undefined
        useTabs.getState().openPdf(resolved, { page })
        return
      }
      void openNoteByTarget(name, target.dataset.heading)
    } else if (target.classList.contains('tag')) {
      event.preventDefault()
      const tag = target.dataset.tag
      if (tag) {
        useUi.getState().setSidePanel('search')
        window.dispatchEvent(new CustomEvent('neoma:search', { detail: `tag:${tag}` }))
      }
    } else if (target.dataset.internal) {
      event.preventDefault()
      const internal = decodeURIComponent(target.dataset.internal)
      const { path: refPath, page } = parsePdfRef(internal)
      if (isPdf(refPath)) {
        const resolved = getLinkGraph().resolve(refPath, path) ?? refPath
        useTabs.getState().openPdf(resolved, { page })
        return
      }
      const resolved = getLinkGraph().resolve(internal.replace(/\.md$/i, ''), path)
      if (resolved) useTabs.getState().openNote(resolved)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const card = (event.target as HTMLElement).closest<HTMLElement>('.flashcard-embed')
    if (card) {
      event.preventDefault()
      card.classList.toggle('flipped')
    }
  }

  return (
    <div
      className="preview-pane print-area"
      ref={containerRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <div
        className="preview-content markdown-body"
        // Safe: the pipeline never passes raw HTML through (no rehype-raw).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
