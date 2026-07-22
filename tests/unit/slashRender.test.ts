// SPDX-License-Identifier: AGPL-3.0-or-later
/** Renderer support for the safe inline HTML the slash menu inserts. */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/render'

describe('safe inline HTML (underline / super / subscript)', () => {
  it('renders <u>', async () => {
    expect(await renderMarkdown('<u>underlined</u>')).toContain('<u>underlined</u>')
  })
  it('renders <sup> and <sub>', async () => {
    const html = await renderMarkdown('x<sup>2</sup> and H<sub>2</sub>O')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<sub>2</sub>')
  })
  it('still renders coloured marks', async () => {
    expect(await renderMarkdown('<mark data-color="green">g</mark>')).toContain('mark-green')
  })
  it('drops unknown tags/attributes', async () => {
    const html = await renderMarkdown('<u onclick="x()">t</u> <script>bad</script>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script>')
  })
})

describe('wiki embeds with special characters', () => {
  it('renders an embed whose path contains underscores and parentheses', async () => {
    // Underscores would otherwise be parsed as emphasis, splitting the embed.
    const target =
      'Courses/Example Course/Week 1 - Introduction/A_Student s_Guide_to_Methodology_----_(1_What_is_Research_).pdf'
    const html = await renderMarkdown(`![[${target}]]`)
    expect(html).toContain('data-embed=')
    expect(html).toContain(target)
    // No stray emphasis leaked from the underscores.
    expect(html).not.toContain('<em>')
  })

  it('renders a wiki link with underscores intact', async () => {
    const html = await renderMarkdown('[[My_Great_Note]]')
    expect(html).toContain('data-target="My_Great_Note"')
    expect(html).not.toContain('<em>')
  })

  it('leaves [[…]] inside inline code alone', async () => {
    const html = await renderMarkdown('Use `[[Note]]` syntax')
    expect(html).toContain('<code>[[Note]]</code>')
    expect(html).not.toContain('data-target')
  })
})

describe('column layout', () => {
  it('renders :::columns … ||| … ::: as side-by-side columns', async () => {
    const md = [':::columns', 'Left side', '|||', 'Right side', ':::'].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('class="md-columns"')
    expect((html.match(/class="md-column"/g) ?? []).length).toBe(2)
    expect(html).toContain('Left side')
    expect(html).toContain('Right side')
  })

  it('parses markdown (and embeds) inside a column', async () => {
    const md = [':::columns', '# Notes', '|||', '![[diagram.png]]', ':::'].join('\n')
    const html = await renderMarkdown(md)
    expect(html).toContain('<h1')
    expect(html).toContain('data-embed="diagram.png"')
  })

  it('supports three columns', async () => {
    const md = [':::columns', 'a', '|||', 'b', '|||', 'c', ':::'].join('\n')
    const html = await renderMarkdown(md)
    expect((html.match(/class="md-column"/g) ?? []).length).toBe(3)
  })
})

describe('PDF links with spaces in the path', () => {
  it('renders an internal link (card-eligible) from an angle-bracket destination', async () => {
    const md = '[Lecture.pdf](<Courses/Week 1 - Intro/A Study (1).pdf>)'
    const html = await renderMarkdown(md)
    // remark-rehype keeps the anchor; Preview turns data-internal PDF links
    // into a card at runtime.
    expect(html).toContain('data-internal="Courses/Week 1 - Intro/A Study (1).pdf"')
  })
})
