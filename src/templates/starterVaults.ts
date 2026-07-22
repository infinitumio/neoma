// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Starter vault content. When someone creates their first vault they can pick
 * a starter, which seeds a few real, editable pages so the vault isn't empty
 * and unfamiliar. All content is ordinary Markdown — nothing proprietary.
 */
import { addDays, isoDate } from '@/utils/dates'

export type StarterId = 'demo' | 'university' | 'research' | 'personal' | 'blank'

export interface Starter {
  id: StarterId
  name: string
  description: string
  files: () => Array<{ path: string; content: string }>
}

const today = () => isoDate()
/** ISO date `n` days from today — used to seed live calendar/task content. */
const d = (n: number) => isoDate(addDays(new Date(), n))

export const STARTERS: Starter[] = [
  {
    id: 'demo',
    name: 'Feature tour',
    description: 'A guided vault that shows off every feature — dates are set around today.',
    files: () => [
      {
        path: 'Start here.md',
        content: `---
title: Start here
type: page
color: green
tags:
  - tour
---

# 👋 Welcome to the neoma feature tour

This vault is filled with live examples. Everything is a plain Markdown file on
your device — nothing is uploaded. Work through the pages below, then delete
what you don't need.

> [!tip] Two things to try first
> 1. Type \`/\` on a blank line for the **slash menu** (headings, math, callouts, columns…).
> 2. Press \`Ctrl/Cmd+K\` for the **command palette**.

## The tour

- [[Tour/Text, callouts & columns]] — formatting, callouts, highlights, columns
- [[Tour/Mathematics]] — LaTeX, matrices, theorems
- [[Tour/Flashcards]] — flip cards you can review
- [[Tour/Tasks & dates]] — checkboxes with due dates that land on the calendar
- [[Courses/Courses]] — pages, **subpages**, and an **exam** page
- Open the **Planner** in the left rail (Journal · Calendar · Tasks), the
  **Study** panel, and the **Graph** view.

Tags like #tour and #biology are clickable, and so are [[wiki links]].
`,
      },
      {
        path: 'Tour/Text, callouts & columns.md',
        content: `---
title: Text, callouts & columns
tags:
  - tour
---

# Text & formatting

**Bold**, *italic*, <u>underline</u>, ~~strikethrough~~, \`inline code\`, and
==highlighted== text. You can also colour highlights:
<mark data-color="blue">blue</mark>, <mark data-color="orange">orange</mark>.

## Callouts

> [!note] Note
> Callouts group information. Types include note, tip, warning, example, quote.

> [!warning] Watch out
> This is a warning callout.

## Columns

Write things side by side with the **Columns** slash command:

:::columns
### Pros
- Offline & private
- Plain Markdown
- Fast search
|||
### Cons
- You'll want to tell your friends
- Hard to go back to other apps
:::

## Task list (tick these in reading view)

- [x] Read *Start here*
- [ ] Explore the slash menu
- [ ] Open the Graph view

---

Links: [[Start here]] · [[Tour/Mathematics]]
`,
      },
      {
        path: 'Tour/Mathematics.md',
        content: `---
title: Mathematics
tags:
  - tour
---

# Mathematics (KaTeX, offline)

Inline math like $e^{i\\pi} + 1 = 0$, and display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

A matrix:

$$
\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}
$$

> [!definition] Bayes' theorem
> $$ P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)} $$

Double-click any rendered equation in reading view to copy its LaTeX.
`,
      },
      {
        path: 'Tour/Flashcards.md',
        content: `---
title: Flashcards
tags:
  - tour
  - revision
---

# Flashcards

In **reading view** these become flip cards. In the **Study** panel (or with the
*Review Flashcards* command) you can review them — reveal, rate, shuffle.

Question:: What does neoma store your notes as?
Answer:: Plain Markdown files on your own device.
Topic:: neoma basics

Question:: What is the powerhouse of the cell?
Answer:: The mitochondria.
Topic:: Biology

The capital of France :: Paris
`,
      },
      {
        path: 'Tour/Tasks & dates.md',
        content: `---
title: Tasks & dates
tags:
  - tour
---

# Tasks with due dates

These show up in the **Tasks** panel (Today / Upcoming) and on the **Calendar**.
Set or change a due date from the Tasks panel's date picker.

- [ ] Skim the tour pages 📅 ${d(0)} ⏫ #course/tour
- [ ] Try the flashcard review 📅 ${d(2)} #course/tour
- [ ] Add your own exam page 📅 ${d(5)} 🔼
- [x] Create this vault

Priorities: ⏫ high · 🔼 medium · 🔽 low. Recurrence: 🔁 every week.
`,
      },
      {
        path: 'Courses/Courses.md',
        content: `---
title: Courses
type: page
tags:
  - tour
---

# Courses

This page has **subpages** (folder-note hierarchy). Open [[Courses/Biology 101/Biology 101|Biology 101]].
`,
      },
      {
        path: 'Courses/Biology 101/Biology 101.md',
        content: `---
title: Biology 101
type: course
course: Biology
color: blue
tags:
  - biology
---

# Biology 101

- Lecture: [[Courses/Biology 101/Lecture 1 — Cells|Lecture 1 — Cells]]
- Exam: [[Courses/Biology 101/Final exam|Final exam]]

Below is a live embed of the lecture:

![[Courses/Biology 101/Lecture 1 — Cells]]
`,
      },
      {
        path: 'Courses/Biology 101/Lecture 1 — Cells.md',
        content: `---
title: Lecture 1 — Cells
type: lecture
course: Biology
date: ${d(-3)}
tags:
  - biology
---

# Lecture 1 — Cells

## Key idea

==The cell is the basic unit of life.== Mitochondria produce ATP.

## Flashcards

Question:: What produces ATP in the cell?
Answer:: The mitochondria.
Topic:: Biology
`,
      },
      {
        path: 'Courses/Biology 101/Final exam.md',
        content: `---
title: Biology 101 — Final exam
type: exam
course: Biology
exam-date: ${d(12)}
location: Hall B
confidence: 2
tags:
  - biology
  - exam
---

# Biology 101 — Final exam

## Topics to review

- [ ] Cell structure
- [ ] Photosynthesis
- [ ] Genetics

## Practice questions

1. Describe the role of mitochondria.

## Flashcards

Question:: Where does photosynthesis occur?
Answer:: In the chloroplasts.
Topic:: Biology
`,
      },
      {
        // Events live in the day's folder, next to that day's journal note.
        path: `Calendar/${d(2)}/Study group.md`,
        content: `---
title: Study group
type: event
date: ${d(2)}
course: Biology
tags:
  - event
---

# Study group

Meet to review [[Courses/Biology 101/Lecture 1 — Cells|Lecture 1]]. Referenced on
[[${d(2)}]] so it shows a link marker on the calendar.
`,
      },
      {
        // The journal note is the folder-note of its day folder.
        path: `Calendar/${today()}/${today()}.md`,
        content: `---
title: ${today()}
created: ${today()}
type: journal
tags:
  - journal
---

# ${today()}

## Objectives

- Explore neoma

## Quick notes

- Add jottings here from the Journal panel's "Quick notes" box.
`,
      },
    ],
  },
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
