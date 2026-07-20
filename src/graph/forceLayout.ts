// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * A deliberately small force-directed layout (repulsion + springs +
 * centring) — enough for vault-sized graphs without pulling in a large
 * graph library. Runs a fixed cooling schedule and then stops.
 */

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  degree: number
}

export interface GraphEdge {
  source: number
  target: number
}

export interface Simulation {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** advance one tick; returns false when cooled */
  tick(): boolean
  reheat(): void
}

export function createSimulation(nodes: GraphNode[], edges: GraphEdge[]): Simulation {
  let alpha = 1

  // Deterministic initial ring placement (stable across reloads).
  nodes.forEach((node, i) => {
    if (node.x === 0 && node.y === 0) {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2
      const radius = 80 + 14 * Math.sqrt(i)
      node.x = Math.cos(angle) * radius
      node.y = Math.sin(angle) * radius
    }
  })

  const REPULSION = 2200
  const SPRING = 0.035
  const SPRING_LENGTH = 90
  const CENTER = 0.012
  const DAMPING = 0.82

  function tick(): boolean {
    if (alpha < 0.005) return false
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          dx = (Math.sin(i * 12.9898 + j) * 43758.5453) % 1
          dy = 0.5
          d2 = 1
        }
        const force = (REPULSION / d2) * alpha
        const d = Math.sqrt(d2)
        const fx = (dx / d) * force
        const fy = (dy / d) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
    }
    for (const edge of edges) {
      const a = nodes[edge.source]
      const b = nodes[edge.target]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const force = SPRING * (d - SPRING_LENGTH) * alpha
      const fx = (dx / d) * force
      const fy = (dy / d) * force
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
    for (const node of nodes) {
      node.vx -= node.x * CENTER * alpha
      node.vy -= node.y * CENTER * alpha
      node.vx *= DAMPING
      node.vy *= DAMPING
      node.x += node.vx
      node.y += node.vy
    }
    alpha *= 0.985
    return true
  }

  return {
    nodes,
    edges,
    tick,
    reheat() {
      alpha = Math.max(alpha, 0.6)
    },
  }
}
