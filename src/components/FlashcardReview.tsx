// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Full-screen flashcard review. Reveal the answer, rate your confidence,
 * shuffle, and filter to the cards you find hard. Confidence is stored
 * locally per card so weak cards resurface. Fully offline and keyboard-driven.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shuffle, X, RotateCcw, FileText } from 'lucide-react'
import { useStudy } from '@/study/studyStore'
import { rateCard, getCardStates, isWeak, type Confidence } from '@/study/flashcards'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useIsMobile } from '@/hooks/useMediaQuery'

type Filter = 'all' | 'weak'

export function FlashcardReview() {
  const review = useStudy((s) => s.review)
  const close = useStudy((s) => s.closeReview)
  const vaultId = useVault((s) => s.vault?.id)

  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<Filter>('all')
  const [shuffle, setShuffle] = useState(false)
  const [topic, setTopic] = useState<string>('')
  const [order, setOrder] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [ratedCount, setRatedCount] = useState(0)

  const cards = useMemo(() => review?.cards ?? [], [review])

  const cardTopic = (c: (typeof cards)[number]) => c.category ?? c.topic
  const topics = useMemo(() => {
    const set = new Set<string>()
    for (const c of cards) {
      const t = c.category ?? c.topic
      if (t) set.add(t)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [cards])

  // Build the working set (filter + topic + shuffle) whenever inputs change.
  const buildOrder = useCallback(() => {
    const states = getCardStates(vaultId)
    let idx = cards.map((_, i) => i)
    if (topic) idx = idx.filter((i) => cardTopic(cards[i]) === topic)
    if (filter === 'weak') idx = idx.filter((i) => isWeak(states, cards[i].id))
    if (shuffle) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[idx[i], idx[j]] = [idx[j], idx[i]]
      }
    }
    return idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filter, shuffle, topic, vaultId])

  useEffect(() => {
    setOrder(buildOrder())
    setPos(0)
    setRevealed(false)
    setRatedCount(0)
  }, [buildOrder, review])

  const card = order.length ? cards[order[pos]] : null

  const advance = useCallback(() => {
    setRevealed(false)
    setPos((p) => Math.min(p + 1, order.length))
  }, [order.length])

  const rate = useCallback(
    (level: Confidence) => {
      if (!card) return
      rateCard(vaultId, card.id, level)
      setRatedCount((c) => c + 1)
      advance()
    },
    [card, vaultId, advance],
  )

  const restart = () => {
    setOrder(buildOrder())
    setPos(0)
    setRevealed(false)
    setRatedCount(0)
  }

  // Keyboard controls.
  useEffect(() => {
    if (!review) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close()
      if (!card) return
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && (e.key === '1' || e.key.toLowerCase() === 'a')) {
        rate('again')
      } else if (revealed && (e.key === '2' || e.key.toLowerCase() === 'g')) {
        rate('good')
      } else if (revealed && (e.key === '3' || e.key.toLowerCase() === 'e')) {
        rate('easy')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, card, revealed, rate, close])

  const done = order.length > 0 && pos >= order.length
  const openDeck = () => {
    if (card) useTabs.getState().openNote(card.deck)
    close()
  }

  if (!review) return null

  return createPortal(
    <div
      className="flashcard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard review"
    >
      <header className="flashcard-header">
        <div className="flashcard-title">
          <FileText size={15} aria-hidden /> {review.title}
        </div>
        <div className="flashcard-controls">
          {/* Phones keep only the essentials (restart + close); topic/hard/
              shuffle filters would squash the header. */}
          {!isMobile && topics.length > 0 && (
            <select
              className="flashcard-topic-select"
              aria-label="Filter by topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {!isMobile && (
            <button
              className={`btn btn-small${filter === 'weak' ? ' btn-primary' : ''}`}
              aria-pressed={filter === 'weak'}
              onClick={() => setFilter((f) => (f === 'weak' ? 'all' : 'weak'))}
            >
              Hard only
            </button>
          )}
          {!isMobile && (
            <button
              className={`icon-btn${shuffle ? ' active' : ''}`}
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={() => setShuffle((s) => !s)}
            >
              <Shuffle size={16} aria-hidden />
            </button>
          )}
          <button className="icon-btn" aria-label="Restart" onClick={restart}>
            <RotateCcw size={16} aria-hidden />
          </button>
          <button className="icon-btn" aria-label="Close review" onClick={close}>
            <X size={18} aria-hidden />
          </button>
        </div>
      </header>

      <div className="flashcard-progress" aria-hidden>
        <div
          className="flashcard-progress-bar"
          style={{
            width: `${order.length ? (Math.min(pos, order.length) / order.length) * 100 : 0}%`,
          }}
        />
      </div>

      <div className="flashcard-stage">
        {order.length === 0 && (
          <div className="flashcard-empty">
            <p>No {filter === 'weak' ? 'hard ' : ''}cards to review.</p>
            <p className="text-small text-faint">
              Add cards with <code>Question:: …</code> and <code>Answer:: …</code> lines, or{' '}
              <code>front :: back</code>.
            </p>
            {filter === 'weak' && (
              <button className="btn" onClick={() => setFilter('all')}>
                Review all cards
              </button>
            )}
          </div>
        )}

        {done && order.length > 0 && (
          <div className="flashcard-empty" role="status">
            <p className="flashcard-done">Reviewed {order.length} cards 🎉</p>
            <p className="text-small text-faint">{ratedCount} rated this session.</p>
            <div className="flashcard-rate">
              <button className="btn btn-primary" onClick={restart}>
                Review again
              </button>
              <button className="btn" onClick={openDeck}>
                Open note
              </button>
            </div>
          </div>
        )}

        {card && !done && (
          <>
            <div className="flashcard-count text-small text-faint">
              {pos + 1} / {order.length} · {card.deckName}
              {cardTopic(card) && <span className="flashcard-topic-badge">{cardTopic(card)}</span>}
            </div>
            <button
              className="flashcard-card"
              onClick={() => (revealed ? undefined : setRevealed(true))}
              aria-label={revealed ? 'Answer shown' : 'Reveal answer'}
            >
              <div className="flashcard-face flashcard-front">{card.front}</div>
              {revealed ? (
                <div className="flashcard-face flashcard-back">{card.back}</div>
              ) : (
                <div className="flashcard-hint text-small text-faint">
                  Click or press <span className="kbd">Space</span> to reveal
                </div>
              )}
            </button>

            {revealed && (
              <div className="flashcard-rate">
                <button className="btn flashcard-again" onClick={() => rate('again')}>
                  Again <span className="kbd">1</span>
                </button>
                <button className="btn flashcard-good" onClick={() => rate('good')}>
                  Good <span className="kbd">2</span>
                </button>
                <button className="btn flashcard-easy" onClick={() => rate('easy')}>
                  Easy <span className="kbd">3</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
