<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Building the Neoma app (Tauri) — macOS, iOS, and desktop

Neoma's native builds wrap the exact same offline web app in a
[Tauri 2](https://tauri.app) shell. On the desktop that adds a native window, a
system tray, single-instance focus, optional launch-on-startup, and native
dialogs/notifications. On iOS it runs as a normal app. **No network access and
no telemetry are added.** The web app remains the source of truth; your notes
stay plain Markdown on your device.

> **Status:** the `src-tauri/` crate builds locally with a Rust toolchain; the
> repository's CI builds the PWA only and does **not** compile Rust. Nothing in
> the app claims to be a signed release until it is (see [INSTALL.md](INSTALL.md)).
> **macOS and iOS are the current focus** — Windows/Linux/Android configuration
> is present but not the priority.

## Prerequisites

- **Node 20+** and the JS dependencies (`npm ci`)
- **Rust** (stable) via [rustup](https://rustup.rs)
- The Tauri CLI is already a dev dependency (`@tauri-apps/cli`)
- Platform toolchains — see <https://tauri.app/start/prerequisites/>:
  - **macOS app:** Xcode Command Line Tools (`xcode-select --install`)
  - **iOS app:** the **full Xcode** (not just CLT), an iOS Simulator or device,
    and — for signing/distribution — a paid **Apple Developer** account
  - **Windows:** MSVC Build Tools + WebView2 · **Linux:** `webkit2gtk`, etc.

## Icons

The full icon set (`.icns`, `.ico`, PNGs, the iOS `AppIcon` set, Android
mipmaps) is **already generated and committed** under `src-tauri/icons/`. Only
re-run this when the logo changes:

```bash
npx tauri icon src-tauri/icon-source.svg   # regenerates every size from one source
```

## Desktop (macOS)

```bash
npm run desktop:dev     # hot-reloads the Vite dev server in a native window
npm run desktop:build   # produces a .app + .dmg under src-tauri/target/release/bundle/
```

Typical outputs (filenames derive from the product name **Neoma**):

| OS      | Artifact                                               |
| ------- | ------------------------------------------------------ |
| macOS   | `bundle/dmg/Neoma_0.2.0_aarch64.dmg` (or `_universal`) |
| Windows | `bundle/nsis/Neoma_0.2.0_x64-setup.exe`                |
| Linux   | `bundle/appimage/Neoma_0.2.0_amd64.AppImage`, `.deb`   |

## iOS

```bash
npm run ios:init        # one-time: generates the Xcode project at src-tauri/gen/apple
npm run ios:dev         # run in the Simulator (or a connected device)
npm run ios:build       # archive an .ipa (needs your Apple Team ID)
```

Notes:

- `ios:init` scaffolds `src-tauri/gen/apple/` (a real Xcode project). It is
  generated, so it is git-ignored by default; commit it only if you want the
  Xcode settings under version control.
- Signing uses your Apple Team ID. Provide it via the
  `TAURI_APPLE_DEVELOPMENT_TEAM` environment variable, or open the project in
  Xcode (`src-tauri/gen/apple/Neoma.xcodeproj`) and pick your team under
  _Signing & Capabilities_. TestFlight / App Store distribution is done from
  Xcode as usual.
- The UI is responsive and touch-friendly (the activity rail collapses, the file
  tree becomes a drawer). See the mobile breakpoints in `src/themes/layout.css`.

## What the desktop shell does

- **Single instance** — relaunching focuses the existing window.
- **System tray** — a tray icon with _Show Neoma_ / _Quit_.
- **Close behaviour** — configurable in **Settings → Desktop** (quit / minimise
  to tray / ask). The native close handler reads the preference the web app
  sends via the `set_close_behavior` command; default is _minimise to tray_.
- **Launch on startup** — optional, via `tauri-plugin-autostart` (off by
  default; toggled in **Settings → Desktop**).
- **Offline startup** — boots with no network and reopens your last vault and
  tabs.

## Signing

Desktop installers and the iOS app are **unsigned by default**. See the honest
note in [INSTALL.md](INSTALL.md). To sign:

- **macOS:** an Apple Developer ID certificate + notarisation
  (`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` env vars in
  CI, or Xcode locally).
- **iOS:** required for any device install — your Apple Team ID as above.
- **Windows:** an Authenticode certificate
  (`tauri.conf.json → bundle.windows.certificateThumbprint`).

Until a target is signed, the releases page states so plainly and explains the
OS warning users will see.
