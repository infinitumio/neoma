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

## Phase 2 — desktop and study workflows (planned)

- [ ] Package neoma as a **desktop app** with Tauri (Windows first; macOS/Linux where
      practical): native window, icon, taskbar pinning, Start-menu entry, system-tray
      behaviour (close / minimise-to-tray / ask), optional launch on startup, native
      file/save dialogs and notifications, offline startup, reopen last vault + tabs
- [ ] Trustworthy installer: professional releases page with exact filenames, sizes,
      versions, SHA-256 checksums, source/build links, signing (or an honest explanation
      when unsigned), and uninstall instructions
- [ ] **PDF support**: embed, dedicated viewer (zoom/fit/rotate/thumbnails/text search),
      `[[file.pdf#page=12]]` links, and a PDF-left / notes-right split view
- [ ] Calendar (month/week/agenda) driven by frontmatter dates; optional ICS import
- [ ] Tasks (Markdown checkboxes) with due dates, priority, and Today/Upcoming views
- [ ] Exam-study workflow: study dashboard, exam template, flashcard review, study mode

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
