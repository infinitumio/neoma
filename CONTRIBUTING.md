# Contributing to neoma

Thank you for considering a contribution! neoma is a community-driven project and aims
to be an approachable codebase.

## Development setup

```bash
git clone https://github.com/infinitumio/neoma.git
cd neoma
nvm use            # Node 20 (see .nvmrc)
npm ci
npm run dev        # http://localhost:5173
```

Useful commands:

| Command                                   | What it does                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`                             | Dev server with hot reload                                                       |
| `npm run typecheck`                       | TypeScript project check                                                         |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                           |
| `npm run format` / `npm run format:check` | Prettier                                                                         |
| `npm test` / `npm run test:watch`         | Unit tests (Vitest)                                                              |
| `npm run test:e2e`                        | End-to-end tests (Playwright) — run `npx playwright install chromium` once first |
| `npm run build` && `npm run preview`      | Production build + local serve                                                   |
| `npm run icons`                           | Regenerate PWA icons from `public/favicon.svg`                                   |

## Architecture overview

Read [docs/architecture.md](docs/architecture.md) first. The short version:

- `src/storage/` — the **StorageAdapter** abstraction. UI code never touches IndexedDB
  or file handles directly.
- `src/workers/indexWorker.ts` — search + metadata extraction off the main thread.
- `src/links/` — link graph, backlinks, rename link-rewriting.
- `src/markdown/` — frontmatter, metadata extraction, and the unified render pipeline.
- `src/app/` — zustand stores that orchestrate everything.
- `src/components/` — React UI. Panels register through `src/app/registries.ts`.
- Registries (commands, panels, markdown extensions, settings) are the plugin-ready
  extension points; first-party features use them too.

## How to contribute

- **Bug reports** — use the bug-report issue template. Include reproduction steps and
  browser/OS. Never include your private notes; a minimal reproduction vault is ideal.
- **Feature requests** — use the feature-request template. Explain the problem before
  the solution, and note how it interacts with the privacy/portability principles.
- **Good first issues** — maintainers label approachable work with `good first issue`.
  Comment on the issue before starting so effort isn't duplicated.
- **Pull requests** — small and focused beats large and sweeping. Open a draft early if
  you want direction.

## Pull-request checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass
- [ ] E2E tests pass (or new flows are covered by new e2e tests)
- [ ] New user-facing features are keyboard-accessible and screen-reader friendly
- [ ] No new external network requests of any kind
- [ ] Notes remain portable (no proprietary syntax written into user files)
- [ ] New dependencies are justified, small, and AGPL-compatible (MIT/ISC/Apache-2.0/BSD)
- [ ] SPDX licence header on new source files
- [ ] Docs updated (README, docs/, or settings descriptions) if behaviour changed

## Commit guidance

- Present-tense, imperative subject lines: `Add tag autocomplete to editor`
- One logical change per commit where practical
- Reference issues (`Fixes #123`) in the body

## Accessibility checklist

- Full keyboard navigation (tab order, Enter/Space activation, Escape closes overlays)
- Visible focus indicators — never remove them without an equivalent
- Semantic HTML and ARIA labels for icon-only buttons
- No colour-only status indicators; respect `prefers-reduced-motion`
- Test dialogs and menus with a screen reader when you change them
- Test at 200 % zoom

## Privacy checklist

Contributions must not introduce:

- Telemetry or analytics of any kind
- Tracking pixels or fingerprinting
- Mandatory cloud services or accounts
- Proprietary note formats
- Undocumented external requests (fonts, CDNs, APIs — everything must be bundled)
- Dependencies that compromise the open-source licence

If a feature genuinely needs the network (e.g. a future optional sync), it must be
opt-in, transparent, documented, and default-off.

## Dependency-licence checklist

- Prefer zero new dependencies; the bundle size budget is real
- Allowed licences: MIT, ISC, BSD-2/3, Apache-2.0 (AGPL-compatible)
- Run `npx license-checker --summary` if unsure
- No proprietary SDKs, no packages that phone home

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
