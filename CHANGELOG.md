# Changelog

All notable changes to neoma are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (PDF & attachments round)

- **In-app PDF viewer** — PDFs open in a viewer tab (never a silent download): continuous
  scroll with stable page sizing, page navigation, zoom, fit-width, current-page indicator,
  plus download / open-externally. pdf.js is bundled and lazy-loaded (no CDN, works offline).
  _(Delivers the core of roadmap issue #13.)_
- **PDF preview cards** — `![[file.pdf]]` embeds **and** `[label](file.pdf)` links render as a
  card with a first-page thumbnail in the reading/split view; click to open the viewer.
- **Attachment picker** — an "Insert attachment" command/slash-command lets you **choose an
  existing file from the vault or add a new one**. Added files are imported *under* the
  current page (the page becomes their parent in the sidebar) and inserted.
- Site-wide: keyboard shortcuts now render with spacing (⌘ ⇧ F instead of ⌘⇧F), and the
  slash-command menu has roomier, clearer spacing.

### Fixed (PDF & attachments round)

- Right-clicking a **pinned** item now shows its context menu, so it can be unpinned.

### Added (second feedback round)

- **Vault switcher** — see all your vaults and jump between them from the sidebar vault
  name, the command palette, or `Mod+Shift+O`; open tabs are remembered per vault.
- **Page & file colours** — colour-code pages (saved to portable frontmatter `color:`) and
  attachments; colour dots show in the tree, and the **graph nodes take each page's
  colour** (falling back to a per-folder colour), with a colour **legend**. _(Delivers
  the graph-colour part of roadmap issue #16.)_
- **Import any file as an attachment** — the file import now accepts every file type and
  routes loose files into the attachment folder; **drop files from your computer** onto the
  page tree to import them (onto a folder to place them there).
- **Polished slash menu** — icon badges, section headers, bold labels with descriptions,
  and a clearer selected state.

### Fixed (second feedback round)

- **Highlighting reliability** — the selection toolbar now captures the selected range when
  it appears and applies formatting to exactly that text, fixing cases (notably in **split
  view**) where a highlight/format could land on the wrong text or be lost.
- Switching between two vaults that both have a same-named open page (e.g. `Untitled.md`)
  no longer leaves the editor stuck or leaks content between vaults.

### Phase 1 — reliability and core usability (from user feedback)

#### Fixed

- **Italic formatting** now works correctly, including bold-italic combinations — toggling
  italic on `**bold**` yields `***both***` instead of destroying the bold. Regression tests
  added for every inline style.

#### Added

- **Slash commands** — type `/` on a blank line (or after a list marker) for a searchable
  menu of block inserts: text (headings, lists, callouts, toggles, code), academic
  (equation, theorem, definition, proof, flashcard, exam question, lecture summary…),
  media (image, PDF link, table, page links/embeds) and organisation (subpage, properties,
  date, study checklist). Every command inserts real, portable Markdown.
- **Pages and subpages** — nest pages using the folder-note convention
  (`Machine Learning/Machine Learning.md`), stored as ordinary folders and files.
  Breadcrumbs above the editor, drag-a-page-onto-a-page to nest, convert to/from top-level,
  and a Subpages list in the context sidebar.
- **Coloured highlights** — yellow (portable `==text==`) plus green/blue/purple/red/orange/
  grey via a documented `<mark data-color>` extension; readable in both themes and
  preserved on export. Pick a colour from the selection toolbar's highlighter.
- **Search overhaul** — visible Broad / Exact word / Exact phrase modes, case-sensitivity,
  folder scope, and a "Search completed — N matches in M pages checked" confirmation. The
  advanced `tag:`/`path:`/`type:` syntax stays available.
- **Clearer action feedback** — success toasts for create/rename/move/import, an Undo
  action on delete, and confirmations throughout.
- **Stronger mathematics** — a common-symbol menu (inserts LaTeX), double-click a rendered
  equation to copy its LaTeX, auto-numbered display equations, and theorem/definition/proof
  callout blocks. All rendered offline by KaTeX.
- **Vault onboarding** — a "Create your vault" dialog that explains what a vault is in plain
  language and offers starter vaults (University study, Research project, Personal knowledge
  base, Blank).
- **Help section** — plain-language answers (what is a vault, offline mode, subpages,
  linking, maths, highlights, backups) plus a keyboard-shortcut reference, from the activity
  rail or `F1`.
- Beginner-facing **"page" terminology** and clearer empty states.
- Read-only **Markdown source view** — a fourth view mode showing the exact `.md` file
  content (frontmatter included) with a copy button and line count.
- **View-mode switcher** in the note header (Edit / Split / Reading / Source).
- **Floating selection toolbar** — highlight text to reformat it in place.
- `View Markdown source` command (`Mod+Shift+M`).

### Not yet done (tracked for later phases)

Desktop app (Tauri), PDF embedding/split view, calendar, tasks, exam dashboard,
flashcard review, graph folder-colours, cross-device sync and Notion import are **not**
in this release — see [ROADMAP.md](ROADMAP.md) and the GitHub issue tracker. They are not
presented as complete anywhere in the app.

## [0.1.0] - 2026-07-20

Initial release.

### Added

- Markdown editor (CodeMirror 6) with edit, split and reading modes
- Wiki links (`[[Note]]`, aliases, heading links) with autocompletion
- Backlinks, linked/unlinked mentions, broken links, orphan detection
- Tags (inline and frontmatter) with tag browser
- YAML frontmatter with verbatim preservation of unknown fields
- Full-text search in a Web Worker (phrases, exclusions, tag/path/type/date filters)
- Daily notes with calendar picker and configurable folder/format/template
- Built-in research templates (daily journal, literature note, experiment log,
  supervisor meeting, research question) and user template notes
- Lazy-loaded graph view (whole-vault and local, filters, depth limit)
- Tabs with pinning, reopen-closed and session restore
- Attachments (paste/drag images and PDFs) with relative paths
- Command palette and customisable keyboard shortcuts
- Browser vaults (IndexedDB) and local-folder vaults (File System Access API)
- Vault ZIP export/import, note Markdown/HTML export, print-to-PDF
- Recently deleted with restore; external-change conflict detection
- Pandoc citation keys, DOI/BibTeX-key/Zotero-URI properties
- neoma Dark and neoma Light themes on CSS variables
- Installable PWA with full offline operation and update notifications
- Unit tests (Vitest) and end-to-end tests (Playwright)
- Docker/nginx self-hosting setup

[Unreleased]: https://github.com/infinitumio/neoma/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/infinitumio/neoma/releases/tag/v0.1.0
