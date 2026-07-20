// SPDX-License-Identifier: AGPL-3.0-or-later
// Rasterises the neoma logo (public/favicon.svg) into the PNG icons required
// by the PWA manifest. The generated PNGs are committed, so this script only
// needs to be re-run when the logo changes: `npm run icons`.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const svg = await readFile(path.join(root, 'public/favicon.svg'))
const outDir = path.join(root, 'public/icons')
await mkdir(outDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const { file, size } of targets) {
  const png = await sharp(svg, { density: 300 }).resize(size, size).png().toBuffer()
  await writeFile(path.join(outDir, file), png)
  console.log(`wrote icons/${file} (${size}x${size})`)
}

// Maskable icon: the logo shrunk onto a full-bleed background so the safe
// zone (inner 80%) always contains the mark.
const inner = await sharp(svg, { density: 300 }).resize(400, 400).png().toBuffer()
const maskable = await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#141817' },
})
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toBuffer()
await writeFile(path.join(outDir, 'icon-maskable-512.png'), maskable)
console.log('wrote icons/icon-maskable-512.png (512x512, maskable)')
