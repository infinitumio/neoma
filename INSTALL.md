<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Installing neoma — and verifying what you downloaded

neoma is **local-first and offline**: your notes are plain Markdown files on
your own device. There are **no accounts, no telemetry, and no ads**, and the
core app never requires a network connection. This page exists so you can verify
exactly what you downloaded and understand any warning your operating system
shows.

## Ways to run neoma

1. **In your browser (no install):** open the hosted PWA and create a vault. You
   can "install" it from the browser for an app-like window. Everything runs
   locally in the browser; data stays in your browser storage or a local folder
   you pick.
2. **Desktop app (Tauri):** download the installer for your OS from the
   **Releases** page. Building it yourself is documented in [DESKTOP.md](DESKTOP.md).

## Release files

Each release lists, for every file: the **exact filename**, **size**, **version**,
**release date**, and a **SHA-256 checksum**. Example (illustrative):

| OS            | File                                | Size   |
| ------------- | ----------------------------------- | ------ |
| Windows 10/11 | `neoma_0.2.0_x64-setup.exe`         | ~8 MB  |
| macOS 12+     | `neoma_0.2.0_universal.dmg`         | ~10 MB |
| Linux         | `neoma_0.2.0_amd64.AppImage`        | ~85 MB |

A `SHA256SUMS.txt` file is published alongside the installers.

## Verify your download (recommended)

Compare the checksum of the file you downloaded with the value in
`SHA256SUMS.txt`.

- **Windows (PowerShell):**
  ```powershell
  Get-FileHash .\neoma_0.2.0_x64-setup.exe -Algorithm SHA256
  ```
- **macOS:**
  ```bash
  shasum -a 256 neoma_0.2.0_universal.dmg
  ```
- **Linux:**
  ```bash
  sha256sum neoma_0.2.0_amd64.AppImage
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

## About the "unknown publisher" / "unidentified developer" warning

The current installers are **not code-signed**. Signing requires paid
certificates (an Authenticode certificate on Windows; an Apple Developer ID plus
notarisation on macOS). Until those are in place, your OS may warn you:

- **Windows SmartScreen:** "Windows protected your PC." Click **More info →
  Run anyway** if — and only if — the SHA-256 checksum matched.
- **macOS Gatekeeper:** "cannot be opened because the developer cannot be
  verified." Right-click the app → **Open**, or allow it in
  **System Settings → Privacy & Security**.

This warning means the binary is **unsigned**, not that it is unsafe. We would
rather tell you this honestly than imply a signature that does not exist.
Signing will be added when certificates are available, and this page will be
updated to say so.

## Privacy statement

- **No telemetry, analytics, ads, or trackers.** neoma does not phone home.
- **No account and no cloud** are required. The core app works fully offline.
- Your notes are Markdown files you control; you can move, back up, or delete
  them with any tool.
- Any future online feature (e.g. optional calendar subscriptions or sync) will
  be **opt-in, clearly separated, and never required** by the offline core.

## Uninstalling

- **Windows:** _Settings → Apps → Installed apps → neoma → Uninstall_ (or the
  Start-menu uninstaller). Your vault folders are **not** removed — delete them
  yourself if you wish.
- **macOS:** drag **neoma** from _Applications_ to the Trash. To remove app
  settings: `~/Library/Application Support/app.neoma.desktop`.
- **Linux (AppImage):** delete the `.AppImage` file. For `.deb`:
  `sudo apt remove neoma`.

Uninstalling never deletes your notes — they are your files.
