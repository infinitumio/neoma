// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Small, fast fuzzy matcher (subsequence with scoring). No dependency, well
 * under 10ms for thousands of candidates. Returns a score and the matched
 * character indices (for highlighting), or null when there is no match.
 */
export interface FuzzyResult {
  score: number
  /** indices into `text` that matched, for highlighting */
  indices: number[]
}

/**
 * Score how well `query` fuzzy-matches `text`. Higher is better. Rewards:
 * consecutive matches, matches at word starts, and a full case-insensitive
 * prefix. Returns null if `query` is not a subsequence of `text`.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  if (!query) return { score: 0, indices: [] }
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  // Fast path: exact prefix is the strongest match.
  let prefixBonus = 0
  if (t.startsWith(q)) prefixBonus = 1000

  const indices: number[] = []
  let score = prefixBonus
  let ti = 0
  let prevMatch = -2
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    for (let j = ti; j < t.length; j++) {
      if (t[j] === ch) {
        found = j
        break
      }
    }
    if (found === -1) return null
    indices.push(found)
    // Reward consecutive characters and word-boundary starts.
    if (found === prevMatch + 1) score += 8
    else score += 1
    const before = found === 0 ? ' ' : t[found - 1]
    if (before === ' ' || before === '-' || before === '/' || before === '_') score += 6
    prevMatch = found
    ti = found + 1
  }
  // Shorter targets (closer length to the query) rank slightly higher.
  score += Math.max(0, 20 - (t.length - q.length))
  return { score, indices }
}
