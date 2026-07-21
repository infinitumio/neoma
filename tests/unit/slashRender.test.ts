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
