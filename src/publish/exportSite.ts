// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Publish a vault as a self-contained static website: every note becomes an
 * HTML page (wiki-links and relative links resolved to .html), attachments are
 * copied across, and an index lists everything. The result is a ZIP the user
 * can open locally or host anywhere. This is the free, local half of the
 * publishing feature; hosted publishing is a later, paid layer.
 */
import { zip, strToU8 } from 'fflate'
import { flushAllSaves, getAdapter, getLinkGraph } from '@/app/vaultStore'
import { renderMarkdown } from '@/markdown/render'
import { exportBlob } from '@/storage/import-export'
import { stem } from '@/utils/paths'

const isMarkdown = (path: string) => /\.md$/i.test(path)
const htmlPath = (path: string) => path.replace(/\.md$/i, '.html')

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c)

/** `../` prefix needed to reach the site root from a note's own folder. */
const toRoot = (path: string) => '../'.repeat(path.split('/').length - 1)

/** Relative, URL-encoded link from one vault path to another file. */
function relPath(from: string, to: string): string {
  const fromDir = from.split('/').slice(0, -1)
  const toParts = to.split('/')
  let i = 0
  while (i < fromDir.length && i < toParts.length - 1 && fromDir[i] === toParts[i]) i++
  const up = fromDir.length - i
  return encodeURI([...Array(up).fill('..'), ...toParts.slice(i)].join('/'))
}

/** Relative, URL-encoded `.html` link from one vault path to another note. */
const relHtml = (from: string, to: string) => relPath(from, htmlPath(to))

const LEAF = `<svg viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#141817"/><path d="M47 12 C47 33 35 46.5 18.5 49.5 C15.5 33 27 17.5 47 12 Z" fill="#4ade80"/><g stroke="#141817" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M18.5 49.5 C26 41.5 32.5 34 39.5 23.5"/><path d="M28.5 38.5 L37 40.5"/><path d="M33.5 30.5 L29 24.5"/></g><circle cx="39.5" cy="23.5" r="2.8" fill="#141817"/><circle cx="37" cy="40.5" r="2.3" fill="#141817"/><circle cx="29" cy="24.5" r="2.3" fill="#141817"/></svg>`

const SITE_CSS = `:root{--bg:#101413;--raised:#1b211f;--border:#262d2a;--accent:#4ade80;--text:#ece9e2;--text-2:#98a39d;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav{max-width:820px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:10px}
.nav .home{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text)}
.nav .sep{color:var(--text-2)}
main{max-width:820px;margin:0 auto;padding:40px 24px 96px}
h1,h2,h3,h4{letter-spacing:-.02em;line-height:1.25}
main>h1:first-child{margin-top:0}
p,li{color:#cbd3ce}
img{max-width:100%;border-radius:8px}
pre{background:var(--raised);border:1px solid var(--border);border-radius:12px;padding:14px;overflow:auto}
code{font-family:var(--mono);font-size:.9em}
:not(pre)>code{background:var(--raised);border:1px solid var(--border);padding:1px 6px;border-radius:6px}
blockquote{margin:16px 0;padding:2px 16px;border-left:3px solid var(--accent);color:var(--text-2)}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--border);padding:.4rem .6rem}
hr{border:none;border-top:1px solid var(--border);margin:28px 0}
mark{background:color-mix(in srgb,var(--accent) 30%,transparent);color:var(--text)}
.wiki-link{color:var(--accent)}
.wiki-link-broken{color:var(--text-2)}
.callout{border:1px solid var(--border);border-radius:10px;padding:.6rem 1rem;margin:1rem 0;background:var(--raised)}
.callout-title{font-weight:600;margin:0 0 .35rem}
.katex-html{display:none}
.katex-display{display:block;margin:1em 0;overflow-x:auto;text-align:center}
.index-group{margin:22px 0}
.index-group h2{font-size:1.05rem;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);padding-bottom:6px}
.index-list{list-style:none;padding:0;margin:10px 0}
.index-list li{margin:4px 0}
footer{border-top:1px solid var(--border);color:#6b7672;font-size:.85rem}
.foot{max-width:820px;margin:0 auto;padding:24px}`

function pageShell(title: string, bodyHtml: string, root: string, homeCrumb: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header><div class="nav">
<a class="home" href="${root}index.html">${LEAF} ${esc(siteName)}</a>
${homeCrumb ? `<span class="sep">/</span><span>${esc(title)}</span>` : ''}
</div></header>
<main>${bodyHtml}</main>
<footer><div class="foot">Published with Neoma</div></footer>
</body>
</html>
`
}

let siteName = 'My notes'

/** Build and download the vault as a static site ZIP. Returns note count. */
export async function exportSiteZip(name = 'My notes'): Promise<number> {
  await flushAllSaves()
  const adapter = getAdapter()
  if (!adapter) throw new Error('No vault is open')
  siteName = name
  const graph = getLinkGraph()
  const entries = await adapter.list()
  const files: Record<string, Uint8Array> = { 'style.css': strToU8(SITE_CSS) }

  const notes = entries.filter((e) => e.kind === 'file' && isMarkdown(e.path))
  const titleOf = (path: string) => graph.get(path)?.title ?? stem(path)
  // `![[name.png]]` names a file by its path or, more often, just its filename.
  const attachments = new Map<string, string>()
  for (const e of entries) {
    if (e.kind !== 'file' || isMarkdown(e.path)) continue
    attachments.set(e.path.toLowerCase(), e.path)
    const name = e.path.split('/').pop()!.toLowerCase()
    if (!attachments.has(name)) attachments.set(name, e.path)
  }

  for (const note of notes) {
    const text = await adapter.readText(note.path)
    const resolveLink = (target: string) => {
      const resolved = graph.resolve(target, note.path)
      return resolved ? relHtml(note.path, resolved) : null
    }
    const resolveEmbed = (target: string) => {
      const found = attachments.get(target.toLowerCase())
      if (found) return relPath(note.path, found)
      // `![[Another note]]` links to that note's page in the static site.
      const embedded = graph.resolve(target, note.path)
      return embedded && isMarkdown(embedded) ? relHtml(note.path, embedded) : null
    }
    const body = await renderMarkdown(text, { resolveLink, resolveEmbed, staticLinks: true })
    const article = `<h1>${esc(titleOf(note.path))}</h1>\n${body}`
    files[htmlPath(note.path)] = strToU8(
      pageShell(titleOf(note.path), article, toRoot(note.path), true),
    )
  }

  // Copy attachments and other binary files so images resolve.
  for (const entry of entries) {
    if (entry.kind !== 'file' || isMarkdown(entry.path)) continue
    try {
      const blob = await adapter.readBinary(entry.path)
      files[entry.path] = new Uint8Array(await blob.arrayBuffer())
    } catch {
      /* skip unreadable files */
    }
  }

  // Index page: notes grouped by folder.
  const byFolder = new Map<string, typeof notes>()
  for (const note of notes) {
    const folder = note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : ''
    if (!byFolder.has(folder)) byFolder.set(folder, [])
    byFolder.get(folder)!.push(note)
  }
  const groups = [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const indexBody =
    `<h1>${esc(name)}</h1>\n<p>${notes.length} note${notes.length === 1 ? '' : 's'}.</p>\n` +
    groups
      .map(
        ([folder, items]) =>
          `<div class="index-group"><h2>${esc(folder || 'Top level')}</h2><ul class="index-list">` +
          items
            .sort((a, b) => titleOf(a.path).localeCompare(titleOf(b.path)))
            .map(
              (n) =>
                `<li><a href="${encodeURI(htmlPath(n.path))}">${esc(titleOf(n.path))}</a></li>`,
            )
            .join('') +
          `</ul></div>`,
      )
      .join('\n')
  files['index.html'] = strToU8(pageShell(name, indexBody, '', false))

  const zipped = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))),
  )
  await exportBlob(new Blob([zipped.slice().buffer], { type: 'application/zip' }), 'neoma-site.zip')
  return notes.length
}
