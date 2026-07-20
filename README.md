<div align="center">

<img src="public/favicon.svg" alt="neoma logo" width="96" height="96" />

# neoma

**Your knowledge, rooted locally.**

neoma is a lightweight, open-source research journal and linked-note application.
It works in your browser, runs offline and keeps your knowledge in portable Markdown files.

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-4ade80.svg)](LICENSE)
[![Build](https://github.com/infinitumio/neoma/actions/workflows/build.yml/badge.svg)](https://github.com/infinitumio/neoma/actions/workflows/build.yml)
[![Tests](https://github.com/infinitumio/neoma/actions/workflows/test.yml/badge.svg)](https://github.com/infinitumio/neoma/actions/workflows/test.yml)
[![Latest release](https://img.shields.io/github/v/release/infinitumio/neoma?include_prereleases&color=2f9e6e)](https://github.com/infinitumio/neoma/releases)
[![PWA](https://img.shields.io/badge/PWA-installable-4ade80.svg)](#installation)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-2f9e6e.svg)](CONTRIBUTING.md)

<img src="docs/assets/screenshot-reading-dark.png" alt="neoma reading view with backlinks sidebar" width="800" />

</div>

---

neoma is for people who want the essentials of a linked-note tool — Markdown files,
wiki links, backlinks, tags, frontmatter, daily notes, templates, search and a graph —
with **complete data ownership**: no account, no cloud, no telemetry, and notes that stay
readable in any text editor.

## Core principles

1. **Local-first.** Your vault lives on your device — in your browser's storage or in a
   real folder of `.md` files. Nothing is uploaded, ever.
2. **Plain Markdown is the format.** No proprietary database, no lock-in. Every note works
   in VS Code, Obsidian, Logseq, GitHub, or `cat`.
3. **Offline is normal.** After the first load, everything works without internet.
4. **Private by default.** No accounts, analytics, telemetry, ads, tracking or external
   API calls. See [docs/privacy.md](docs/privacy.md).
5. **Light and dependable.** A small, code-split bundle; heavy features (graph, preview
   renderer) load only when used. Data-integrity features protect your work.

## Features

- **Markdown editor** (CodeMirror 6) with edit, split, reading and read-only **source**
  views, plus a floating toolbar to format highlighted text in place
- **Wiki links** — `[[Note]]`, `[[Note|Alias]]`, `[[Note#Heading]]` — with autocompletion
- **Backlinks**, linked/unlinked mentions, broken-link and orphan detection
- **Tags** (`#tag` and frontmatter), with a tag browser
- **YAML frontmatter**, preserved verbatim — unknown fields are never deleted
- **Full-text search** in a Web Worker: phrases, exclusions, `tag:` / `path:` / `type:`
  filters, date filters, highlighted context
- **Daily notes** with calendar picker, configurable folder/format/template
- **Research templates**: daily journal, literature note, experiment log, supervisor
  meeting, research question — plus your own template notes
- **Graph view** (lazy-loaded): whole-vault or local, zoom/pan, filters, depth limit
- **Tabs** with pinning, reopen-closed, and session restore
- **Attachments**: paste or drag images and PDFs, stored with relative paths
- **Command palette** (`Ctrl/Cmd+K`) and customisable keyboard shortcuts
- **Import/export**: whole-vault ZIP, single-note Markdown/HTML, print-to-PDF
- **Recently deleted** with restore; conflict detection for external file edits
- **Citation-friendly**: `[@citekey]` recognised and searchable, DOI/BibTeX-key/Zotero-URI
  note properties, Pandoc syntax preserved
- **neoma Dark & neoma Light** themes, built entirely on CSS variables
- **Installable PWA** with full offline operation and update notifications

## Installation

neoma is a web application — nothing to install to try it:

```bash
git clone https://github.com/infinitumio/neoma.git
cd neoma
npm ci
npm run dev          # http://localhost:5173
```

To install it **as an app**: open neoma in a Chromium-based browser and use the browser's
_Install_ action (or the install button in Settings → About). Once installed it launches
in its own window and works fully offline.

## Local development

```bash
npm ci               # install dependencies
npm run dev          # dev server with hot reload
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright; runs against a production build)
npm run build        # production build in dist/
npm run preview      # serve the production build locally
```

Requirements: Node 20+ (see `.nvmrc`).

## Docker (optional self-hosting)

```bash
docker compose up --build
# neoma is now at http://localhost:8080
```

Or without compose:

```bash
docker build -t neoma .
docker run --rm -p 8080:80 neoma
```

The container serves the static production build with nginx. neoma has **no backend** —
self-hosting is just serving files; all data still stays in each visitor's own browser
or local folder.

## Offline use

neoma registers a service worker that precaches the application shell. After your first
visit you can open the app, create/edit/search notes, follow links, use templates, change
settings, and export data with no connection at all. The status bar shows **Local**,
**Offline** or **Update available** — offline is a normal, supported state, never an error.

## How storage works

| Vault type        | Where notes live                                                                  | Best for                            |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| **Browser vault** | This browser's IndexedDB                                                          | Zero-setup, any modern browser      |
| **Local folder**  | Real `.md` files in a folder you pick (File System Access API, Chromium browsers) | Git, sync tools, file-level backups |

Both are fully local. Browser vaults should be exported to ZIP occasionally (clearing the
site's browsing data deletes them — neoma tells you this up front). Local-folder vaults
are ordinary files; neoma asks for folder permission only after you explicitly choose a
folder, and never uploads anything. Details: [docs/storage.md](docs/storage.md).

## Markdown compatibility

Notes are CommonMark + GFM with widely-adopted extensions (wiki links, `==highlights==`,
callouts, math, `[@citations]`). Frontmatter is standard YAML and unknown fields are
preserved. Exported vaults keep their exact folder hierarchy and relative attachment
paths, so they open cleanly in other tools — and vaults are naturally Git-friendly.
Details: [docs/markdown-compatibility.md](docs/markdown-compatibility.md) and
[docs/storage.md § Git](docs/storage.md#using-git-with-a-vault).

## Privacy

> neoma does not collect, transmit or sell your notes or usage data. Your vault remains
> on your device unless you deliberately export or synchronise it using another tool.

No accounts, no analytics, no telemetry, no ads, no tracking pixels, no external API
calls, no CDN assets, no hidden network requests, no remote AI. See
[docs/privacy.md](docs/privacy.md) for the full policy and how to verify it.

## Roadmap

Version 1 focuses on a reliable editor, storage, offline operation and portability.
Planned next (see [ROADMAP.md](ROADMAP.md)): community plugins and themes, optional
encrypted sync, deeper Zotero integration, canvas, publish-to-web, local AI integrations.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, project
architecture, and the checklists (accessibility, privacy, dependency licensing) that
keep neoma trustworthy. Contributions must not introduce telemetry, tracking, mandatory
cloud services, proprietary note formats, undocumented external requests, or dependencies
that compromise the open-source licence.

## Licence

[AGPL-3.0-or-later](LICENSE). neoma is free software: you can run, study, share and
improve it, and network-hosted versions must offer their source to users.

## Creator

neoma was created by **Iwan** as an open-source project for researchers, students,
developers and anyone who wants complete ownership of their notes.

- Repository: `https://github.com/infinitumio/neoma`
- Contact: Discord `panda2187`

_neoma is an independent, community-driven project. It is not affiliated with Obsidian,
Modrinth, or any other organisation._
