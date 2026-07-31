<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Installing Neoma — and verifying what you downloaded

Neoma is **local-first and offline**: your notes are plain Markdown files on
your own device. There are **no accounts, no telemetry, and no ads**, and the
core app never requires a network connection. This page exists so you can verify
exactly what you downloaded and understand any warning your operating system
shows.

## Ways to run Neoma

1. **In your browser (no install):** open the hosted PWA and create a vault. You
   can "install" it from the browser for an app-like window. Everything runs
   locally; data stays in your browser storage or a local folder you pick.
2. **macOS app (Tauri):** download the `.dmg` from the **Releases** page.
   Building it yourself is documented in [DESKTOP.md](DESKTOP.md).
3. **iPhone / iPad app:** distributed through **TestFlight / the App Store** (see
   below). iOS does not allow unsigned sideloading, so there is no `.ipa` to
   checksum — the App Store verifies the build for you.
4. **Windows / Linux:** installers are produced by the same build and listed on
   the Releases page (macOS and iOS are the current focus).

## Release files

Each release lists, for every file: the **exact filename**, **size**, **version**,
**release date**, and a **SHA-256 checksum**. Filenames derive from the product
name **Neoma**. Example (illustrative):

| Platform      | File                         | Size   |
| ------------- | ---------------------------- | ------ |
| macOS 10.15+  | `Neoma_0.2.0_aarch64.dmg`    | ~10 MB |
| macOS (Intel) | `Neoma_0.2.0_x64.dmg`        | ~10 MB |
| Windows 10/11 | `Neoma_0.2.0_x64-setup.exe`  | ~8 MB  |
| Linux         | `Neoma_0.2.0_amd64.AppImage` | ~85 MB |
| iOS 13+       | via TestFlight / App Store   | —      |

A `SHA256SUMS.txt` file is published alongside the downloadable installers.

## Verify your download (recommended)

Compare the checksum of the file you downloaded with the value in
`SHA256SUMS.txt`.

- **macOS:**
  ```bash
  shasum -a 256 Neoma_0.2.0_aarch64.dmg
  ```
- **Windows (PowerShell):**
  ```powershell
  Get-FileHash .\Neoma_0.2.0_x64-setup.exe -Algorithm SHA256
  ```
- **Linux:**
  ```bash
  sha256sum Neoma_0.2.0_amd64.AppImage
  # or verify the whole manifest:
  sha256sum -c SHA256SUMS.txt
  ```

If the hash matches, the file is byte-for-byte what was published. If it does
**not** match, do not run it.

## Build provenance

Every release links to:

- the **public source** at the tagged commit, and
- the exact **build workflow run** that produced the installers (GitHub
  Actions), so you can see how the binaries were made.

## About the "unidentified developer" warning (macOS)

The current desktop installers are **not code-signed or notarised**. Signing
requires a paid Apple Developer ID (and, on Windows, an Authenticode
certificate). Until that is in place, macOS Gatekeeper may say:

> "Neoma cannot be opened because the developer cannot be verified."

Right-click the app → **Open**, or allow it in **System Settings → Privacy &
Security → Open Anyway** — if, and only if, the SHA-256 checksum matched.

This warning means the binary is **unsigned**, not that it is unsafe. We would
rather tell you this honestly than imply a signature that does not exist. The
**iOS** build is different: Apple requires signing, so the App Store / TestFlight
copy is always signed. Desktop signing will be added when certificates are
available, and this page will be updated to say so.

## Privacy statement

- **No telemetry, analytics, ads, or trackers.** Neoma does not phone home.
- **No account and no cloud** are required. The core app works fully offline.
- Your notes are Markdown files you control; you can move, back up, or delete
  them with any tool.
- Any future online feature (e.g. optional calendar subscriptions or sync) will
  be **opt-in, clearly separated, and never required** by the offline core.

## Uninstalling

- **macOS:** drag **Neoma** from _Applications_ to the Trash. To remove app
  settings: `~/Library/Application Support/app.neoma`.
- **iOS:** touch and hold the app icon → **Remove App → Delete App**.
- **Windows:** _Settings → Apps → Installed apps → Neoma → Uninstall_. Your
  vault folders are **not** removed — delete them yourself if you wish.
- **Linux (AppImage):** delete the `.AppImage` file. For `.deb`:
  `sudo apt remove neoma`.

Uninstalling never deletes your notes — they are your files.
