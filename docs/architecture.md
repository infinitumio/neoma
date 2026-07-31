# neoma architecture

neoma is a client-only React + TypeScript application. There is no backend: every
feature runs in the browser, and the production build is a static site.

```text
src/
├── app/          Application shell, zustand stores, registries, PWA lifecycle
├── components/   React UI (panels, dialogs, editor/preview wrappers)
├── editor/       CodeMirror 6 setup: extensions, theme, commands, completion
├── markdown/     Frontmatter, metadata extraction, unified render pipeline, registry
├── storage/      Storage abstraction
│   ├── adapters/         Adapter façade
│   ├── browser-vault/    IndexedDB adapter (Dexie)
│   ├── local-folder/     File System Access API adapter
│   └── import-export/    ZIP/Markdown/HTML export, imports
├── search/       Search client (worker RPC) + query parser
├── links/        Link graph, backlinks, rename link-rewriting
├── graph/        Lazy-loaded canvas graph view + force layout
├── templates/    Built-in templates, template service, daily notes, demo vault
├── commands/     Command registry, default commands, shortcut handling
├── settings/     Settings store (localStorage), defaults, import/export
├── themes/       Design tokens and all CSS
├── workers/      Web Workers (index/search)
├── hooks/        Shared React hooks
├── utils/        Paths, dates, misc helpers
└── types/        Shared domain types and contracts
```

## Data flow

```text
        ┌───────────────┐   readText/writeText   ┌──────────────────┐
UI ───▶ │  vaultStore    │ ─────────────────────▶ │  StorageAdapter  │
        │  (zustand)     │ ◀───────────────────── │  browser / folder│
        └──────┬────────┘        entries          └──────────────────┘
               │ upsert(text)
               ▼
        ┌───────────────┐  NoteMeta   ┌───────────────┐
        │  index worker  │ ──────────▶ │   LinkGraph   │──▶ backlinks, tags,
        │  (MiniSearch + │             │ (main thread) │    resolution, graph
        │   extraction)  │◀── query ── └───────────────┘
        └───────────────┘
```

- **The UI never calls IndexedDB or file APIs directly.** All file operations go through
  the `StorageAdapter` interface (`src/types/index.ts`), so new backends (e.g. OPFS) are
  additive.
- **The index worker owns note text.** Full-text search, snippet generation, unlinked-
  mention scans and backlink context all happen off the main thread. The main thread
  keeps only lightweight `NoteMeta` per note.
- **The link graph** answers name→path resolution (names, titles, aliases, paths),
  backlinks, broken links and orphan status. Rename operations use it to build a
  user-reviewable link-update plan — files are never rewritten silently.

## Key contracts (src/types/index.ts)

`Vault`, `Note`, `NoteMeta`, `Folder`, `Attachment`, `FileEntry`, `TrashEntry`,
`StorageAdapter`, `SearchIndex`, `LinkIndex`, `Command`, `Template`, `Theme`,
`ApplicationSettings`, `TabState`.

## Registries

Four documented registries make neoma plugin-ready without shipping a plugin runtime:

| Registry            | Module                     | Used for                                     |
| ------------------- | -------------------------- | -------------------------------------------- |
| Commands            | `src/commands/registry.ts` | Palette entries + shortcuts                  |
| Panels              | `src/app/registries.ts`    | Activity-rail/sidebar panels                 |
| Markdown extensions | `src/markdown/registry.ts` | remark/rehype plugins in the render pipeline |
| Settings sections   | `src/app/registries.ts`    | Settings dialog panes                        |

First-party features register through these exactly as a future plugin would
(`src/app/registerBuiltins.ts`, `src/commands/defaultCommands.ts`). Version 1 does not
execute third-party code.

## State management

Small zustand stores, one per concern:

- `vaultStore` — vault lifecycle, entries, note cache, saves/conflicts, trash, pins
- `tabsStore` — tabs (persisted per vault)
- `uiStore` — panels, dialogs, palette, toasts
- `settingsStore` — persisted `ApplicationSettings`

Non-serialisable singletons (adapter, search client, link graph) live at module scope in
`vaultStore`, not in React state.

## Performance decisions

- Editor-first startup: the file list renders before indexing completes; indexing runs
  in batches through the worker.
- Code-splitting: the graph view, the markdown/KaTeX preview pipeline and CodeMirror
  code-block languages all load on demand.
- Only the active tab's editor is mounted; per-note `EditorState` is cached in memory.
- Autosave and search input are debounced; no polling anywhere.

## Theming

All visual tokens are CSS variables declared in `src/themes/tokens.css` on
`:root[data-theme='dark']` and `:root[data-theme='light']`. A community theme is a
stylesheet loaded after the app's CSS that re-declares any of the documented variables —
no source changes required. The CodeMirror theme reads the same variables.

## Data integrity

- Debounced autosave with visible save state; `Mod+S` forces a save
- Saves flush on tab hide/close — unsaved text is never silently discarded
- Atomic writes on local folders (`createWritable` writes a temp file, swaps on close)
- Deletion always goes through a recoverable trash (IndexedDB), with confirmation
- Conflict detection: if a local file changed on disk since neoma last read it, the user
  chooses which version wins before anything is overwritten
- Rename link-updates show a review dialog before rewriting other notes
- Revoked folder permissions surface a re-grant dialog; nothing is lost
