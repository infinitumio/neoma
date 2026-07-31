// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/render'

describe('renderMarkdown', () => {
  it('renders headings, emphasis and code', async () => {
    const html = await renderMarkdown('# Title\n\n**bold** *it* `code`')
    expect(html).toContain('<h1 id="title">Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('strips frontmatter', async () => {
    const html = await renderMarkdown('---\ntitle: X\n---\n\nBody')
    expect(html).not.toContain('title: X')
    expect(html).toContain('Body')
  })

  it('renders wiki links with resolution state', async () => {
    const html = await renderMarkdown('[[Known]] and [[Unknown]]', {
      resolveLink: (t) => (t === 'Known' ? 'Known.md' : null),
    })
    expect(html).toContain('data-target="Known"')
    expect(html).toContain('data-resolved="Known.md"')
    expect(html).toContain('wiki-link-broken')
  })

  it('renders aliased and heading wiki links', async () => {
    const html = await renderMarkdown('[[Note|Shown Text]] [[Note#Part]]')
    expect(html).toContain('>Shown Text</a>')
    expect(html).toContain('data-heading="Part"')
  })

  it('renders highlights, tags and citations', async () => {
    const html = await renderMarkdown('==hi== #tag [@smith2025]')
    expect(html).toContain('<mark>hi</mark>')
    expect(html).toContain('data-tag="tag"')
    expect(html).toContain('data-citation="@smith2025"')
  })

  it('renders callouts from blockquotes', async () => {
    const html = await renderMarkdown('> [!warning] Careful\n> Body line')
    expect(html).toContain('callout-warning')
    expect(html).toContain('callout-title')
    expect(html).toContain('Careful')
    expect(html).toContain('Body line')
  })

  it('renders GFM tables, task lists and footnotes', async () => {
    const html = await renderMarkdown(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n\nRef[^1]\n\n[^1]: note',
    )
    expect(html).toContain('<table>')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('footnote')
  })

  it('renders math via KaTeX', async () => {
    const html = await renderMarkdown('$e^x$')
    expect(html).toContain('katex')
  })

  it('never passes raw HTML through', async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script>\n\nsafe <em onclick="x()">inline</em> text',
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('onclick')
    expect(html).toContain('safe')
  })

  it('marks external links and internal md links differently', async () => {
    const html = await renderMarkdown('[ext](https://example.com) [int](Other.md)')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('data-internal="Other.md"')
  })
})
