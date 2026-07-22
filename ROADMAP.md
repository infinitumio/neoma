# neoma roadmap

Guiding rule: **data integrity, portability and offline reliability are never sacrificed
for new features.** Nothing incomplete is presented in the app as finished.

This roadmap follows the phased plan from user testing. Each phase is completed and tested
before the next begins.

## Phase 1 — reliability and core usability ✅ (shipped)

- [x] Fix italic formatting (+ regression tests for every inline style)
- [x] Clear success/error feedback (toasts, undo on delete, save status)
- [x] Vault introduction and starter vaults; Help section
- [x] Pages and subpages (folder-note hierarchy) with breadcrumbs and drag-to-nest
- [x] Notion-style slash commands (text, academic, media, organisation)
- [x] Stronger mathematics (symbol menu, copy LaTeX, numbered equations, theorem blocks)
- [x] Coloured highlighting
- [x] Improved local search (broad / exact word / exact phrase, scope, case, stats)
- [x] Beginner-facing "page" terminology and empty states

## Phase 2 — desktop and study workflows (in progress)

- [x] **PDF support**: inline scrollable embed, dedicated viewer (zoom / fit-width /
      fit-page / rotate / thumbnails / selectable text layer with find & copy / print /
      fullscreen), `[[file.pdf#page=12]]` links, recent PDFs, and a PDF-left / notes-right
      split view (companion note nests under the PDF)
- [x] Tasks (Markdown checkboxes) with due date / priority / course / related page /
      recurrence, and Today / Upcoming / Completed views; tasks stay readable Markdown
- [x] Calendar (month + agenda) driven by frontmatter dates (`date` / `due` / `exam-date`)
      and task due dates; events link to pages; colours/filters. _Week view and optional
      ICS import next._
- [x] Exam-study workflow: study dashboard, exam template, flashcard review (reader flip
      cards + topics), study mode
- [~] Package neoma as a **desktop app** with Tauri (Windows first; macOS/Linux where
  practical): native window, system-tray behaviour (close / minimise-to-tray / ask),
  optional launch on startup, native dialogs/notifications, offline startup, reopen
  last vault + tabs. _Scaffolded in `src-tauri/` (see [DESKTOP.md](DESKTOP.md)); builds
  locally with a Rust toolchain — not yet compiled in CI._
- [~] Trustworthy installer: releases with exact filenames, sizes, versions, SHA-256
  checksums, source/build links, and an honest unsigned-warning explanation.
  _[INSTALL.md](INSTALL.md) + `desktop-release.yml` workflow in place; signing pending
  certificates._

## Phase 3 — graph and organisation (planned)

- [ ] Folder/parent-based **graph node colours** with a legend and per-type connection
      styles (solid link, dashed parent-child, faint unlinked mention)
- [ ] Live page embeds (`![[Page]]`) with read-only preview
- [ ] Improved backlinks and a study dashboard; calendar ↔ page connections

## Phase 4 — mobile and synchronisation (planned)

- [ ] Mobile PWA polish (bottom nav, drawers, sheets, large touch targets)
- [ ] Optional, replaceable **sync adapters** (local network, WebDAV, Syncthing folders,
      Git, user-selected cloud folders, optional self-hosted server) — always opt-in,
      local files remain the source of truth, conflicts never silently discarded, E2E
      encryption for remote sync where practical
- [ ] Conflict-resolution screen (keep both, show differences, merge)
- [ ] **Notion import** (Markdown + CSV + attachments, hierarchy preserved, honest report
      of anything that cannot be converted)

## Explicit non-goals

- Accounts, hosted cloud storage, or any mandatory server
- Telemetry of any kind
- Proprietary note formats
- Making AI a required part of the core experience (future AI may only ever be an optional,
  on-device, default-off plugin)
