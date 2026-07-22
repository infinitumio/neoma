<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Building the neoma desktop app (Tauri)

neoma's desktop build wraps the exact same offline web app in a native
[Tauri 2](https://tauri.app) shell — a native window, a system tray,
single-instance focus, optional launch-on-startup, and native
dialogs/notifications. **No network access and no telemetry are added.** The
web app remains the source of truth; your notes stay plain Markdown files on
your disk.

> **Status:** the `src-tauri/` crate is a scaffold. The repository's CI builds
> the PWA only — it does **not** compile Rust. The steps below build the desktop
> app locally. Nothing in the app claims to be a signed release until it is (see
> [INSTALL.md](INSTALL.md)).

## Prerequisites

- **Node 20+** and the repo's JS dependencies (`npm ci`)
- **Rust** (stable) via [rustup](https://rustup.rs)
- Platform toolchains required by Tauri — see
  <https://tauri.app/start/prerequisites/>:
  - **Windows:** Microsoft C++ Build Tools + WebView2 (preinstalled on Win 11)
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `webkit2gtk`, `libayatana-appindicator`, etc.
- The Tauri CLI: `npm i -D @tauri-apps/cli` (kept out of the default
  dependencies so PWA-only installs stay lean)

## Icons

Generate the native icon set once from a square source PNG (≥ 512×512):

```bash
npm run tauri icon path/to/neoma-logo.png
```

This writes `src-tauri/icons/` (`.ico`, `.icns`, PNGs) referenced by
`tauri.conf.json`.

## Develop

```bash
npm run desktop:dev     # tauri dev — hot-reloads the Vite dev server in a native window
```

## Build installers

```bash
npm run desktop:build   # tauri build — produces installers under src-tauri/target/release/bundle/
```

Typical outputs:

| OS      | Artifact                                             |
| ------- | ---------------------------------------------------- |
| Windows | `bundle/nsis/neoma_0.2.0_x64-setup.exe`              |
| macOS   | `bundle/dmg/neoma_0.2.0_universal.dmg` (or `aarch64`)|
| Linux   | `bundle/appimage/neoma_0.2.0_amd64.AppImage`, `.deb` |

## What the shell does

- **Single instance** — launching neoma again focuses the existing window.
- **System tray** — a tray icon with _Show neoma_ / _Quit_.
- **Close behaviour** — configurable (quit completely / minimise to tray / ask).
  The native close handler reads the preference the web app sends via the
  `set_close_behavior` command; the default is _minimise to tray_. Restore from
  the tray icon or by relaunching.
- **Launch on startup** — optional, via `tauri-plugin-autostart` (off by
  default; the web app toggles it).
- **Offline startup** — the app boots with no network and reopens your last
  vault and tabs (already true in the PWA; carried over here).

## Signing

Installers are **unsigned** until signing certificates are configured — see the
honest note in [INSTALL.md](INSTALL.md). To sign later:

- **Windows:** an Authenticode certificate (`tauri.conf.json → bundle.windows.certificateThumbprint`).
- **macOS:** an Apple Developer ID + notarisation.

Until then, the releases page states plainly that the installer is unsigned and
explains the OS warning users will see.
