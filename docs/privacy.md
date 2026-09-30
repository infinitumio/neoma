# Privacy

> neoma does not collect, transmit or sell your notes or usage data. Your vault remains
> on your device unless you deliberately export or synchronise it using another tool.

## What neoma does

- Stores iPhone/iPad notes in **app storage**, web vaults in **browser storage**, or desktop notes in **a folder you choose**. App/browser vaults are exportable as Markdown and ZIP.
- Runs entirely client-side; the production build is static files
- Native apps bundle core assets for offline use; the web app caches assets after its first load.

## What this release does not include

- No user accounts
- No analytics
- No telemetry
- No advertisements
- No tracking pixels
- No remote AI or account API calls
- No note uploads
- No automatic cloud sync. Transfer vaults manually by export/import. Future services require their own review and disclosures.

## Remote content in notes

Markdown permits images and video embeds pointing at other people's servers. A
remote image is a beacon: whoever controls that address learns when the note was
opened and from where. If the note was written by somebody else, that is a
disclosure.

neoma strips remote image sources **before** the note is rendered, so no request
is made — not merely hidden afterwards. A marker shows what was blocked. Enable
it in Settings if you need it.

Native builds use a Content Security Policy restricting application connections. It permits opt-in HTTPS images/media and YouTube frames. CSP is defense in depth, not a guarantee against compromised code or user-enabled third-party content. The network tests assert no off-origin traffic in normal/default-content flows.

See [Confidentiality guarantees](../website/legal/confidentiality.md) for the
version written for a compliance reviewer.

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

Native direct-download desktop builds can also contact GitHub when checking for updates. Enabling remote content permits requests to image/video providers, including YouTube; these can reveal IP address and request metadata and are subject to provider privacy policies. Opening an external link contacts its destination.

You can verify this with your browser's DevTools network tab: after the app
loads, core writing and search remain local. Remote-content requests only occur when that setting is enabled. External links in your own notes open in a new tab only when you click them.

## The network-status indicator

The status bar shows **Local** (online, but everything stays local), **Offline**
(everything keeps working) or **Update available** (a new version was downloaded and
will apply when you choose). Offline is a normal, supported state — never an error.

## Your responsibilities

- Export backups of app/browser vaults. Uninstalling the native app or clearing browser site data can delete those vaults. Desktop folder vaults remain files in the selected folder.
- neoma stores data unencrypted (like any file on your disk). If your threat model
  requires encryption at rest, use OS-level disk encryption.
- If you put a vault in a synced/Git folder, that tool's privacy properties apply to it.

## For contributors

Any change to network behavior or data collection requires a privacy review and accurate disclosures. See the privacy checklist in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Before merging a CSP change

The Content Security Policy in `src-tauri/tauri.conf.json` ships to **every**
Tauri target. `tauri.appstore.conf.json` overrides only `capabilities`;
`security.csp` deep-merges through, so a change here reaches the desktop app,
the Mac App Store build and the live iOS TestFlight build alike.

Playwright runs in Chromium. The iOS and macOS targets run WKWebView, and the
two disagree. A CSP that passes the e2e suite can still break the shipped app —
and the failure mode is total, because blocking Tauri's IPC transport means the
webview cannot reach its own Rust side.

**Verify on a device or simulator before merging**, not only in CI:

```
npm run ios:dev -- "iPhone 17 Pro"
```

Open a vault, write a note, confirm it saves, and check the web inspector
console for `Refused to connect` or `Refused to load`. Those messages are how a
CSP failure announces itself.
