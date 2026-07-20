// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Built-in research templates. Users can also create their own templates as
 * ordinary notes inside the configured templates folder — those appear
 * alongside these in every template picker and can be edited or deleted like
 * any other note.
 */
import type { Template } from '@/types'

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank note',
    description: 'An empty note with basic frontmatter',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
tags: []
---

`,
  },
  {
    id: 'daily-research-journal',
    name: 'Daily research journal',
    description: 'Objectives, findings, decisions and next actions for the day',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
type: journal
tags:
  - journal
---

## Objectives

-

## Work completed

-

## Findings

-

## Decisions

-

## Problems

-

## Questions

-

## Supervisor follow-up

-

## Next actions

- [ ]
`,
  },
  {
    id: 'literature-note',
    name: 'Literature note',
    description: 'Structured reading notes for a paper or book',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
type: literature
status: reading
tags:
  - literature
doi: ""
bibtex-key: ""
zotero-uri: ""
---

## Citation

>

## Research question

-

## Methodology

-

## Dataset

-

## Main findings

-

## Limitations

-

## Important quotations

>

## Personal interpretation

-

## Connections to my research

-

## Follow-up reading

-
`,
  },
  {
    id: 'experiment-log',
    name: 'Experiment log',
    description: 'Hypothesis, setup, results and reproduction steps',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
type: experiment
status: active
tags:
  - experiments
---

## Hypothesis

-

## Environment

-

## Dataset

-

## Model or method

-

## Parameters

| Parameter | Value |
| --------- | ----- |
|           |       |

## Procedure

1.

## Results

-

## Unexpected behaviour

-

## Limitations

-

## Decision

-

## Reproduction steps

1.

## Next experiment

-
`,
  },
  {
    id: 'supervisor-meeting',
    name: 'Supervisor meeting',
    description: 'Agenda, feedback, decisions and actions from a supervision meeting',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
type: meeting
tags:
  - meetings
---

## Date

{{date}}

## Attendees

-

## Discussion

-

## Feedback

-

## Decisions

-

## Questions

-

## Actions

- [ ]

## Next meeting

-
`,
  },
  {
    id: 'research-question',
    name: 'Research question',
    description: 'Frame a research question with evidence, methods and risks',
    builtIn: true,
    content: `---
title: {{title}}
created: {{date}}
type: research-question
status: open
tags:
  - questions
---

## Question

-

## Motivation

-

## Existing evidence

-

## Assumptions

-

## Possible methods

-

## Risks

-

## Open questions

-

## Related notes

-
`,
  },
]
