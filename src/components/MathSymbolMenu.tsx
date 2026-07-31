// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Common mathematical symbol menu. Inserts LaTeX at the cursor via the
 * editor's insert-text event. Everything renders offline through KaTeX.
 */
import { useEffect, useRef, useState } from 'react'
import { Sigma } from 'lucide-react'

interface Symbol {
  label: string
  latex: string
  /** caret offset inside the inserted text */
  cursor?: number
}

const GROUPS: Array<{ name: string; symbols: Symbol[] }> = [
  {
    name: 'Common',
    symbols: [
      { label: 'x²', latex: '^{2}' },
      { label: 'xₙ', latex: '_{n}' },
      { label: '√', latex: '\\sqrt{}', cursor: 6 },
      { label: 'frac', latex: '\\frac{}{}', cursor: 6 },
      { label: '±', latex: '\\pm ' },
      { label: '×', latex: '\\times ' },
      { label: '·', latex: '\\cdot ' },
      { label: '÷', latex: '\\div ' },
      { label: '≠', latex: '\\neq ' },
      { label: '≈', latex: '\\approx ' },
      { label: '≤', latex: '\\leq ' },
      { label: '≥', latex: '\\geq ' },
      { label: '∞', latex: '\\infty ' },
      { label: '∂', latex: '\\partial ' },
      { label: '∇', latex: '\\nabla ' },
    ],
  },
  {
    name: 'Calculus & sums',
    symbols: [
      { label: '∫', latex: '\\int_{a}^{b} ' },
      { label: '∮', latex: '\\oint ' },
      { label: 'Σ', latex: '\\sum_{i=1}^{n} ' },
      { label: 'Π', latex: '\\prod_{i=1}^{n} ' },
      { label: 'lim', latex: '\\lim_{x \\to \\infty} ' },
      { label: 'd/dx', latex: '\\frac{d}{dx} ' },
      { label: '∂/∂x', latex: '\\frac{\\partial }{\\partial x} ' },
    ],
  },
  {
    name: 'Greek',
    symbols: [
      { label: 'α', latex: '\\alpha ' },
      { label: 'β', latex: '\\beta ' },
      { label: 'γ', latex: '\\gamma ' },
      { label: 'δ', latex: '\\delta ' },
      { label: 'ε', latex: '\\epsilon ' },
      { label: 'θ', latex: '\\theta ' },
      { label: 'λ', latex: '\\lambda ' },
      { label: 'μ', latex: '\\mu ' },
      { label: 'π', latex: '\\pi ' },
      { label: 'σ', latex: '\\sigma ' },
      { label: 'φ', latex: '\\phi ' },
      { label: 'ω', latex: '\\omega ' },
      { label: 'Δ', latex: '\\Delta ' },
      { label: 'Ω', latex: '\\Omega ' },
    ],
  },
  {
    name: 'Sets & logic',
    symbols: [
      { label: '∈', latex: '\\in ' },
      { label: '∉', latex: '\\notin ' },
      { label: '⊆', latex: '\\subseteq ' },
      { label: '∪', latex: '\\cup ' },
      { label: '∩', latex: '\\cap ' },
      { label: '∅', latex: '\\emptyset ' },
      { label: '∀', latex: '\\forall ' },
      { label: '∃', latex: '\\exists ' },
      { label: '⇒', latex: '\\implies ' },
      { label: '⇔', latex: '\\iff ' },
      { label: '¬', latex: '\\neg ' },
      { label: 'ℝ', latex: '\\mathbb{R} ' },
      { label: 'ℕ', latex: '\\mathbb{N} ' },
    ],
  },
  {
    name: 'Probability & linear algebra',
    symbols: [
      { label: 'P(A|B)', latex: 'P(A \\mid B) ' },
      { label: 'E[X]', latex: '\\mathbb{E}[X] ' },
      { label: 'Var', latex: '\\mathrm{Var}(X) ' },
      { label: '𝒩', latex: '\\mathcal{N}(\\mu, \\sigma^2) ' },
      { label: 'v⃗', latex: '\\mathbf{v} ' },
      { label: 'Aᵀ', latex: 'A^{\\top} ' },
      { label: '‖x‖', latex: '\\lVert x \\rVert ' },
      { label: 'matrix', latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
      { label: 'cases', latex: '\\begin{cases} a & x > 0 \\\\ b & x \\le 0 \\end{cases}' },
      { label: 'align', latex: '\\begin{aligned} y &= mx + b \\\\ &= \\ldots \\end{aligned}' },
    ],
  },
]

export function MathSymbolMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const insert = (symbol: Symbol) => {
    window.dispatchEvent(
      new CustomEvent('neoma:insert-text', {
        detail: { text: symbol.latex, cursorOffset: symbol.cursor },
      }),
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        aria-label="Insert mathematical symbol"
        aria-expanded={open}
        title="Math symbols (insert LaTeX)"
        onClick={() => setOpen((s) => !s)}
      >
        <Sigma size={15} aria-hidden />
      </button>
      {open && (
        <div className="math-menu" role="menu" aria-label="Mathematical symbols">
          {GROUPS.map((group) => (
            <div key={group.name}>
              <div className="sidebar-section-label">{group.name}</div>
              <div className="math-grid">
                {group.symbols.map((symbol) => (
                  <button
                    key={symbol.label}
                    className="math-symbol"
                    title={symbol.latex.trim()}
                    onClick={() => insert(symbol)}
                  >
                    {symbol.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            Use inside <code>$…$</code> or <code>$$…$$</code>. Tip: double-click a rendered equation
            in Reading view to copy its LaTeX.
          </p>
        </div>
      )}
    </div>
  )
}
