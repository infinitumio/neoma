---
description: Set up, find your way around the code, and send a first pull request.
slug: developers
---

```bash
git clone https://github.com/infinitumio/neoma.git
cd neoma
npm ci
npm run dev                 # http://localhost:5173
```

| Command | Does |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | unit tests (Vitest) |
| `npm run test:e2e` | browser tests (Playwright) |
| `npm run build` | production build |

**Where things live**

- `src/storage/`: the `StorageAdapter`. The interface never touches files or IndexedDB directly.
- `src/workers/`: search and metadata, off the main thread.
- `src/markdown/`: the render pipeline shared by the editor, [[Publish]] and these docs.
- `src/links/`: the link graph, backlinks and safe renames.

**Extending.** Commands, panels, Markdown extensions and settings sections register through registries, the same way a plugin would. There is no plugin runtime yet. Themes are CSS variables.

Read `CONTRIBUTING.md` and `docs/architecture.md` in the repository, pick a `good first issue`, and open a pull request. The [[Open source]] page explains the licence.
