// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  extractNoteMeta,
  extractLinks,
  extractTags,
  extractHeadings,
  extractCitations,
  countWords,
  parseWikiTarget,
} from '@/markdown/extractMeta'

describe('extractLinks', () => {
  it('finds wiki links with alias and heading', () => {
    const links = extractLinks('See [[Note A]] and [[Note B|alias]] and [[Note C#Section]].')
    expect(links.map((l) => l.target)).toEqual(['Note A', 'Note B', 'Note C'])
    expect(links[1].alias).toBe('alias')
    expect(links[2].heading).toBe('Section')
  })

  it('ignores links inside code blocks and inline code', () => {
    const text = 'Real [[Link]]\n```\n[[NotALink]]\n```\nAnd `[[AlsoNot]]`.'
    expect(extractLinks(text).map((l) => l.target)).toEqual(['Link'])
  })

  it('finds markdown links to local .md files but not external URLs', () => {
    const links = extractLinks('[a](Other%20Note.md) [b](https://example.com/x.md) [c](#anchor)')
    expect(links).toHaveLength(1)
    expect(links[0].target).toBe('Other Note')
    expect(links[0].isMarkdownLink).toBe(true)
  })

  it('skips embeds', () => {
    expect(extractLinks('![[image.png]] and [[Real]]')).toHaveLength(1)
  })
})

describe('parseWikiTarget', () => {
  it('splits target, heading and alias', () => {
    expect(parseWikiTarget('Note#Head|Shown')).toMatchObject({
      target: 'Note',
      heading: 'Head',
      alias: 'Shown',
    })
  })
})

describe('extractTags', () => {
  it('merges inline and frontmatter tags, ignores numbers', () => {
    const tags = extractTags('Uses #ml and #nlp/parsing but not #42.', ['from-fm'])
    expect(tags).toEqual(['from-fm', 'ml', 'nlp/parsing'])
  })

  it('ignores tags in code', () => {
    expect(extractTags('`#nottag` and #real', [])).toEqual(['real'])
  })
})

describe('extractHeadings', () => {
  it('extracts depth, text and slugs', () => {
    const headings = extractHeadings('# One\n\ntext\n\n## Two Words\n')
    expect(headings).toHaveLength(2)
    expect(headings[0]).toMatchObject({ depth: 1, text: 'One', slug: 'one' })
    expect(headings[1]).toMatchObject({ depth: 2, slug: 'two-words' })
  })

  it('dedupes duplicate slugs', () => {
    const headings = extractHeadings('## Same\n\n## Same\n')
    expect(headings[1].slug).toBe('same-1')
  })
})

describe('extractCitations', () => {
  it('finds pandoc citation keys', () => {
    expect(extractCitations('As shown [@smith2025] and [@doe2024, p. 3].')).toEqual([
      'doe2024',
      'smith2025',
    ])
  })
})

describe('countWords', () => {
  it('counts prose words, not markup', () => {
    expect(countWords('# Title\n\nTwo words')).toBe(3)
  })
})

describe('extractNoteMeta', () => {
  it('assembles complete metadata', () => {
    const meta = extractNoteMeta({
      path: 'Folder/My Note.md',
      text: `---\ntitle: Fancy Title\naliases:\n  - Alt Name\ntags:\n  - research\n---\n\n# Heading\n\nLink to [[Other]] #inline [@key2026]\n`,
      createdAt: 1000,
      modifiedAt: 2000,
    })
    expect(meta.name).toBe('My Note')
    expect(meta.title).toBe('Fancy Title')
    expect(meta.aliases).toEqual(['Alt Name'])
    expect(meta.tags).toContain('research')
    expect(meta.tags).toContain('inline')
    expect(meta.links[0].target).toBe('Other')
    expect(meta.citations).toEqual(['key2026'])
    expect(meta.headings[0].text).toBe('Heading')
    expect(meta.modifiedAt).toBe(2000)
  })

  it('uses frontmatter created date when present', () => {
    const meta = extractNoteMeta({
      path: 'a.md',
      text: '---\ncreated: 2026-01-15\n---\nx',
      createdAt: 123,
      modifiedAt: 456,
    })
    expect(new Date(meta.createdAt).getUTCFullYear()).toBe(2026)
  })
})
