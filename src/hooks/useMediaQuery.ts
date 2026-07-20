// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'

/** Reactive CSS media-query hook. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Small-screen detection matching the responsive breakpoint in layout.css. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 900px)')
}
