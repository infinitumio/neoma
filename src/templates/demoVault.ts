// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optional demo vault, loadable from the welcome screen. Demo notes are
 * never added to a user-created vault automatically.
 */
import { isoDate } from '@/utils/dates'

export interface DemoNote {
  path: string
  content: string
}

export function demoNotes(): DemoNote[] {
  const today = isoDate()
  return [
    {
      path: 'Welcome to neoma.md',
      content: `---
title: Welcome to neoma
created: ${today}
tags:
  - meta
---

**Your knowledge, rooted locally.**

neoma is a lightweight research journal and linked-note app. Everything you write stays on this device as plain Markdown.

## Start here

- Open the [[Research dashboard]] to see how notes link together
- Read the [[Markdown guide]] for the supported syntax
- See [[Privacy and portability guide]] for how your data is stored
- Press \`Ctrl+K\` / \`Cmd+K\` to open the command palette

## Things to try

1. Create a note with the **New note** button in the sidebar
2. Type \`[[\` in the editor to link to another note
3. Open the **Backlinks** panel on the right to see incoming links
4. Press the calendar icon to create today's [[${today}|daily journal]]
5. Open the **Graph** from the activity rail

> [!tip] Everything works offline
> After your first visit, neoma loads and works without any internet connection.
`,
    },
    {
      path: 'Research dashboard.md',
      content: `---
title: Research dashboard
created: ${today}
type: dashboard
tags:
  - meta
---

A small hub note that links the demo research notes together.

## Current work

- Reading: [[Attention Is All You Need (demo)]]
- Running: [[Experiment 01 - Baseline transformer]]
- Open questions: [[How does context length affect retrieval quality]]

## Recent journal

- [[Journal/${today}|Today's journal]]

## Meetings

- [[Supervisor meeting 2026-07-14]]

## Tags in use

#experiments #literature #questions #journal
`,
    },
    {
      path: `Journal/${today}.md`,
      content: `---
title: ${today}
created: ${today}
type: journal
tags:
  - journal
---

## Objectives

- Try neoma with a realistic research day

## Work completed

- Imported reading notes for [[Attention Is All You Need (demo)]]
- Started [[Experiment 01 - Baseline transformer]]

## Findings

- Wiki links + backlinks make the journal a usable index of the day

## Decisions

- Keep experiment logs as one note per run

## Problems

- None so far

## Questions

- See [[How does context length affect retrieval quality]]

## Supervisor follow-up

- Show the graph view at the next meeting

## Next actions

- [ ] Fill in results table in the experiment log
- [ ] Add two more literature notes
`,
    },
    {
      path: 'Attention Is All You Need (demo).md',
      content: `---
title: Attention Is All You Need (demo)
created: ${today}
type: literature
status: read
tags:
  - literature
  - transformers
bibtex-key: vaswani2017attention
doi: 10.48550/arXiv.1706.03762
aliases:
  - Transformer paper
---

## Citation

> Vaswani et al., "Attention Is All You Need", NeurIPS 2017. [@vaswani2017attention]

## Research question

- Can sequence transduction work well without recurrence or convolution?

## Methodology

- Encoder–decoder built purely from attention: $\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$

## Dataset

- WMT 2014 English–German and English–French

## Main findings

- ==Self-attention replaces recurrence== with better parallelism and quality
- Multi-head attention lets the model attend to different subspaces

## Limitations

- Quadratic attention cost in sequence length

## Important quotations

> "The Transformer is the first transduction model relying entirely on self-attention."

## Personal interpretation

- The architecture is the foundation for the models used in [[Experiment 01 - Baseline transformer]]

## Connections to my research

- Directly motivates [[How does context length affect retrieval quality]]

## Follow-up reading

- BibTeX entry kept for reference:

\`\`\`bibtex
@inproceedings{vaswani2017attention,
  title     = {Attention Is All You Need},
  author    = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and others},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2017}
}
\`\`\`
`,
    },
    {
      path: 'Experiment 01 - Baseline transformer.md',
      content: `---
title: Experiment 01 - Baseline transformer
created: ${today}
type: experiment
status: active
tags:
  - experiments
  - transformers
---

## Hypothesis

- A small baseline transformer reproduces the scaling trend reported in [[Attention Is All You Need (demo)|the Transformer paper]]

## Environment

- Python 3.12, PyTorch 2.4, single A100

## Dataset

- WikiText-103

## Model or method

- 6-layer decoder-only transformer

## Parameters

| Parameter     | Value |
| ------------- | ----- |
| Layers        | 6     |
| Heads         | 8     |
| d_model       | 512   |
| Batch size    | 64    |
| Learning rate | 3e-4  |

## Procedure

1. Tokenise dataset with BPE (32k vocabulary)
2. Train for 100k steps with cosine schedule
3. Evaluate perplexity every 5k steps

## Results

- Pending — first run in progress

## Unexpected behaviour

- None yet

## Limitations

- Single seed only

## Decision

- Continue to 100k steps before comparing context lengths

## Reproduction steps

1. \`git clone\` the training repo
2. \`python train.py --config baseline.yaml\`

## Next experiment

- Vary context length; see [[How does context length affect retrieval quality]]
`,
    },
    {
      path: 'Supervisor meeting 2026-07-14.md',
      content: `---
title: Supervisor meeting 2026-07-14
created: 2026-07-14
type: meeting
tags:
  - meetings
---

## Date

2026-07-14

## Attendees

- Me, Supervisor

## Discussion

- Progress on [[Experiment 01 - Baseline transformer]]
- Literature coverage of retrieval-augmented models

## Feedback

- Baseline first, ablations later — keep the journal up to date

## Decisions

- Weekly experiment summaries in the [[Research dashboard]]

## Questions

- Do we need a second baseline at a different scale?

## Actions

- [ ] Send perplexity curves by Friday
- [x] Share reading list

## Next meeting

- 2026-07-21
`,
    },
    {
      path: 'How does context length affect retrieval quality.md',
      content: `---
title: How does context length affect retrieval quality
created: ${today}
type: research-question
status: open
tags:
  - questions
  - transformers
---

## Question

- How does increasing context length change retrieval quality in decoder-only transformers?

## Motivation

- Longer context is expensive (attention is quadratic — see [[Attention Is All You Need (demo)]])

## Existing evidence

- Baseline being established in [[Experiment 01 - Baseline transformer]]

## Assumptions

- Perplexity is a usable proxy before task-specific evaluation

## Possible methods

- Train identical models at 512 / 2048 / 8192 context

## Risks

- Compute budget; confounding from positional encoding choice

## Open questions

- Does retrieval degrade gracefully or cliff at boundary lengths?

## Related notes

- [[Research dashboard]]
`,
    },
    {
      path: 'Markdown guide.md',
      content: `---
title: Markdown guide
created: ${today}
tags:
  - meta
---

neoma notes are ordinary Markdown files, portable to any other editor.

## Basics

**Bold**, *italic*, ~~strikethrough~~, ==highlighted==, \`inline code\`.

## Headings

Use \`#\` through \`######\`.

## Lists

- Unordered item
1. Ordered item
- [ ] Task to do
- [x] Task done

## Links

- Wiki link: [[Welcome to neoma]]
- Aliased: [[Welcome to neoma|the welcome note]]
- Heading link: [[Markdown guide#Tables]]
- External: [CommonMark](https://commonmark.org)

## Quotes and callouts

> A regular blockquote

> [!note] Callouts
> Use \`> [!note]\`, \`[!tip]\`, \`[!warning]\`, \`[!danger]\`, \`[!question]\`…

## Code

\`\`\`python
def hello():
    return "world"
\`\`\`

## Tables

| Syntax | Works |
| ------ | ----- |
| Tables | Yes   |

## Math

Inline $e^{i\\pi} + 1 = 0$ and display:

$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}$$

## Footnotes

Here is a footnote reference[^1].

[^1]: And here is the footnote.

## Tags and citations

Add #tags anywhere. Cite with Pandoc keys like [@vaswani2017attention].

---

Horizontal rule above.
`,
    },
    {
      path: 'Privacy and portability guide.md',
      content: `---
title: Privacy and portability guide
created: ${today}
tags:
  - meta
---

> [!note] The short version
> neoma does not collect, transmit or sell your notes or usage data. Your vault remains on your device unless you deliberately export or synchronise it using another tool.

## Where your notes live

- **Browser vault** — stored in this browser's IndexedDB. Fast and zero-setup, but clearing this site's browser data deletes it. Export regularly.
- **Local folder vault** — real \`.md\` files in a folder you choose (Chromium browsers). Perfect for Git, Syncthing, or backups.

## Getting data out

- **Export vault as ZIP** — the complete folder hierarchy, notes and attachments
- **Export note** — single note as Markdown or HTML, or print to PDF
- Notes open unmodified in VS Code, Obsidian, Logseq and any text editor

## What neoma never does

- No accounts, no cloud, no telemetry, no analytics, no tracking
- No hidden network requests — after first load the app works fully offline
- No proprietary formats — frontmatter is standard YAML, links are standard Markdown/wiki syntax
`,
    },
  ]
}
