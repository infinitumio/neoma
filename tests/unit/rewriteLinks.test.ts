// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { rewriteLinks } from '@/links/rewriteLinks'

describe('rewriteLinks', () => {
  const targets = new Set(['old note', 'folder/old note'])

  it('rewrites simple wiki links', () => {
    const { text, count } = rewriteLinks('See [[Old Note]].', targets, 'New Note')
    expect(text).toBe('See [[New Note]].')
    expect(count).toBe(1)
  })

  it('preserves aliases and headings', () => {
    const { text } = rewriteLinks('[[Old Note#Part|shown]]', targets, 'New Note')
    expect(text).toBe('[[New Note#Part|shown]]')
  })

  it('rewrites markdown links to the note file', () => {
    const { text } = rewriteLinks('[label](Old%20Note.md)', targets, 'New Note')
    expect(text).toBe('[label](New%20Note.md)')
  })

  it('leaves unrelated links and code untouched', () => {
    const input = '[[Other]] and `[[Old Note]]`\n```\n[[Old Note]]\n```'
    const { text, count } = rewriteLinks(input, targets, 'New Note')
    expect(text).toBe(input)
    expect(count).toBe(0)
  })

  it('rewrites multiple occurrences', () => {
    const { text, count } = rewriteLinks('[[Old Note]] then [[old note|x]]', targets, 'New')
    expect(count).toBe(2)
    expect(text).toBe('[[New]] then [[New|x]]')
  })

  it('keeps embeds pointing at the renamed note', () => {
    const { text } = rewriteLinks('![[Old Note]]', targets, 'New Note')
    expect(text).toBe('![[New Note]]')
  })
})
