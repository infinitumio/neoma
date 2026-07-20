# Markdown compatibility

A neoma note must remain usable outside neoma — in a plain text editor, VS Code,
Obsidian, Logseq, Joplin (after import), GitHub, and other Markdown applications.

## Base syntax

CommonMark plus GitHub Flavored Markdown (GFM): headings, bold, italic,
strikethrough, ordered/unordered lists, task lists, blockquotes, inline code, fenced
code blocks, tables, horizontal rules, footnotes, links and images.

## Extensions neoma understands

| Syntax                      | Meaning           | Compatibility notes                                                 |
| --------------------------- | ----------------- | ------------------------------------------------------------------- |
| `[[Note Name]]`             | Wiki link         | Understood by Obsidian, Logseq, and most PKM tools                  |
| `[[Note Name\|Shown text]]` | Aliased wiki link | Same                                                                |
| `[[Note Name#Heading]]`     | Heading link      | Same                                                                |
| `![[file.png]]`             | Embed             | Obsidian-style; falls back to visible text elsewhere                |
| `#tag`                      | Tag               | Common convention; plain text elsewhere                             |
| `==text==`                  | Highlight         | Obsidian/Typora convention                                          |
| `> [!note] Title`           | Callout           | Obsidian/GitHub alert convention; renders as a blockquote elsewhere |
| `$…$`, `$$…$$`              | Math (KaTeX)      | Pandoc/Obsidian convention                                          |
| `[@citekey]`                | Pandoc citation   | Preserved verbatim; searchable in neoma                             |

Everything degrades gracefully: in tools that don't know an extension, the note is still
readable plain text.

## Frontmatter

Standard YAML between `---` fences:

```yaml
---
title: Transformer Experiment 01
created: 2026-07-20
modified: 2026-07-20
type: experiment
status: active
tags:
  - transformers
  - experiments
aliases:
  - Attention Experiment
---
```

Fields neoma reads: `title`, `created`, `tags`, `aliases`, `type`. **Unknown fields are
preserved, never deleted.** If a frontmatter block cannot be parsed, neoma treats it as
opaque text and refuses to rewrite it.

Academic-workflow fields recognised as note properties: `doi`, `bibtex-key`,
`zotero-uri`. Pasting BibTeX into a fenced code block is preserved without alteration.

## What neoma never writes into your files

- No random IDs or hidden markers
- No proprietary syntax
- No rewriting of notes you didn't edit (except the explicit, user-approved link update
  after a rename — and then only the link targets change)

## Importing from other tools

- **Obsidian**: a vault folder is already compatible — open it directly (folder vault)
  or ZIP it and import. `.obsidian/` config folders are ignored.
- **Logseq**: Markdown graphs open fine; journal files map to daily notes if you set the
  daily-note folder/format to match.
- **Joplin**: use Joplin's "Export → MD" and import the resulting folder/ZIP.
