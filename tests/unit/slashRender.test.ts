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
