// SPDX-License-Identifier: AGPL-3.0-or-later
// Assembles the Vercel deploy: the marketing site (website/) at the root and a
// live build of the web app (dist/) under /app. Run AFTER `npm run build`
// (which must be built with NEOMA_BASE=/app/ so the app's asset URLs and
// service-worker scope resolve under /app on the domain root).
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs'

const OUT = 'dist-site'

if (!existsSync('dist/index.html')) {
  console.error('build-site: dist/ not found — run `npm run build` first (NEOMA_BASE=/app/).')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync('website', OUT, { recursive: true })
cpSync('dist', `${OUT}/app`, { recursive: true })
console.log(`build-site: wrote ${OUT}/ (site at /, web app at /app)`)
