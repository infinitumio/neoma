// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rendered markdown preview (reading view and split preview). Handles wiki
 * link navigation, tag clicks, and resolves vault-relative images/embeds to
 * blob URLs through the storage adapter — never via the network.
 */
import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '@/markdown/render'
import { getAdapter, getLinkGraph, useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { openNoteByTarget } from '@/app/navigation'
import { pdfThumbnail } from './pdfThumbnail'
import { basename, dirname, isImage, isPdf, joinPath, normalizePath } from '@/utils/paths'
import 'katex/dist/katex.min.css'

interface PreviewProps {
  path: string
  content: string
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
        embed.replaceWith(makePdfCard(getLinkGraph().resolve(target, path) ?? target, target))
      }
    }
    // PDF links (`[label](file.pdf)`) also get a preview card.
    for (const link of container.querySelectorAll<HTMLElement>('a[data-internal]')) {
      const internal = decodeURIComponent(link.dataset.internal ?? '')
      if (!isPdf(internal)) continue
      link.replaceWith(makePdfCard(getLinkGraph().resolve(internal, path) ?? internal, internal))
    }
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
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
      if (name) void openNoteByTarget(name, target.dataset.heading)
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
      if (isPdf(internal)) {
        const resolved = getLinkGraph().resolve(internal, path) ?? internal
        useTabs.getState().openPdf(resolved)
        return
      }
      const resolved = getLinkGraph().resolve(internal.replace(/\.md$/i, ''), path)
      if (resolved) useTabs.getState().openNote(resolved)
    }
  }

  return (
    <div
      className="preview-pane print-area"
      ref={containerRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="preview-content markdown-body"
        // Safe: the pipeline never passes raw HTML through (no rehype-raw).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
