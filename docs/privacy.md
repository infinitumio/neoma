# Privacy

> neoma does not collect, transmit or sell your notes or usage data. Your vault remains
> on your device unless you deliberately export or synchronise it using another tool.

## What neoma does

- Stores notes in **your browser's storage** or **a folder you choose** on your device
- Runs entirely client-side; the production build is static files
- Works fully offline after the first load (service worker precache)

## What neoma never does

- No user accounts
- No analytics
- No telemetry
- No advertisements
- No tracking pixels
- No external API calls
- No note uploads
- No hidden network requests
- No remote AI functionality
- No cloud dependency
- No automatic data collection

All fonts, icons, scripts and styles are bundled with the application. Nothing is loaded
from CDNs at runtime.

## Network activity — complete list

| Request                                          | When                                  | Why             |
| ------------------------------------------------ | ------------------------------------- | --------------- |
| Fetching the app's own files (HTML/JS/CSS/icons) | First visit and when an update exists | It's a website  |
| Service-worker precache of those same files      | After first load                      | Offline support |

That's all. You can verify this with your browser's DevTools network tab: after the app
loads, no further requests occur while you write, search, link, export or change
settings. External links in your own notes open in a new tab only when you click them.

## The network-status indicator

The status bar shows **Local** (online, but everything stays local), **Offline**
(everything keeps working) or **Update available** (a new version was downloaded and
will apply when you choose). Offline is a normal, supported state — never an error.

## Your responsibilities

- Browser vaults live in the browser: clearing site data deletes them. Export backups.
- neoma stores data unencrypted (like any file on your disk). If your threat model
  requires encryption at rest, use OS-level disk encryption.
- If you put a vault in a synced/Git folder, that tool's privacy properties apply to it.

## For contributors

Any change that adds a network request, tracking, or data collection of any kind will be
rejected — see the privacy checklist in [CONTRIBUTING.md](../CONTRIBUTING.md).
