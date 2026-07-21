// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Inline SVG icons for the slash-command menu. Kept as raw markup (not React)
 * because they render inside CodeMirror's completion tooltip via a DOM node.
 * Stroke-based, 24×24, inheriting `currentColor` so they follow the theme.
 */
export type SlashIcon =
  | 'text'
  | 'heading'
  | 'list'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'callout'
  | 'toggle'
  | 'divider'
  | 'code'
  | 'highlight'
  | 'math'
  | 'book'
  | 'flashcard'
  | 'image'
  | 'file'
  | 'table'
  | 'link'
  | 'subpage'
  | 'properties'
  | 'calendar'
  | 'check'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'sup'
  | 'sub'
  | 'colorText'
  | 'video'
  | 'audio'
  | 'mermaid'
  | 'tag'
  | 'breadcrumb'
  | 'toc'
  | 'ai'
  | 'page'
  | 'reminder'

const P: Record<SlashIcon, string> = {
  text: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  ordered: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2"/>',
  task: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l3 3 5-6"/>',
  quote: '<path d="M7 7H4v6h3l-1 4M17 7h-3v6h3l-1 4"/>',
  callout: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  toggle: '<path d="M9 18l6-6-6-6"/>',
  divider: '<path d="M4 12h16"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  highlight: '<path d="M3 21h18M6 16l7-7 4 4-7 7zM13 5l3-3 4 4-3 3z"/>',
  math: '<path d="M18 6V4H6l6 8-6 8h12v-2"/>',
  book: '<path d="M5 4h12a1 1 0 011 1v15H6a1 1 0 01-1-1zM5 4v16"/>',
  flashcard: '<rect x="3" y="6" width="15" height="12" rx="1"/><path d="M18 9h3v12H8"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  file: '<path d="M6 2h9l5 5v15H6zM15 2v5h5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M9 4v16M15 4v16"/>',
  link: '<path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/>',
  subpage: '<path d="M6 2h9l5 5v15H6zM15 2v5h5M12 11v6M9 14h6"/>',
  properties: '<path d="M4 21v-6M4 11V3M12 21v-8M12 9V3M20 21v-4M20 13V3M1 15h6M9 9h6M17 17h6"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/>',
  italic: '<path d="M19 4h-9M14 20H5M15 4L9 20"/>',
  underline: '<path d="M6 4v6a6 6 0 0012 0V4M4 21h16"/>',
  strike: '<path d="M4 12h16M7 7a4 4 0 018-1M9 17a4 4 0 008 1"/>',
  sup: '<path d="M4 7l8 10M12 7L4 17M17 9a2 2 0 113 1.6L17 13h4"/>',
  sub: '<path d="M4 7l8 10M12 7L4 17M17 15a2 2 0 113 1.6L17 19h4"/>',
  colorText: '<path d="M4 20h16M7 16l5-11 5 11M9 12h6"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  audio: '<path d="M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0M19 16a3 3 0 11-6 0 3 3 0 016 0"/>',
  mermaid:
    '<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v4h11v4"/>',
  tag: '<path d="M20 12l-8 8-9-9V3h8zM7 7h.01"/>',
  breadcrumb: '<path d="M4 12h4l3 -4v8l-3 -4M13 12h4l3 -4v8l-3 -4"/>',
  toc: '<path d="M4 6h4M4 12h4M4 18h4M11 6h9M11 12h9M11 18h9"/>',
  ai: '<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 15l.8 2 .2.8 2 .8-2 .8-.2 2-.8-2-2-.8 2-.8z"/>',
  page: '<path d="M6 2h9l5 5v15H6zM15 2v5h5M9 12h6M9 16h6"/>',
  reminder: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
}

export function slashIconSvg(name: SlashIcon): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`
}
