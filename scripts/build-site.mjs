// SPDX-License-Identifier: AGPL-3.0-or-later
// Assembles the deploy bundle: the marketing site (website/) at the root, the
// web app (dist/) under /app, and every policy in website/legal/*.md rendered
// into a themed standalone HTML page (privacy.html, terms.html, license.html).
// Run AFTER `npm run build` (built with the right NEOMA_BASE so the app's asset
// URLs and service-worker scope resolve under /app).
import {
  cpSync,
  rmSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'

const OUT = 'dist-site'

if (!existsSync('dist/index.html')) {
  console.error('build-site: dist/ not found — run `npm run build` first.')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync('website', OUT, { recursive: true })
cpSync('dist', `${OUT}/app`, { recursive: true })

// ---- Render legal/policy Markdown into themed pages ----
const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeStringify)

const ICON = `<svg viewBox="0 0 64 64" aria-hidden="true" width="26" height="26"><rect width="64" height="64" rx="14" fill="#141817"/><path d="M47 12 C47 33 35 46.5 18.5 49.5 C15.5 33 27 17.5 47 12 Z" fill="#4ade80"/><g stroke="#141817" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M18.5 49.5 C26 41.5 32.5 34 39.5 23.5"/><path d="M28.5 38.5 L37 40.5"/><path d="M33.5 30.5 L29 24.5"/></g><circle cx="39.5" cy="23.5" r="2.8" fill="#141817"/><circle cx="37" cy="40.5" r="2.3" fill="#141817"/><circle cx="29" cy="24.5" r="2.3" fill="#141817"/></svg>`

const page = (title, bodyHtml) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Neoma</title>
    <meta name="description" content="${title} for Neoma — a local-first, offline research notebook." />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#101413" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <style>
      :root{--bg:#101413;--raised:#1b211f;--border:#262d2a;--accent:#4ade80;--text:#ece9e2;--text-2:#98a39d;--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      *{box-sizing:border-box}
      body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased}
      a{color:var(--accent);text-decoration:none}
      a:hover{text-decoration:underline}
      header{position:sticky;top:0;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
      .nav{max-width:820px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}
      .brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text)}
      .back{font-size:.92rem;color:var(--text-2)}
      main{max-width:820px;margin:0 auto;padding:48px 24px 96px}
      main h1{font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.03em;margin:0 0 8px}
      main h2{margin:40px 0 12px;font-size:1.4rem;letter-spacing:-.02em;border-top:1px solid var(--border);padding-top:28px}
      main h3{margin:26px 0 8px;font-size:1.1rem}
      main p,main li{color:#cbd3ce}
      main ul,main ol{padding-left:22px}
      main li{margin:6px 0}
      main code{font-family:var(--mono);font-size:.88em;background:var(--raised);border:1px solid var(--border);padding:1px 6px;border-radius:6px}
      main pre{background:var(--raised);border:1px solid var(--border);border-radius:12px;padding:16px;overflow:auto}
      main pre code{background:none;border:none;padding:0}
      main blockquote{margin:18px 0;padding:2px 18px;border-left:3px solid var(--accent);color:var(--text-2)}
      main hr{border:none;border-top:1px solid var(--border);margin:32px 0}
      .updated{color:var(--text-2);font-size:.9rem;margin:0 0 32px}
      footer{border-top:1px solid var(--border);color:#6b7672;font-size:.88rem}
      .foot{max-width:820px;margin:0 auto;padding:28px 24px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between}
      .foot a{color:#6b7672}
      .foot a:hover{color:var(--text)}
    </style>
  </head>
  <body>
    <header>
      <div class="nav">
        <a class="brand" href="/">${ICON} Neoma</a>
        <a class="back" href="/">← Back to site</a>
      </div>
    </header>
    <main>${bodyHtml}</main>
    <footer>
      <div class="foot">
        <span>© 2026 Neoma contributors</span>
        <span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="license.html">License</a> · <a href="https://github.com/infinitumio/neoma">GitHub</a></span>
      </div>
    </footer>
  </body>
</html>
`

const legalDir = 'website/legal'
if (existsSync(legalDir)) {
  for (const file of readdirSync(legalDir).filter((f) => f.endsWith('.md'))) {
    const name = file.replace(/\.md$/, '')
    const raw = readFileSync(`${legalDir}/${file}`, 'utf8')
    const title = (raw.match(/^#\s+(.+)$/m) || [, name])[1]
    const html = String(await md.process(raw))
    writeFileSync(`${OUT}/${name}.html`, page(title, html))
  }
  // The rendered pages are the deliverable; drop the raw copied .md sources.
  rmSync(`${OUT}/legal`, { recursive: true, force: true })
}

console.log(`build-site: wrote ${OUT}/ (site at /, web app at /app, policy pages rendered)`)
