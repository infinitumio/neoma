// SPDX-License-Identifier: AGPL-3.0-or-later
// Assembles the GitHub Pages build of the open-source edition: a small landing
// page (website/) at the root and the web app (dist/) under /app. The full
// website, docs and policies live at https://www.neomadev.app; this build only
// proves the open-source edition runs, straight from this repository.
// Run AFTER `npm run build` (with NEOMA_BASE set to the /app subpath).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const OUT = 'dist-site'

if (!existsSync('dist/index.html')) {
  console.error('build-site: dist/ not found. Run `npm run build` first.')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
// website/docs is the docs vault (published on neomadev.app/docs), not part of this bundle.
cpSync('website', OUT, { recursive: true, filter: (src) => !src.startsWith('website/docs') })
cpSync('dist', `${OUT}/app`, { recursive: true })
// The shared brand: tokens, self-hosted fonts and logos (never a font CDN).
for (const part of ['tokens.css', 'fonts', 'logo'])
  cpSync(`brand/${part}`, `${OUT}/brand/${part}`, { recursive: true })

console.log(`build-site: wrote ${OUT}/ (landing at /, web app at /app)`)
