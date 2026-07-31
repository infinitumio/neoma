// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Local mini-graph for the active note, docked in the right sidebar next to
 * Outline and Backlinks. Shows the current note plus its immediate neighbours
 * (outgoing links and backlinks) and the links between them. Auto-fits, so it
 * needs no pan/zoom controls. Click a node to open it.
 */
import { useEffect, useMemo, useRef } from 'react'
import { getEntryColor, getLinkGraph, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useActiveNotePath } from '@/components/panels/BacklinksPanel'
import { createSimulation, type GraphEdge, type GraphNode } from './forceLayout'
import { folderColor, pageColorHex, type PageColor } from '@/utils/colors'
import { stem } from '@/utils/paths'

export function MiniGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const metaVersion = useVault((s) => s.metaVersion)
  const activePath = useActiveNotePath()
  const openNote = useTabs((s) => s.openNote)

  const { nodes, edges } = useMemo(() => {
    void metaVersion
    if (!activePath) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
    const graph = getLinkGraph()

    const neighbours = new Set<string>()
    for (const { resolved } of graph.outgoing(activePath)) if (resolved) neighbours.add(resolved)
    for (const { meta } of graph.backlinkSources(activePath)) neighbours.add(meta.path)
    neighbours.delete(activePath)

    const paths = [activePath, ...neighbours]
    const topFolder = (p: string) => (p.includes('/') ? p.split('/')[0] : '')
    const index = new Map<string, number>()
    const nodes: GraphNode[] = paths.map((p, i) => {
      index.set(p, i)
      return {
        id: p,
        label: graph.get(p)?.title ?? stem(p),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        degree: 0,
        color: getEntryColor(p) ?? folderColor(topFolder(p)),
      }
    })

    const edges: GraphEdge[] = []
    const seen = new Set<string>()
    for (const p of paths) {
      for (const { resolved } of graph.outgoing(p)) {
        if (resolved && index.has(resolved) && resolved !== p) {
          const s = index.get(p)!
          const t = index.get(resolved)!
          const key = s < t ? `${s}-${t}` : `${t}-${s}`
          if (!seen.has(key)) {
            seen.add(key)
            edges.push({ source: s, target: t })
          }
        }
      }
    }
    for (const e of edges) {
      nodes[e.source].degree++
      nodes[e.target].degree++
    }
    return { nodes, edges }
  }, [metaVersion, activePath])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    const simulation = createSimulation(nodes, edges)
    let raf = 0
    let disposed = false
    let needsRender = true
    // Last fit transform, kept for click hit-testing.
    let fit = { cx: 0, cy: 0, scale: 1 }

    const css = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, rect.width * dpr)
      canvas.height = Math.max(1, rect.height * dpr)
      needsRender = true
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      // Auto-fit the whole neighbourhood into the panel.
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const n of simulation.nodes) {
        minX = Math.min(minX, n.x)
        minY = Math.min(minY, n.y)
        maxX = Math.max(maxX, n.x)
        maxY = Math.max(maxY, n.y)
      }
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const pad = 28
      const scale = Math.min(
        (width - pad) / (maxX - minX + 1),
        (height - pad) / (maxY - minY + 1),
        2.2,
      )
      fit = { cx, cy, scale }

      context.save()
      context.translate(width / 2, height / 2)
      context.scale(scale, scale)
      context.translate(-cx, -cy)

      context.strokeStyle = css('--color-border-strong') || '#364039'
      context.lineWidth = 1 / scale
      context.globalAlpha = 0.7
      context.beginPath()
      for (const edge of simulation.edges) {
        const a = simulation.nodes[edge.source]
        const b = simulation.nodes[edge.target]
        context.moveTo(a.x, a.y)
        context.lineTo(b.x, b.y)
      }
      context.stroke()
      context.globalAlpha = 1

      const accent = css('--color-accent') || '#4ade80'
      for (const node of simulation.nodes) {
        const isCurrent = node.id === activePath
        const radius = (isCurrent ? 6 : 4) + Math.min(node.degree, 6) * 0.5
        context.beginPath()
        context.arc(node.x, node.y, radius, 0, Math.PI * 2)
        context.fillStyle = isCurrent
          ? accent
          : node.color
            ? pageColorHex(node.color as PageColor)
            : css('--color-text-secondary') || '#98a39d'
        context.fill()
      }

      // Labels stay upright and readable at the fitted scale.
      context.fillStyle = css('--color-text') || '#ece9e2'
      context.textAlign = 'center'
      context.font = `${10 / scale}px ${css('--font-ui') || 'sans-serif'}`
      for (const node of simulation.nodes) {
        const isCurrent = node.id === activePath
        if (isCurrent || simulation.nodes.length <= 12) {
          context.fillText(node.label, node.x, node.y - 8 / scale - Math.min(node.degree, 6) * 0.5)
        }
      }
      context.restore()
    }

    const loop = () => {
      if (disposed) return
      const moved = simulation.tick()
      if (moved || needsRender) {
        render()
        needsRender = false
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      // Invert the fit transform to graph space.
      const px = (event.clientX - rect.left - rect.width / 2) / fit.scale + fit.cx
      const py = (event.clientY - rect.top - rect.height / 2) / fit.scale + fit.cy
      let best: GraphNode | null = null
      let bestD = 14 / fit.scale
      for (const node of simulation.nodes) {
        const d = Math.hypot(node.x - px, node.y - py)
        if (d < bestD) {
          best = node
          bestD = d
        }
      }
      if (best && best.id !== activePath) openNote(best.id)
    }
    canvas.addEventListener('click', onClick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('click', onClick)
    }
  }, [nodes, edges, activePath, openNote])

  if (!activePath) {
    return <p className="text-small text-faint">Open a note to see its local map.</p>
  }
  if (nodes.length <= 1) {
    return <p className="text-small text-faint">This note has no links yet.</p>
  }
  return (
    <div className="mini-graph">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Local graph of the current note. Click a node to open it."
      />
    </div>
  )
}
