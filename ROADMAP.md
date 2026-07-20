# neoma roadmap

Guiding rule: **data integrity, portability and offline reliability are never sacrificed
for new features.**

## Shipped in 0.1

Editor, reading/split preview, browser + local-folder vaults, import/export, file tree,
search, wiki links, backlinks, tags, frontmatter, daily notes, templates, command
palette, dark/light themes, PWA install, full offline operation, automated tests,
documentation.

## Next (0.x)

- [ ] Editor niceties: live inline preview decorations, heading fold, drag to reorder lists
- [ ] Saved searches and search history
- [ ] Attachment manager (orphaned attachment cleanup)
- [ ] Vault statistics panel
- [ ] More export targets (single-folder HTML site export)
- [ ] Mobile polish: swipe between panels, larger touch targets

## Later (1.x+)

- [ ] **Community plugins** — sandboxed plugin API built on the existing command/panel/
      markdown/settings registries; no arbitrary third-party code before a security review
- [ ] **Community themes** — theme gallery consuming the documented CSS-variable contract
- [ ] **Optional encrypted sync** — end-to-end encrypted, self-hostable, always opt-in
- [ ] **Advanced Zotero plugin** — bibliography rendering from local Better BibTeX exports
- [ ] **Collaborative editing** — CRDT-based, local-first
- [ ] **Canvas** — spatial note arrangement
- [ ] **Publish-to-web** — static export of selected notes
- [ ] **Local AI integrations** — strictly on-device models, default-off
- [ ] Mobile-native wrappers if PWA limitations demand it

## Explicit non-goals

- Accounts, hosted cloud storage, or any mandatory server
- Telemetry of any kind
- Proprietary note formats
- An online marketplace in the near term
