// SPDX-License-Identifier: AGPL-3.0-or-later
// Every Neoma logo file comes from this one script. Change the geometry here,
// run `npm run icons`, and the website, docs, web app, desktop and iOS icons
// all follow. Outputs are committed, so this only runs when the mark changes.
//
// The mark: Tidal block. A solid page parted by a tilde-shaped channel. The
// tilde is ~, your home directory; in mathematics it means approximately,
// which is where research lives. See brand/README.md.
//
//   brand/logo/*.svg        masters (mark, icons, lockups)
//   brand/export/*.png      large rasters for press, GitHub and social
//   public/favicon.svg|ico  the web app and site favicon
//   public/icons/*.png      PWA icons
//   src-tauri/icon-*.svg    sources for `tauri icon` (desktop, iOS, Android)
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const C = {
  ink: '#171c19',
  paper: '#f7f8f4',
  fern: '#276749',
  fernTop: '#2f7a56',
  fernDeep: '#1d5038',
  sage: '#7cc49a',
}

// ---------- Geometry (100-unit grid) ----------
// The page: a 64-unit square with a 9-unit radius. The channel: a cubic tilde
// that is point-symmetric about the centre (50, 50), so both halves of the page
// have exactly the same area and weight. It enters the left edge low and leaves
// the right edge high: a rising current, read left to right.
const PAGE = { x: 18, y: 18, s: 64, r: 9 }
const CHANNEL = 'M4 60 C18 30, 38 32, 50 50 C62 68, 82 70, 96 40'
const CUT = { regular: 8, small: 11 } // optical size: a wider channel below 32 px

let n = 0
function mark(fill, { size = 'regular', x = 0, y = 0, scale = 1 } = {}) {
  const id = `nm-cut-${++n}`
  const t = x || y || scale !== 1 ? ` transform="translate(${x} ${y}) scale(${scale})"` : ''
  return `<g${t}><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="${CHANNEL}" fill="none" stroke="#000" stroke-width="${CUT[size]}"/></mask><rect x="${PAGE.x}" y="${PAGE.y}" width="${PAGE.s}" height="${PAGE.s}" rx="${PAGE.r}" fill="${fill}" mask="url(#${id})"/></g>`
}

/** Glyph centred on a 100-unit tile at the given fraction of the tile. */
const onTile = (fill, frac, size) => {
  const scale = (frac * 100) / PAGE.s
  const off = 50 - 50 * scale
  return mark(fill, { size, x: off, y: off, scale })
}

/** Apple's continuous-corner squircle (superellipse, n = 5). */
function squircle(x, y, s, e = 5) {
  const a = s / 2
  const pts = []
  for (let i = 0; i < 360; i++) {
    const t = (2 * Math.PI * i) / 360
    const c = Math.cos(t)
    const si = Math.sin(t)
    const px = x + a + a * Math.sign(c) * Math.abs(c) ** (2 / e)
    const py = y + a + a * Math.sign(si) * Math.abs(si) ** (2 / e)
    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`)
  }
  return `M${pts.join(' L')}Z`
}

/**
 * The knockout tile: a Fern tile with the page cut out, so the centre is
 * transparent and takes on whatever is behind it. Used wherever the logo sits
 * on a light or dark surface (favicon, app rail, site header).
 */
function knockout(fill, { size = 'regular', frac = 0.56, cls = '' } = {}) {
  const id = `nm-knock-${++n}`
  const scale = (frac * 100) / PAGE.s
  const off = 50 - 50 * scale
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/>${mark('#000', { size, x: off, y: off, scale })}</mask><rect width="100" height="100" rx="22.5"${cls ? ` class="${cls}"` : ''} fill="${fill}" mask="url(#${id})"/>`
}

const svg = (vb, body, label = 'Neoma') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${label}">${body}</svg>\n`

const wordmarkBody = async () => {
  const src = await readFile(join(ROOT, 'brand/logo/wordmark.svg'), 'utf8')
  return {
    width: Number(src.match(/viewBox="0 -546 ([\d.]+) 560"/)[1]),
    inner: src.match(/<g [^>]*>([\s\S]*)<\/g>/)[1],
  }
}

async function build() {
  const out = {}
  const m = (fill, size) => svg('0 0 100 100', mark(fill, { size }))

  // Marks
  out['brand/logo/mark.svg'] = svg('0 0 100 100', `<g color="${C.ink}">${mark('currentColor')}</g>`)
  out['brand/logo/mark-light.svg'] = m(C.ink)
  out['brand/logo/mark-dark.svg'] = m(C.paper)
  out['brand/logo/mark-fern.svg'] = m(C.fern)
  out['brand/logo/mark-small.svg'] = svg(
    '0 0 100 100',
    `<g color="${C.ink}">${mark('currentColor', { size: 'small' })}</g>`,
  )

  // Tiles. Flat for UI and favicons; the macOS master carries Apple-style light.
  const flat = (bg, fg, size = 'regular', frac = 0.54) =>
    svg(
      '0 0 100 100',
      `<rect width="100" height="100" rx="22.5" fill="${bg}"/>${onTile(fg, frac, size)}`,
    )
  out['brand/logo/icon.svg'] = flat(C.fern, C.paper)
  out['brand/logo/icon-ink.svg'] = flat(C.ink, C.sage)
  // Favicon: the knockout tile, Fern on light tabs and Sage on dark ones.
  out['brand/logo/favicon.svg'] = svg(
    '0 0 100 100',
    `<style>.t{fill:${C.fern}}@media (prefers-color-scheme:dark){.t{fill:${C.sage}}}</style>${knockout(C.fern, { size: 'small', frac: 0.62, cls: 't' })}`,
  )
  out['brand/logo/icon-knockout.svg'] = svg('0 0 100 100', knockout(C.fern))
  out['brand/logo/icon-knockout-dark.svg'] = svg('0 0 100 100', knockout(C.sage))
  out['brand/logo/icon-square.svg'] = svg(
    '0 0 100 100',
    `<rect width="100" height="100" fill="${C.fern}"/>${onTile(C.paper, 0.54)}`,
  )
  out['brand/logo/icon-maskable.svg'] = svg(
    '0 0 100 100',
    `<rect width="100" height="100" fill="${C.fern}"/>${onTile(C.paper, 0.42)}`,
  )
  // macOS: the 824-unit tile centred in 1024, a top-lit gradient, a hairline
  // highlight and a soft contact shadow. Flattened, it is exactly icon.svg.
  const tile = squircle(100, 100, 824)
  out['brand/logo/icon-macos.svg'] = svg(
    '0 0 1024 1024',
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.fernTop}"/><stop offset="1" stop-color="${C.fernDeep}"/></linearGradient><filter id="s" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".26"/></filter></defs><path d="${tile}" fill="url(#g)" filter="url(#s)"/><path d="${tile}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/><g transform="translate(100 100) scale(8.24)">${onTile(C.paper, 0.54)}</g>`,
  )

  // Lockups: the wordmark's x-height is 55% of the page; baseline on the page's lower third.
  const wm = await wordmarkBody()
  const k = (PAGE.s * 0.55) / 534
  const lock = (markFill, textFill) =>
    svg(
      `0 0 ${Math.ceil(100 + wm.width * k + 8)} 100`,
      `${mark(markFill)}<g transform="translate(100 ${50 + 17.6}) scale(${k} ${-k})" fill="${textFill}">${wm.inner}</g>`,
    )
  out['brand/logo/lockup-light.svg'] = lock(C.ink, C.ink)
  out['brand/logo/lockup-dark.svg'] = lock(C.paper, C.paper)
  out['brand/logo/lockup-fern.svg'] = lock(C.fern, C.ink)

  // App and platform sources
  out['public/favicon.svg'] = out['brand/logo/favicon.svg']
  // Native shells only exist in the packaging repository.
  if (existsSync(join(ROOT, 'src-tauri'))) {
    out['src-tauri/icon-source.svg'] = out['brand/logo/icon-square.svg']
    out['src-tauri/icon-macos.svg'] = out['brand/logo/icon-macos.svg']
  }

  for (const [file, text] of Object.entries(out)) {
    await mkdir(dirname(join(ROOT, file)), { recursive: true })
    await writeFile(join(ROOT, file), text)
  }

  // ---------- Rasters ----------
  const png = (text, size) =>
    sharp(Buffer.from(text), { density: 72 * Math.max(1, (size / 100) * 4) })
      .resize(size, size)
      .png()
      .toBuffer()
  const write = async (file, buf) => {
    await mkdir(dirname(join(ROOT, file)), { recursive: true })
    await writeFile(join(ROOT, file), buf)
  }
  await write('public/icons/icon-192.png', await png(out['brand/logo/icon-square.svg'], 192))
  await write('public/icons/icon-512.png', await png(out['brand/logo/icon-square.svg'], 512))
  await write(
    'public/icons/apple-touch-icon.png',
    await png(out['brand/logo/icon-square.svg'], 180),
  )
  await write(
    'public/icons/icon-maskable-512.png',
    await png(out['brand/logo/icon-maskable.svg'], 512),
  )
  await write('brand/export/icon-1024.png', await png(out['brand/logo/icon-square.svg'], 1024))
  await write(
    'brand/export/icon-macos-1024.png',
    await sharp(Buffer.from(out['brand/logo/icon-macos.svg'])).resize(1024, 1024).png().toBuffer(),
  )
  await write(
    'brand/export/github-avatar-500.png',
    await png(out['brand/logo/icon-square.svg'], 500),
  )

  // favicon.ico: 16, 32 and 48 px PNG entries (the small optical size).
  const sizes = [16, 32, 48]
  const imgs = await Promise.all(sizes.map((s) => png(out['brand/logo/favicon.svg'], s)))
  const head = Buffer.alloc(6 + 16 * sizes.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(sizes.length, 4)
  let offset = head.length
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(s, e)
    head.writeUInt8(s, e + 1)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(imgs[i].length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += imgs[i].length
  })
  await write('public/favicon.ico', Buffer.concat([head, ...imgs]))

  console.log(`brand-assets: ${Object.keys(out).length} SVGs and ${7 + 1} rasters written`)
  console.log('Next for native icons: npx tauri icon src-tauri/icon-source.svg (see DESKTOP.md)')
}

await build()
