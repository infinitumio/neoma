// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Graph view: relationships between notes on a canvas. Lazy-loaded so it
 * never affects the initial bundle. Supports local/whole-vault scope, zoom,
 * pan, node selection, search, orphan hiding, folder/tag filters and depth
 * limits. The graph is a secondary view — kept simple and fast.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { getLinkGraph, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useActiveNotePath } from '@/components/panels/BacklinksPanel'
import { createSimulation, type GraphEdge, type GraphNode } from './forceLayout'
import { isWithin, dirname, basename } from '@/utils/paths'
import { getEntryColor, createNote } from '@/app/vaultStore'
import { folderColor, pageColorHex, type PageColor } from '@/utils/colors'
import { useUi } from '@/app/uiStore'
import { exportBlob, canExportFiles, ExportCancelled } from '@/storage/import-export'

interface ViewTransform {
  x: number
  y: number
  scale: number
}

// Muted, distinct hues for the optional colour-by-cluster mode (cycled for
// many clusters). By default the graph stays neutral with one Fern highlight.
const CLUSTER_PALETTE = [
  '#7cc49a',
  '#8fa9d6',
  '#d3a0b6',
  '#d6b468',
  '#a99bd6',
  '#7fbfc4',
  '#d69f7a',
  '#a5c47e',
  '#d68c86',
  '#b49ad0',
]

type LayoutMode = 'force' | 'radial' | 'folder' | 'chronological'

const topFolderOf = (id: string) => (id.includes('/') ? id.split('/')[0] : '')

/**
 * Set fixed node positions for the non-force layouts (radial rings from a
 * centre, groups by folder, or a chronological timeline). The force layout
 * leaves positioning to the simulation and is handled separately.
 */
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  mode: Exclude<LayoutMode, 'force'>,
  centerId: string | null,
) {
  const n = nodes.length
  if (!n) return

  if (mode === 'radial') {
    const adj: number[][] = nodes.map(() => [])
    for (const e of edges) {
      adj[e.source].push(e.target)
      adj[e.target].push(e.source)
    }
    let center = centerId ? nodes.findIndex((nd) => nd.id === centerId) : -1
    if (center < 0) {
      center = 0
      for (let i = 1; i < n; i++) if (adj[i].length > adj[center].length) center = i
    }
    const dist = new Array<number>(n).fill(Infinity)
    dist[center] = 0
    const queue = [center]
    for (let h = 0; h < queue.length; h++) {
      for (const nb of adj[queue[h]]) {
        if (dist[nb] === Infinity) {
          dist[nb] = dist[queue[h]] + 1
          queue.push(nb)
        }
      }
    }
    let maxD = 0
    for (const d of dist) if (Number.isFinite(d)) maxD = Math.max(maxD, d)
    const rings = new Map<number, number[]>()
    nodes.forEach((_, i) => {
      const d = Number.isFinite(dist[i]) ? dist[i] : maxD + 1
      if (!rings.has(d)) rings.set(d, [])
      rings.get(d)!.push(i)
    })
    for (const [d, idxs] of rings) {
      const r = d * 150
      idxs.forEach((idx, k) => {
        if (d === 0) {
          nodes[idx].x = 0
          nodes[idx].y = 0
        } else {
          const ang = (k / idxs.length) * Math.PI * 2
          nodes[idx].x = Math.cos(ang) * r
          nodes[idx].y = Math.sin(ang) * r
        }
      })
    }
  } else if (mode === 'folder') {
    const groups = new Map<string, number[]>()
    nodes.forEach((nd, i) => {
      const f = topFolderOf(nd.id)
      if (!groups.has(f)) groups.set(f, [])
      groups.get(f)!.push(i)
    })
    const folders = [...groups.keys()]
    const R = folders.length > 1 ? 140 + folders.length * 55 : 0
    folders.forEach((f, fi) => {
      const ang = (fi / folders.length) * Math.PI * 2
      const cx = Math.cos(ang) * R
      const cy = Math.sin(ang) * R
      const members = groups.get(f)!
      const r = 30 + Math.sqrt(members.length) * 22
      members.forEach((idx, k) => {
        const a = (k / members.length) * Math.PI * 2
        nodes[idx].x = cx + Math.cos(a) * r
        nodes[idx].y = cy + Math.sin(a) * r
      })
    })
  } else {
    // chronological: oldest to newest, left to right, with a gentle zig-zag so
    // labels do not collide on a single line.
    const order = nodes
      .map((_, i) => i)
      .sort((a, b) => (nodes[a].sortKey ?? 0) - (nodes[b].sortKey ?? 0))
    const spacing = 46
    order.forEach((idx, rank) => {
      nodes[idx].x = (rank - (n - 1) / 2) * spacing
      nodes[idx].y = (rank % 2 === 0 ? -1 : 1) * (24 + ((idx * 37) % 60))
    })
  }

  for (const nd of nodes) {
    nd.vx = 0
    nd.vy = 0
  }
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
  const [showGhosts, setShowGhosts] = useState(false)
  const [colorMode, setColorMode] = useState<'folder' | 'cluster'>('folder')
  const [layout, setLayout] = useState<LayoutMode>('force')
  // Advanced controls live behind a single "Options" toggle to keep it simple.
  const [optionsOpen, setOptionsOpen] = useState(false)

  // The Options panel sits under the toolbar, and the toolbar wraps: on a phone
  // it is two or three rows tall, not the one row a fixed offset assumed, so the
  // panel used to open behind it. Measure instead of guessing.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarH, setToolbarH] = useState(0)
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const measure = () => setToolbarH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)
    const pairWeight = new Map<string, number>()
    // Unresolved wiki-link targets, grouped by the note that references them.
    const ghostTargets = new Map<string, Set<string>>()
    for (const meta of metas) {
      for (const { link, resolved } of graph.outgoing(meta.path)) {
        if (resolved && included.has(resolved) && resolved !== meta.path) {
          edgePairs.push([meta.path, resolved])
          const k = pairKey(meta.path, resolved)
          pairWeight.set(k, (pairWeight.get(k) ?? 0) + 1)
        } else if (!resolved) {
          const t = link.target.trim()
          if (!t) continue
          if (!ghostTargets.has(meta.path)) ghostTargets.set(meta.path, new Set())
          ghostTargets.get(meta.path)!.add(t)
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

    const topFolder = (path: string) => (path.includes('/') ? path.split('/')[0] : '')
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
        color: getEntryColor(meta.path) ?? folderColor(topFolder(meta.path)),
        sortKey: meta.modifiedAt,
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
      edges.push({ source, target, weight: pairWeight.get(pairKey(a, b)) ?? 1 })
    }

    // Ghost nodes: unresolved link targets, added once and linked from every
    // note that references them. Deduped by lower-cased target text.
    if (showGhosts) {
      const ghostIndex = new Map<string, number>()
      for (const [srcPath, targets] of ghostTargets) {
        const source = index.get(srcPath)
        if (source === undefined) continue
        for (const t of targets) {
          const gid = `ghost:${t.toLowerCase()}`
          let gi = ghostIndex.get(gid)
          if (gi === undefined) {
            gi = nodes.length
            ghostIndex.set(gid, gi)
            nodes.push({ id: gid, label: t, x: 0, y: 0, vx: 0, vy: 0, degree: 0, ghost: true })
          }
          edges.push({ source, target: gi, weight: 1 })
        }
      }
    }

    // Community detection (label propagation) for colour-by-cluster. Cheap and
    // deterministic: each node repeatedly adopts the commonest label among its
    // neighbours until it settles.
    if (colorMode === 'cluster' && nodes.length) {
      const adj: number[][] = nodes.map(() => [])
      for (const e of edges) {
        adj[e.source].push(e.target)
        adj[e.target].push(e.source)
      }
      const labels = nodes.map((_, i) => i)
      for (let iter = 0; iter < 8; iter++) {
        let changed = false
        for (let i = 0; i < nodes.length; i++) {
          const counts = new Map<number, number>()
          for (const j of adj[i]) counts.set(labels[j], (counts.get(labels[j]) ?? 0) + 1)
          let best = labels[i]
          let bestCount = -1
          for (const [lab, c] of counts) {
            if (c > bestCount || (c === bestCount && lab < best)) {
              best = lab
              bestCount = c
            }
          }
          if (best !== labels[i]) {
            labels[i] = best
            changed = true
          }
        }
        if (!changed) break
      }
      // Renumber to compact cluster ids ordered by size.
      const size = new Map<number, number>()
      for (const l of labels) size.set(l, (size.get(l) ?? 0) + 1)
      const order = [...size.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l)
      const remap = new Map(order.map((l, i) => [l, i]))
      nodes.forEach((node, i) => {
        node.cluster = remap.get(labels[i])
      })
    }
    return { nodes, edges }
  }, [
    metaVersion,
    scope,
    depth,
    hideOrphans,
    folderFilter,
    tagFilter,
    activePath,
    showGhosts,
    colorMode,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const simulation = createSimulation(nodes, edges)
    // Non-force layouts place nodes at fixed positions and the loop skips the
    // physics tick; the force layout lets the simulation settle.
    if (layout !== 'force') computeLayout(simulation.nodes, simulation.edges, layout, activePath)
    const view: ViewTransform = { x: 0, y: 0, scale: 1 }
    let raf = 0
    let disposed = false
    let needsRender = true
    let hoveredId: string | null = null

    // Adjacency (by node index) powers hover/selection focus.
    const idIndex = new Map<string, number>()
    simulation.nodes.forEach((n, i) => idIndex.set(n.id, i))
    const adjacency = new Map<number, Set<number>>()
    const connect = (i: number, j: number) => {
      if (!adjacency.has(i)) adjacency.set(i, new Set())
      adjacency.get(i)!.add(j)
    }
    for (const edge of simulation.edges) {
      connect(edge.source, edge.target)
      connect(edge.target, edge.source)
    }

    // Single click/tap selects a node, centres on it and softly focuses its
    // neighbourhood. Double click/tap opens the note.
    let selectedId: string | null = null

    // Smooth centre-on-click, Obsidian style.
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
    let panAnim: {
      node: GraphNode
      start: number
      dur: number
      fromX: number
      fromY: number
      fromS: number
      toS: number
    } | null = null
    const panTo = (node: GraphNode) => {
      panAnim = {
        node,
        start: performance.now(),
        dur: 450,
        fromX: view.x,
        fromY: view.y,
        fromS: view.scale,
        toS: Math.max(view.scale, 1.3),
      }
    }

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

    const radiusOf = (node: GraphNode) =>
      node.ghost ? 3 : 3.5 + Math.sqrt(Math.min(node.degree, 60)) * 1.7

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.save()
      context.translate(width / 2 + view.x, height / 2 + view.y)
      context.scale(view.scale, view.scale)

      // Focus: the selected (or hovered) node plus its neighbours stay bright;
      // everything else dims. Selection persists, hover is transient.
      const focusId = selectedId ?? hoveredId
      const focusIdx = focusId ? (idIndex.get(focusId) ?? -1) : -1
      const focusSet =
        focusIdx >= 0 ? new Set([focusIdx, ...(adjacency.get(focusIdx) ?? [])]) : null
      const dimmed = (i: number) => !!focusSet && !focusSet.has(i)

      const edgeColor = css('--color-border-strong') || '#364039'
      for (const edge of simulation.edges) {
        const a = simulation.nodes[edge.source]
        const b = simulation.nodes[edge.target]
        const active = !focusSet || (focusSet.has(edge.source) && focusSet.has(edge.target))
        const ghostEdge = a.ghost || b.ghost
        context.globalAlpha = active ? 0.8 : 0.05
        context.strokeStyle = edgeColor
        context.lineWidth =
          (ghostEdge ? 0.6 : 0.7 + Math.min(edge.weight ?? 1, 6) * 0.55) / view.scale
        if (ghostEdge) context.setLineDash([3 / view.scale, 3 / view.scale])
        context.beginPath()
        context.moveTo(a.x, a.y)
        context.lineTo(b.x, b.y)
        context.stroke()
        if (ghostEdge) context.setLineDash([])
      }
      context.globalAlpha = 1

      const accent = css('--color-accent') || '#7cc49a'
      const faint = css('--color-text-faint') || '#6b7672'
      const q = query.trim().toLowerCase()
      for (let i = 0; i < simulation.nodes.length; i++) {
        const node = simulation.nodes[i]
        const radius = radiusOf(node)
        context.globalAlpha = dimmed(i) ? 0.15 : 1
        context.beginPath()
        context.arc(node.x, node.y, radius, 0, Math.PI * 2)
        if (node.ghost) {
          // Hollow dashed ring: a note that is referenced but does not exist.
          context.setLineDash([2.5 / view.scale, 2.5 / view.scale])
          context.strokeStyle = faint
          context.lineWidth = 1.2 / view.scale
          context.stroke()
          context.setLineDash([])
        } else {
          const isSelected = node.id === selectedId
          const isActive = node.id === activePath
          const matches = q && node.label.toLowerCase().includes(q)
          const highlighted = isSelected || isActive || matches || node.id === hoveredId
          const clusterColor =
            colorMode === 'cluster' && node.cluster != null
              ? CLUSTER_PALETTE[node.cluster % CLUSTER_PALETTE.length]
              : null
          context.fillStyle = highlighted
            ? accent
            : (clusterColor ??
              (node.color
                ? pageColorHex(node.color as PageColor)
                : css('--color-text-secondary') || '#98a39d'))
          context.fill()
          if (isSelected) {
            context.globalAlpha = 1
            context.strokeStyle = accent
            context.lineWidth = 2 / view.scale
            context.beginPath()
            context.arc(node.x, node.y, radius + 3 / view.scale, 0, Math.PI * 2)
            context.stroke()
          }
        }
      }
      context.globalAlpha = 1

      // Labels: hovered/selected/active/search always; others when zoomed in.
      context.font = `${11 / view.scale}px ${css('--font-ui') || 'sans-serif'}`
      context.textAlign = 'center'
      for (let i = 0; i < simulation.nodes.length; i++) {
        const node = simulation.nodes[i]
        const matches = q && node.label.toLowerCase().includes(q)
        const show =
          node.id === hoveredId ||
          node.id === selectedId ||
          node.id === activePath ||
          matches ||
          view.scale > 1.4
        if (!show) continue
        context.globalAlpha = dimmed(i) ? 0.25 : 1
        context.fillStyle = node.ghost ? faint : css('--color-text') || '#ece9e2'
        context.fillText(node.label, node.x, node.y - 6 - radiusOf(node))
      }
      context.globalAlpha = 1
      context.restore()
    }

    const loop = () => {
      if (disposed) return
      if (panAnim) {
        const t = Math.min(1, (performance.now() - panAnim.start) / panAnim.dur)
        const e = easeInOut(t)
        const s = panAnim.fromS + (panAnim.toS - panAnim.fromS) * e
        view.scale = s
        view.x = panAnim.fromX + (-panAnim.node.x * s - panAnim.fromX) * e
        view.y = panAnim.fromY + (-panAnim.node.y * s - panAnim.fromY) * e
        needsRender = true
        if (t >= 1) panAnim = null
      }
      const moved = layout === 'force' ? simulation.tick() : false
      if (moved || needsRender) {
        render()
        needsRender = false
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const openNode = (node: GraphNode) => {
      if (node.ghost) {
        // A referenced-but-missing note: create it, then open it.
        void createNote(dirname(node.label), basename(node.label)).then((p) => p && openNote(p))
      } else {
        openNote(node.id)
      }
    }

    // ---- Pan, pinch-zoom, tap / double-tap (mouse and touch, unified) ----
    const clampScale = (s: number) => Math.min(4, Math.max(0.2, s))
    const pointers = new Map<number, { x: number; y: number }>()
    let panStart: { x: number; y: number; viewX: number; viewY: number } | null = null
    let pinchStart: { dist: number; worldX: number; worldY: number } | null = null
    let tapCandidate: { x: number; y: number; time: number } | null = null
    let lastTap: { id: string | null; time: number } | null = null

    const handleTap = (node: GraphNode | null) => {
      const now = performance.now()
      const id = node?.id ?? null
      const isDouble = !!lastTap && lastTap.id === id && id !== null && now - lastTap.time < 350
      lastTap = { id, time: now }
      if (!node) {
        // Tap on empty space clears the selection.
        if (selectedId) {
          selectedId = null
          needsRender = true
        }
        return
      }
      if (isDouble) {
        openNode(node)
        lastTap = null
        return
      }
      // Single tap: select and glide the view to centre on it.
      selectedId = node.id
      panTo(node)
      needsRender = true
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      panAnim = null
      const rect = canvas.getBoundingClientRect()
      const before = toWorld(event.clientX, event.clientY)
      view.scale = clampScale(view.scale * Math.exp(-event.deltaY * 0.0012))
      // Keep the point under the cursor fixed while zooming.
      view.x = event.clientX - rect.left - rect.width / 2 - before.x * view.scale
      view.y = event.clientY - rect.top - rect.height / 2 - before.y * view.scale
      needsRender = true
    }
    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      panAnim = null
      if (pointers.size === 1) {
        panStart = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y }
        tapCandidate = { x: event.clientX, y: event.clientY, time: performance.now() }
      } else if (pointers.size === 2) {
        panStart = null
        tapCandidate = null
        const pts = [...pointers.values()]
        const world = toWorld((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
        pinchStart = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          worldX: world.x,
          worldY: world.y,
        }
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (pointers.has(event.pointerId))
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pinchStart && pointers.size >= 2) {
        const pts = [...pointers.values()]
        const midX = (pts[0].x + pts[1].x) / 2
        const midY = (pts[0].y + pts[1].y) / 2
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        view.scale = clampScale((view.scale * dist) / pinchStart.dist)
        pinchStart.dist = dist
        const rect = canvas.getBoundingClientRect()
        // Hold the grabbed world point under the moving finger midpoint: this
        // gives pinch-zoom and two-finger pan at once.
        view.x = midX - rect.left - rect.width / 2 - pinchStart.worldX * view.scale
        view.y = midY - rect.top - rect.height / 2 - pinchStart.worldY * view.scale
        needsRender = true
        return
      }

      if (panStart) {
        view.x = panStart.viewX + (event.clientX - panStart.x)
        view.y = panStart.viewY + (event.clientY - panStart.y)
        if (
          tapCandidate &&
          Math.hypot(event.clientX - tapCandidate.x, event.clientY - tapCandidate.y) > 6
        )
          tapCandidate = null
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
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinchStart = null
      if (pointers.size === 1) {
        const [p] = [...pointers.values()]
        panStart = { x: p.x, y: p.y, viewX: view.x, viewY: view.y }
      } else if (pointers.size === 0) {
        if (tapCandidate && performance.now() - tapCandidate.time < 400) {
          handleTap(nodeAt(event.clientX, event.clientY))
        }
        panStart = null
        tapCandidate = null
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedId) {
        selectedId = null
        needsRender = true
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('keydown', onKey)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [nodes, edges, query, activePath, openNote, colorMode, layout])

  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Composite the (transparent) graph over the app background so the export
    // is not see-through, then download it.
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#141815'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)
    out.toBlob((blob) => {
      if (!blob) return
      void exportBlob(blob, 'neoma-graph.png').catch((err) => {
        if (err instanceof ExportCancelled) return
        useUi.getState().toast(err instanceof Error ? err.message : 'Export failed', 'error')
      })
    }, 'image/png')
  }

  const folders = useMemo(() => {
    const set = new Set<string>()
    for (const entry of useVault.getState().entries.values()) {
      if (entry.kind === 'folder') set.add(entry.path)
    }
    return [...set].sort()
  }, [metaVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="graph-view" data-testid="graph-view">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Note graph. Click a node to focus it, double-click to open it."
      />
      {/* Primary row: just search, scope and an Options toggle. Everything else
          lives in the Options panel so the default view stays uncluttered. */}
      <div className="graph-toolbar" ref={toolbarRef}>
        <input
          className="input"
          type="search"
          placeholder="Find a note…"
          aria-label="Find node in graph"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
        <button
          className={`btn btn-small${optionsOpen ? ' btn-primary' : ''}`}
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((v) => !v)}
        >
          <SlidersHorizontal size={14} aria-hidden /> Options
        </button>
      </div>

      {optionsOpen && (
        <div
          className="graph-options"
          role="group"
          aria-label="Graph options"
          style={{ top: `calc(var(--space-3) + ${toolbarH}px + var(--space-2))` }}
        >
          {scope === 'local' && (
            <label className="graph-opt">
              <span>Depth</span>
              <select
                className="input"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          )}
          <label className="graph-opt">
            <span>Layout</span>
            <select
              className="input"
              value={layout}
              onChange={(e) => setLayout(e.target.value as LayoutMode)}
            >
              <option value="force">Force</option>
              <option value="radial">Radial</option>
              <option value="folder">By folder</option>
              <option value="chronological">Timeline</option>
            </select>
          </label>
          <label className="graph-opt">
            <span>Colour by</span>
            <select
              className="input"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as 'folder' | 'cluster')}
            >
              <option value="folder">Folder</option>
              <option value="cluster">Cluster</option>
            </select>
          </label>
          <label className="graph-opt">
            <span>Folder</span>
            <select
              className="input"
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            >
              <option value="">All</option>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
          <label className="graph-opt">
            <span>Tag</span>
            <input
              className="input"
              placeholder="#tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </label>
          <label className="graph-opt graph-opt-check">
            <input
              type="checkbox"
              checked={hideOrphans}
              onChange={(e) => setHideOrphans(e.target.checked)}
            />
            <span>Hide unlinked notes</span>
          </label>
          <label className="graph-opt graph-opt-check">
            <input
              type="checkbox"
              checked={showGhosts}
              onChange={(e) => setShowGhosts(e.target.checked)}
            />
            <span>Show missing notes</span>
          </label>
          <div className="graph-opt-footer">
            <span className="text-small text-faint">
              {nodes.length} notes · {edges.length} links
            </span>
            <button className="btn btn-small" onClick={exportPng} hidden={!canExportFiles()}>
              Export PNG
            </button>
          </div>
        </div>
      )}
      {hovered && (
        <div className="graph-hover-name text-small" role="status">
          {hovered}
        </div>
      )}
      {colorMode === 'folder' && <GraphLegend nodes={nodes} />}
    </div>
  )
}

/** Legend mapping the colours shown in the graph to folders/page colours. */
function GraphLegend({ nodes }: { nodes: GraphNode[] }) {
  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of nodes) {
      const key = node.color ?? 'grey'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [nodes])

  if (groups.length <= 1) return null
  return (
    <div className="graph-legend" aria-label="Graph colour legend">
      <div className="sidebar-section-label" style={{ padding: '0 0 var(--space-1)' }}>
        Colours
      </div>
      {groups.map(([color, count]) => (
        <div key={color} className="graph-legend-row">
          <span className="graph-legend-dot" style={{ background: `var(--pc-${color})` }} />
          <span className="graph-legend-label">{color}</span>
          <span className="tag-count">{count}</span>
        </div>
      ))}
      <p className="text-small text-faint" style={{ marginTop: 'var(--space-1)' }}>
        Set a page's colour from its header or the page menu.
      </p>
    </div>
  )
}
