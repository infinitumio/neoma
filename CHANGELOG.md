# Changelog

All notable changes to neoma are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/YOUR_GITHUB_USERNAME/neoma/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YOUR_GITHUB_USERNAME/neoma/releases/tag/v0.1.0
