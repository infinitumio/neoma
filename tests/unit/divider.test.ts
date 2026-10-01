/**
 * Thematic breaks: rendering, and the two things that look identical to a
 * line-based test but are not dividers.
 *
 * The parsing itself comes from remark-gfm, so these guard the cases where a
 * naive implementation goes wrong rather than re-testing the library.
 */
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/markdown/render'

const render = (md: string) => renderMarkdown(md, { resolveLink: () => null })

describe('dividers', () => {
  it('renders --- as a horizontal rule', async () => {
    const html = await render('above\n\n---\n\nbelow')
    expect(html).toContain('<hr')
  })

  it('accepts the other thematic break markers', async () => {
    for (const marker of ['***', '___', '- - -', '----------']) {
      const html = await render(`a\n\n${marker}\n\nb`)
      expect(html, `${marker} should be a rule`).toContain('<hr')
    }
  })

  it('does not treat frontmatter delimiters as a divider', async () => {
    // A note opening with YAML frontmatter starts with --- on line one. Reading
    // that as a rule puts a stray line at the top of every templated note.
    const html = await render('---\ntitle: Test\n---\n\nbody')
    expect(html).not.toContain('<hr')
    expect(html).toContain('body')
  })

  it('does not treat --- inside a code fence as a divider', async () => {
    const html = await render('```\n---\n```')
    expect(html).not.toContain('<hr')
  })

  it('reads --- under text as a setext heading, not a rule', async () => {
    // `Title` followed by `---` is a level-two heading in Markdown. Treating it
    // as a divider silently demotes a heading the writer meant to keep.
    const html = await render('Title\n---\n\nbody')
    expect(html).toContain('<h2')
    expect(html).not.toContain('<hr')
  })
})
