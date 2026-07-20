// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Graph view: relationships between notes on a canvas. Lazy-loaded so it
 * never affects the initial bundle. Supports local/whole-vault scope, zoom,
 * pan, node selection, search, orphan hiding, folder/tag filters and depth
 * limits. The graph is a secondary view — kept simple and fast.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { getLinkGraph, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useActiveNotePath } from '@/components/panels/BacklinksPanel'
import { createSimulation, type GraphEdge, type GraphNode } from './forceLayout'
import { isWithin } from '@/utils/paths'

interface ViewTransform {
  x: number
  y: number
  scale: number
}

export default function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const metaVersion = useVault((s) => s.metaVersion)
  const activePath = useActiveNotePath()
  const openNote = useTabs((s) => s.openNote)

  const [scope, setScope] = useState<'vault' | 'local'>('vault')
  const [depth, setDepth] = useState(2)
  const [hideOrphans, setHideOrphans] = useState(false)
  const [folderFilter, setFolderFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => {
    void metaVersion
    const graph = getLinkGraph()
    let metas = graph.all()
    if (folderFilter) metas = metas.filter((m) => isWithin(folderFilter, m.path))
    if (tagFilter) {
      const tag = tagFilter.replace(/^#/, '')
      metas = metas.filter((m) => m.tags.some((t) => t === tag || t.startsWith(tag + '/')))
    }

    const included = new Set(metas.map((m) => m.path))
    const edgePairs: Array<[string, string]> = []
    for (const meta of metas) {
      for (const { resolved } of graph.outgoing(meta.path)) {
        if (resolved && included.has(resolved) && resolved !== meta.path) {
          edgePairs.push([meta.path, resolved])
        }
      }
    }

    if (scope === 'local' && activePath && included.has(activePath)) {
      // Breadth-first expansion from the active note up to `depth`.
      const adjacent = new Map<string, Set<string>>()
      for (const [a, b] of edgePairs) {
        if (!adjacent.has(a)) adjacent.set(a, new Set())
        if (!adjacent.has(b)) adjacent.set(b, new Set())
        adjacent.get(a)!.add(b)
        adjacent.get(b)!.add(a)
      }
      const keep = new Set([activePath])
      let frontier = [activePath]
      for (let level = 0; level < depth; level++) {
        const next: string[] = []
        for (const path of frontier) {
          for (const neighbour of adjacent.get(path) ?? []) {
            if (!keep.has(neighbour)) {
              keep.add(neighbour)
              next.push(neighbour)
            }
          }
        }
        frontier = next
      }
      metas = metas.filter((m) => keep.has(m.path))
    }

    const degree = new Map<string, number>()
    for (const [a, b] of edgePairs) {
      degree.set(a, (degree.get(a) ?? 0) + 1)
      degree.set(b, (degree.get(b) ?? 0) + 1)
    }
    if (hideOrphans) metas = metas.filter((m) => (degree.get(m.path) ?? 0) > 0)

    const index = new Map<string, number>()
    const nodes: GraphNode[] = metas.map((meta, i) => {
      index.set(meta.path, i)
      return {
        id: meta.path,
        label: meta.title,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        degree: degree.get(meta.path) ?? 0,
      }
    })
    const edges: GraphEdge[] = []
    const seen = new Set<string>()
    for (const [a, b] of edgePairs) {
      const source = index.get(a)
      const target = index.get(b)
      if (source === undefined || target === undefined) continue
      const key = source < target ? `${source}-${target}` : `${target}-${source}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source, target })
    }
    return { nodes, edges }
  }, [metaVersion, scope, depth, hideOrphans, folderFilter, tagFilter, activePath])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const simulation = createSimulation(nodes, edges)
    const view: ViewTransform = { x: 0, y: 0, scale: 1 }
    let raf = 0
    let dragging: { kind: 'pan'; startX: number; startY: number } | null = null
    let disposed = false
    let needsRender = true
    let hoveredId: string | null = null

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

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const cx = clientX - rect.left - rect.width / 2
      const cy = clientY - rect.top - rect.height / 2
      return { x: (cx - view.x) / view.scale, y: (cy - view.y) / view.scale }
    }

    const nodeAt = (clientX: number, clientY: number): GraphNode | null => {
      const point = toWorld(clientX, clientY)
      let best: GraphNode | null = null
      let bestDistance = 12 / view.scale
      for (const node of simulation.nodes) {
        const d = Math.hypot(node.x - point.x, node.y - point.y)
        if (d < bestDistance + 3 + Math.min(node.degree, 6)) {
          best = node
          bestDistance = d
        }
      }
      return best
    }

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.save()
      context.translate(width / 2 + view.x, height / 2 + view.y)
      context.scale(view.scale, view.scale)

      context.strokeStyle = css('--color-border-strong') || '#364039'
      context.lineWidth = 1 / view.scale
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
      const nodeColor = css('--color-text-secondary') || '#98a39d'
      const q = query.trim().toLowerCase()
      for (const node of simulation.nodes) {
        const radius = 3.5 + Math.min(node.degree, 8) * 0.8
        const isActive = node.id === activePath
        const matches = q && node.label.toLowerCase().includes(q)
        context.beginPath()
        context.arc(node.x, node.y, radius, 0, Math.PI * 2)
        context.fillStyle = isActive || matches || node.id === hoveredId ? accent : nodeColor
        context.fill()
      }

      // Labels: hovered node always; all nodes when zoomed in.
      context.fillStyle = css('--color-text') || '#ece9e2'
      context.font = `${11 / view.scale}px ${css('--font-ui') || 'sans-serif'}`
      context.textAlign = 'center'
      for (const node of simulation.nodes) {
        if (
          node.id === hoveredId ||
          view.scale > 1.4 ||
          (q && node.label.toLowerCase().includes(q))
        ) {
          context.fillText(node.label, node.x, node.y - 8 - Math.min(node.degree, 8) * 0.8)
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

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = Math.exp(-event.deltaY * 0.0012)
      view.scale = Math.min(4, Math.max(0.2, view.scale * factor))
      needsRender = true
    }
    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId)
      dragging = { kind: 'pan', startX: event.clientX - view.x, startY: event.clientY - view.y }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        view.x = event.clientX - dragging.startX
        view.y = event.clientY - dragging.startY
        needsRender = true
        return
      }
      const node = nodeAt(event.clientX, event.clientY)
      const id = node?.id ?? null
      if (id !== hoveredId) {
        hoveredId = id
        setHovered(id)
        canvas.style.cursor = id ? 'pointer' : 'grab'
        needsRender = true
      }
    }
    const onPointerUp = (event: PointerEvent) => {
      const wasDrag =
        dragging &&
        (Math.abs(event.clientX - (dragging.startX + view.x)) > 4 ||
          Math.abs(event.clientY - (dragging.startY + view.y)) > 4)
      dragging = null
      if (!wasDrag) {
        const node = nodeAt(event.clientX, event.clientY)
        if (node) openNote(node.id)
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [nodes, edges, query, activePath, openNote])

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const entry of useVault.getState().entries.values()) {
      if (entry.kind === 'folder') set.add(entry.path)
    }
    return [...set].sort()
  }, [metaVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="graph-view" data-testid="graph-view">
      <canvas ref={canvasRef} role="img" aria-label="Note graph. Click a node to open the note." />
      <div className="graph-toolbar">
        <select
          className="input"
          style={{ width: 'auto' }}
          value={scope}
          aria-label="Graph scope"
          onChange={(e) => setScope(e.target.value as 'vault' | 'local')}
        >
          <option value="vault">Whole vault</option>
          <option value="local">Current note</option>
        </select>
        {scope === 'local' && (
          <select
            className="input"
            style={{ width: 'auto' }}
            value={depth}
            aria-label="Graph depth"
            onChange={(e) => setDepth(Number(e.target.value))}
          >
            <option value={1}>Depth 1</option>
            <option value={2}>Depth 2</option>
            <option value={3}>Depth 3</option>
          </select>
        )}
        <input
          className="input"
          type="search"
          placeholder="Find node…"
          aria-label="Find node in graph"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          style={{ width: 'auto' }}
          value={folderFilter}
          aria-label="Filter by folder"
          onChange={(e) => setFolderFilter(e.target.value)}
        >
          <option value="">All folders</option>
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: '7rem' }}
          placeholder="#tag"
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        />
        <label
          className="text-small text-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <input
            type="checkbox"
            checked={hideOrphans}
            onChange={(e) => setHideOrphans(e.target.checked)}
          />
          Hide orphans
        </label>
        <span className="text-small text-faint" role="status">
          {nodes.length} notes · {edges.length} links{hovered ? ` · ${hovered}` : ''}
        </span>
      </div>
    </div>
  )
}
