# How neoma stores your notes

Markdown files are the **canonical format**. Everything else (search index, link graph)
is derived and rebuildable. There is no proprietary note format and no remote database.

## Vault types

### Browser vault

- Backed by IndexedDB (via Dexie) in the browser you're using
- Works in every modern browser, fully offline, autosaves locally
- Multiple vaults supported; each is isolated
- **Caveat (shown in the app too):** clearing this site's browsing data deletes browser
  vaults. Export a ZIP backup regularly, or use a local-folder vault.

### Local-folder vault

- Backed by a real folder you choose, via the File System Access API
  (Chromium-based browsers: Chrome, Edge, Brave, Arc, …)
- Notes are ordinary `.md` files; attachments are ordinary files — usable with Git,
  Syncthing, Time Machine, or any other tool
- neoma requests folder permission **only after you explicitly choose a folder**, and the
  browser may re-ask after a restart (neoma shows a one-click re-grant dialog)
- Writes are atomic: content is written to a temporary file and swapped on close
- If another program modifies a note while it's open in neoma, a conflict dialog lets
  you choose which version to keep — nothing is overwritten silently

Browsers without the File System Access API (Firefox, Safari) can use browser vaults and
import/export; the welcome screen explains this honestly.

## Trash / recently deleted

Deleting a file copies it into a recoverable trash (IndexedDB) first — for both vault
types — then removes it. Restore or purge from the _Recently deleted_ panel. Permanent
deletion always requires an explicit confirmation.

## Import and export

- **Import**: a whole folder (where supported), individual `.md` files, or a ZIP archive
- **Export**: the complete vault as ZIP (exact folder hierarchy and attachment paths
  preserved), a single note as Markdown or standalone HTML, or PDF via the print dialog
- ZIP imports skip unsafe entries (path traversal, hidden segments)
- Settings have their own JSON export/import in Settings → Backups

## Attachments

Pasted or dropped images/PDFs are saved into a configurable attachment folder
(default `Attachments/`) and referenced with **relative Markdown paths** like
`![figure](Attachments/figure.png)` — portable to any other Markdown tool. Attachments
are never uploaded anywhere.

## Using Git with a vault

neoma doesn't implement Git, but folder vaults are deliberately Git-friendly:

- Plain Markdown, stable frontmatter formatting, relative attachment paths
- No binary database inside the vault folder
- Unchanged notes are never rewritten; no random IDs are inserted into content
- Predictable filenames (`Note name.md`, `YYYY-MM-DD.md` daily notes)

To version a vault:

```bash
cd /path/to/your/vault
git init
git add .
git commit -m "Initial vault snapshot"
# optional: private remote
git remote add origin git@github.com:you/my-vault.git
git push -u origin main
```

A useful `.gitignore` for a vault is usually empty — everything in a vault is worth
versioning. Commit as often as you like; neoma never fights external changes (see
conflict handling above).

## Storage abstraction (for contributors)

All of the above sits behind the `StorageAdapter` interface (`src/types/index.ts`):
`list`, `stat`, `readText/writeText`, `readBinary/writeBinary`, `deleteFile`, `rename`,
folder operations, and trash operations. The UI only ever talks to an adapter, so new
mechanisms (e.g. the Origin Private File System) can be added without touching features.
