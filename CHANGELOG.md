# Changelog

All notable changes to neoma are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (calendar, tasks & desktop round)

- **Planner** — a collapsible rail group that expands to three separate panels:
  **Journal** (daily notes calendar), **Calendar** (a mini month of events) and **Tasks**.
- **Tasks** — a Today / Upcoming / Completed view over the vault's Markdown checkboxes,
  with optional readable metadata (due `📅`/`[due::]`, priority `⏫🔼🔽`/`[priority::]`,
  `#course/x`, a related `[[link]]`, recurrence `🔁`/`[repeat::]`). Ticking writes back to
  the note; tasks stay plain Markdown.
- **Calendar** — a full month + agenda view (rail Planner → Calendar → "Open full calendar",
  or the "Open calendar" command) over events from note frontmatter (`date`/`due`/
  `exam-date`), task due dates, and imported .ics calendars. Selecting a day shows a
  **summary** of everything on it (events, journal entry, notes edited); hovering a day
  gives a quick overview. Events link to their page; colours by course or kind; filter by
  course.
- **Import calendars (.ics)** from **Settings → Daily notes** — bring in events from an
  exported/subscribed Google, Outlook or Apple calendar. Read-only, stored locally, never
  fetched from the network; live Google/Outlook OAuth remains an optional future add-on.
- **Desktop app scaffold (Tauri 2)** in `src-tauri/` — native window, system tray,
  single-instance focus, configurable close behaviour (quit / minimise-to-tray / ask),
  optional launch-on-startup, native dialogs/notifications. Builds locally with a Rust
  toolchain (see [DESKTOP.md](DESKTOP.md)); not yet compiled in CI.
- **Trustworthy install docs** — [INSTALL.md](INSTALL.md) with checksum-verification steps,
  build provenance, a plain-English unsigned-warning explanation, a no-telemetry privacy
  statement, and uninstall instructions; plus a `desktop-release.yml` workflow that builds
  installers and publishes SHA-256 checksums.

### Added (slash, PDF & study round)

- **Complete slash-command system** — a Notion-style inline menu that opens beneath the
  cursor: fuzzy search, category groups, Favourites/Recent, context-aware ranking, a rich
  two-line preview panel, and full keyboard/screen-reader support. ~90 commands share one
  registry with the command palette (`/` and `Ctrl/Cmd+K` are the same definitions).
  AI commands appear but stay disabled until an AI plugin is installed. _(Fixes a crash
  where the menu never opened — `coordsAtPos` was read during a CodeMirror update.)_
- **First-class PDF viewer** — a selectable **text layer** (copy text; **find in document**
  with match navigation and highlighting), a **thumbnail** sidebar, **rotate**,
  **fit-width / fit-page**, **fullscreen**, **print**, and a page-number input.
  `[[lecture.pdf#page=12]]` and `(lecture.pdf#page=12)` links jump to a page. Optional
  **split view** puts the PDF beside an auto-created companion note for paraphrasing
  lectures. Recently opened PDFs are tracked per vault.
- **Study workflow** — a **Study dashboard** panel (upcoming exams with days-until, recent
  lecture PDFs and notes, a vault-wide flashcard count), an **exam-prep template** (course,
  date, topics, revision checklist, formulas, common mistakes, practice questions,
  confidence, linked lectures), **flashcard review** for `Question:: / Answer::` and
  `front :: back` cards (reveal, rate confidence, shuffle, hard-only filter, offline), and a
  distraction-free **study mode**.

### Fixed (slash, PDF & study round)

- **Daily journal** Yesterday/Today/Tomorrow buttons no longer clip in the narrow panel —
  compact prev/next arrows now flank a wide "Today".
- **PDF (and other) embeds/links with special characters** now render correctly. Targets
  containing `_`, `*`, `(`, `)` (e.g. `![[A_Student_(1_What_is_Research_).pdf]]`) were being
  mangled by CommonMark emphasis and shown as raw text; wiki spans are now protected before
  parsing (code and math excluded), so they always become a proper link/embed/card.

### Changed (slash, PDF & study round)

- **Flashcards flip in the reading view** — a `Question:: / Answer::` block renders as a
  clickable 3-D flip card (keyboard-accessible), with an optional `Topic::` / `Category::`
  label. Cards also pick up the **nearest heading as their topic**, and the review session
  gains a **topic filter**.
- **Task checkboxes are tickable in the reading view** — clicking a `- [ ]` toggles it and
  writes the change straight back to the markdown source.
- **PDF embeds vs. links** — `![[file.pdf]]` (the "Embed PDF" command) now renders the PDF
  **inline and scrollable** in the reading view (a compact zoom-only toolbar, sized to one
  page, filling the width). The "PDF" command inserts a **link card** that opens the full
  viewer instead — with a valid angle-bracket destination so paths with spaces/parentheses
  work.
- **Column layout** — `:::columns … ||| … :::` renders content side by side (text beside an
  image or PDF, or two columns of prose); inner markdown is fully rendered. New "Columns"
  slash command.
- Long attachment and PDF names are truncated with an ellipsis in the attachment picker and
  the Study dashboard instead of overflowing.
- **Hover tooltips** on the activity rail, sidebars and PDF viewer controls (to the right of
  rail buttons, above/below toolbar buttons), toggleable in Settings → Appearance.
- The PDF split-view note pane hides its breadcrumb trail (redundant while paraphrasing).
- Graph: the node/link stats moved onto their own row beneath the options, and the hovered
  node name now floats separately so it no longer stretches the toolbar.
- **PDF split view nests the companion note under the PDF** — the note is created in a folder
  named after the PDF, and the file tree now shows a PDF that has a same-named sibling folder
  as an expandable parent. The PDF is never moved, so its embed/link references stay valid.

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
