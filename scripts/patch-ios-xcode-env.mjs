// SPDX-License-Identifier: AGPL-3.0-or-later
// `tauri ios init` regenerates the Xcode project with a "Build Rust Code" build
// phase that just runs `npm run -- tauri ios xcode-script`. When you press Run
// in Xcode (not the CLI), that phase inherits Xcode's minimal GUI PATH, which
// omits ~/.cargo/bin — so cargo/rustc aren't found and the build dies with
// "PhaseScriptExecution failed with a nonzero exit code". Prepend the toolchain
// dirs to the script's PATH so building from Xcode works too. Runs after
// `npm run ios:init`. (The CLI already has the full shell PATH, so this only
// matters for the in-Xcode Run button.)
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pbxproj = path.join(root, 'src-tauri', 'gen', 'apple', 'neoma.xcodeproj', 'project.pbxproj')

const PATH_PREFIX = 'export PATH=\\"$HOME/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:$PATH\\"; '
const MARKER = 'shellScript = "npm run -- tauri ios xcode-script'

try {
  await access(pbxproj)
} catch {
  console.log('patch-ios-xcode-env: no iOS project yet — skipping')
  process.exit(0)
}

let src = await readFile(pbxproj, 'utf8')
if (src.includes('$HOME/.cargo/bin')) {
  console.log('patch-ios-xcode-env: already patched')
  process.exit(0)
}
if (!src.includes(MARKER)) {
  console.log('patch-ios-xcode-env: Build Rust Code phase not found — skipping')
  process.exit(0)
}

src = src.replace(MARKER, `shellScript = "${PATH_PREFIX}npm run -- tauri ios xcode-script`)
await writeFile(pbxproj, src)
console.log('patch-ios-xcode-env: added cargo/homebrew to the Build Rust Code PATH')
