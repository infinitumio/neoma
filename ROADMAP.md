# Neoma roadmap

Real status only. No dates we cannot keep. One rule outranks every feature:
**data integrity, portability and offline reliability are never traded for something new.**
Nothing unfinished is presented in the app as finished.

## Now

Work in progress.

- **Desktop 1.0.4.** The shared app is at 1.0.4 in source; the published desktop installers are
  still 0.3.0. Next: publish the 1.0.4 installers and the in-app update feed.
- **iPhone and iPad 1.0.4.** Release candidate built and verified; TestFlight upload and App
  Review submission are the remaining steps.
- **Windows code signing.** Installers are unsigned today, so SmartScreen warns on first run.
- **The new Neoma identity.** Website, docs and app chrome moving to one design system.

## Next

Decided, not started.

- **Mobile web polish.** Bottom navigation, drawers and larger touch targets in the PWA.
- **Conflict screen.** Keep both, show differences, merge, when a file changed in two places.
- **Notion import.** Markdown, CSV and attachments, with an honest report of anything that could
  not be converted.

## Later

Directions we intend to explore. Each will be optional and replaceable.

- **Sync adapters.** Local network, WebDAV, Syncthing folders, Git, user-chosen cloud folders and
  a self-hosted server. Local files stay the source of truth; conflicts are never silently
  discarded; end-to-end encryption for remote sync where practical.
- **Plugins.** The extension points already exist (commands, panels, Markdown extensions,
  settings). A runtime that safely loads third-party code does not.

## Recently shipped

- Note embeds: `![[Note]]` and `![[Note#Heading]]`
- Dated reminders from the slash menu, tracked as tasks
- Neoma Publish: a vault as a static website, with themes, search and graph
- Neoma Help, published from a vault
- PDF viewer with text layer, search, page links and split view
- Tasks, calendar with ICS import, study dashboard and flashcard review

## Not planned

- Accounts, hosted cloud storage, or any mandatory server
- Telemetry of any kind
- Proprietary note formats
- AI as a required part of Neoma. If local AI tools ever arrive, they will be on-device,
  optional plugins that are off by default.
