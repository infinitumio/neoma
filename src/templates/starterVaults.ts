// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Starter vault content. When someone creates their first vault they can pick
 * a starter, which seeds a few real, editable pages so the vault isn't empty
 * and unfamiliar. All content is ordinary Markdown — nothing proprietary.
 */
import { isoDate } from '@/utils/dates'

export type StarterId = 'university' | 'research' | 'personal' | 'blank'

export interface Starter {
  id: StarterId
  name: string
  description: string
  files: () => Array<{ path: string; content: string }>
}

const today = () => isoDate()

export const STARTERS: Starter[] = [
  {
    id: 'university',
    name: 'University study',
    description: 'Courses, lecture notes, exam prep — set up for a semester of study.',
    files: () => [
      {
        path: 'Start here.md',
        content: `---
type: page
tags:
  - meta
---

# Welcome to your study vault

This vault is set up for university. A **page** is a note; a page can contain
**subpages** (right-click a page → *New subpage*, or drag one page onto another).

## Try this

1. Open [[Courses/Courses]] to see your course pages
2. Press \`Ctrl/Cmd+K\` for the command palette
3. Type \`/\` on a blank line for the slash-command menu (headings, equations, callouts…)
4. Open the **Exam preparation** page and add a real exam

> [!tip] Everything is offline and private
> Your pages are Markdown files on this device. Nothing is uploaded.
`,
      },
      {
        path: 'Courses/Courses.md',
        content: `---
type: index
---

# Courses

A page per course. Create a subpage of a course for each week's lecture.

- [[Courses/Example Course]]
`,
      },
      {
        path: 'Courses/Example Course/Example Course.md',
        content: `---
type: course
course: Example Course
tags:
  - course
---

# Example Course

- Lecturer:
- Semester:
- Assessment:

## Weeks

Create a subpage for each week (right-click → New subpage).
`,
      },
      {
        path: 'Courses/Example Course/Week 1 - Introduction.md',
        content: `---
type: lecture
course: Example Course
week: 1
tags:
  - lecture
---

# Week 1 — Introduction

## Source material

Paste or reference the lecture content here.

## My explanation

Rewrite the key ideas in your own words:

## Mathematical definitions

$$
f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## What I do not understand

- [ ]

## Exam summary

- ==Key point to remember==
`,
      },
      {
        path: 'Exam preparation.md',
        content: `---
type: dashboard
tags:
  - exams
---

# Exam preparation

## Upcoming exams

| Course | Date | Topics to review |
| ------ | ---- | ---------------- |
|        |      |                  |

## Revision checklist

- [ ] Re-read lecture notes
- [ ] Summarise each week in my own words
- [ ] Work through practice questions
- [ ] Review weak topics

## Flashcards

Question:: What is the format of the exam?
Answer:: (fill this in)
`,
      },
    ],
  },
  {
    id: 'research',
    name: 'Research project',
    description: 'Literature notes, experiment logs and a research journal.',
    files: () => [
      {
        path: 'Research dashboard.md',
        content: `---
type: dashboard
tags:
  - meta
---

# Research dashboard

- Reading: create literature notes under [[Literature/Literature]]
- Experiments: log runs under [[Experiments/Experiments]]
- Journal: [[Journal/${today()}|Today's entry]]

> [!definition] Vault
> A vault is the folder where neoma keeps a set of related pages, attachments
> and settings. You might keep separate vaults for different projects.
`,
      },
      {
        path: 'Literature/Literature.md',
        content: `---
type: index
---

# Literature

One page per paper. Use the slash command **Literature note section** to add
the standard structure.
`,
      },
      {
        path: 'Experiments/Experiments.md',
        content: `---
type: index
---

# Experiments

One page per experiment run. Use the **Experiment log** template.
`,
      },
      {
        path: `Journal/${today()}.md`,
        content: `---
type: journal
tags:
  - journal
---

# ${today()}

## Objectives

-

## Findings

-

## Next actions

- [ ]
`,
      },
    ],
  },
  {
    id: 'personal',
    name: 'Personal knowledge base',
    description: 'A calm home for notes, ideas and things you want to remember.',
    files: () => [
      {
        path: 'Home.md',
        content: `---
type: page
tags:
  - meta
---

# Home

Welcome to your knowledge base. Link pages with \`[[double brackets]]\` and they
connect automatically — open the **Graph** in the left rail to see the web of
ideas grow.

## Areas

- [[Ideas]]
- [[Reading list]]
- [[People]]
`,
      },
      { path: 'Ideas.md', content: `# Ideas\n\n- \n` },
      {
        path: 'Reading list.md',
        content: `# Reading list\n\n- [ ] \n`,
      },
      { path: 'People.md', content: `# People\n\n- \n` },
    ],
  },
  {
    id: 'blank',
    name: 'Blank vault',
    description: 'Start with a single empty page.',
    files: () => [{ path: 'Untitled.md', content: '' }],
  },
]

export function getStarter(id: StarterId): Starter {
  return STARTERS.find((s) => s.id === id) ?? STARTERS[STARTERS.length - 1]
}
