// SPDX-License-Identifier: AGPL-3.0-or-later
/** Flashcard parsing from portable markdown. */
import { describe, expect, it } from 'vitest'
import { parseFlashcards } from '@/study/flashcards'

describe('parseFlashcards', () => {
  it('parses Question:: / Answer:: pairs', () => {
    const cards = parseFlashcards('deck.md', 'Question:: What is entropy?\nAnswer:: A measure of disorder.')
    expect(cards).toHaveLength(1)
    expect(cards[0].front).toBe('What is entropy?')
    expect(cards[0].back).toBe('A measure of disorder.')
    expect(cards[0].deckName).toBe('deck')
  })

  it('accepts Q:: / A:: aliases', () => {
    const cards = parseFlashcards('d.md', 'Q:: Capital of France?\nA:: Paris')
    expect(cards).toHaveLength(1)
    expect(cards[0].front).toBe('Capital of France?')
    expect(cards[0].back).toBe('Paris')
  })

  it('collects multi-line answers up to a blank line', () => {
    const md = 'Question:: Steps?\nAnswer:: First line\nSecond line\n\nNot part of the answer.'
    const cards = parseFlashcards('d.md', md)
    expect(cards).toHaveLength(1)
    expect(cards[0].back).toBe('First line\nSecond line')
  })

  it('parses inline front :: back cards', () => {
    const cards = parseFlashcards('d.md', 'The mitochondria :: powerhouse of the cell')
    expect(cards).toHaveLength(1)
    expect(cards[0].front).toBe('The mitochondria')
    expect(cards[0].back).toBe('powerhouse of the cell')
  })

  it('parses several cards from one note', () => {
    const md = [
      'Question:: One?',
      'Answer:: A',
      '',
      'Question:: Two?',
      'Answer:: B',
    ].join('\n')
    expect(parseFlashcards('d.md', md)).toHaveLength(2)
  })

  it('ignores incomplete cards (question without answer)', () => {
    expect(parseFlashcards('d.md', 'Question:: dangling?')).toHaveLength(0)
  })

  it('gives stable ids so review state survives edits elsewhere', () => {
    const a = parseFlashcards('d.md', 'Q:: x\nA:: y')[0]
    const b = parseFlashcards('d.md', 'Q:: x\nA:: y')[0]
    expect(a.id).toBe(b.id)
  })

  it('captures the nearest heading as the topic', () => {
    const md = '# Cell Biology\n\nQuestion:: Powerhouse?\nAnswer:: Mitochondria'
    const cards = parseFlashcards('d.md', md)
    expect(cards[0].topic).toBe('Cell Biology')
  })

  it('captures an explicit Topic:: / Category:: label', () => {
    const md = 'Question:: 2+2?\nAnswer:: 4\nTopic:: Arithmetic'
    const cards = parseFlashcards('d.md', md)
    expect(cards[0].category).toBe('Arithmetic')
    expect(cards[0].back).toBe('4')
  })
})
