// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Registers the first-party sidebar panels through the panel registry —
 * the same path a future plugin would take.
 */
import {
  Files,
  Search,
  Tags,
  Link2,
  CalendarDays,
  LayoutTemplate,
  Trash2,
  GraduationCap,
  ListTodo,
} from 'lucide-react'
import { registerPanel } from './registries'
import { FilesPanel } from '@/components/panels/FilesPanel'
import { SearchPanel } from '@/components/panels/SearchPanel'
import { TagsPanel } from '@/components/panels/TagsPanel'
import { BacklinksPanel } from '@/components/panels/BacklinksPanel'
import { DailyPanel } from '@/components/panels/DailyPanel'
import { TemplatesPanel } from '@/components/panels/TemplatesPanel'
import { TrashPanel } from '@/components/panels/TrashPanel'
import { StudyPanel } from '@/components/panels/StudyPanel'
import { TasksPanel } from '@/components/panels/TasksPanel'

let done = false

export function registerBuiltinPanels(): void {
  if (done) return
  done = true
  registerPanel({ id: 'files', label: 'Files', icon: Files, component: FilesPanel, order: 10 })
  registerPanel({ id: 'search', label: 'Search', icon: Search, component: SearchPanel, order: 20 })
  registerPanel({ id: 'tags', label: 'Tags', icon: Tags, component: TagsPanel, order: 30 })
  registerPanel({
    id: 'backlinks',
    label: 'Backlinks',
    icon: Link2,
    component: BacklinksPanel,
    order: 40,
  })
  registerPanel({
    id: 'daily',
    label: 'Daily journal',
    icon: CalendarDays,
    component: DailyPanel,
    order: 50,
  })
  registerPanel({
    id: 'study',
    label: 'Study',
    icon: GraduationCap,
    component: StudyPanel,
    order: 55,
  })
  registerPanel({
    id: 'tasks',
    label: 'Tasks',
    icon: ListTodo,
    component: TasksPanel,
    order: 56,
  })
  registerPanel({
    id: 'templates',
    label: 'Templates',
    icon: LayoutTemplate,
    component: TemplatesPanel,
    order: 60,
  })
  registerPanel({
    id: 'trash',
    label: 'Recently deleted',
    icon: Trash2,
    component: TrashPanel,
    order: 70,
  })
}
