---
description: Cite with Pandoc keys like [@vaswani2017]. They stay plain text, so any tool can use them.
slug: citations
---

Type a citation key in square brackets with an `@`:

| Write | Means |
| --- | --- |
| `[@vaswani2017]` | one source |
| `[@vaswani2017; @devlin2019]` | two sources |
| `[@vaswani2017, p. 3]` | a page |

- Neoma shows keys as citations and **never rewrites them**.
- The note's info panel (`Mod+Shift+\`) lists every key the note cites.
- The **Citation** item in the [[Slash menu]] inserts a key; the **Literature note** template starts a reading note around one.
- Keys use Pandoc syntax, so Pandoc can turn them into a formatted bibliography from your `.bib` file when you export. Neoma does not format bibliographies itself.

Keep sources in one place, for example a `Sources` note that lists each key with its full reference, and link to it with [[Links|wiki links]].
