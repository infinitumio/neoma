// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Network audit: prove the application talks to nobody.
 *
 * "Your notes never leave your device" is the central claim Neoma makes, and
 * for the people it is aimed at — researchers under ethics approval, anyone
 * holding privileged or confidential material — it is the reason they are
 * allowed to install it at all. A claim that load-bearing should be tested,
 * not asserted in marketing copy.
 *
 * Every request the page makes is recorded. Anything leaving the origin is a
 * failure.
 */
import { test, expect, type Page, type Request } from '@playwright/test'

/**
 * The welcome screen is not the application. Every meaningful audit has to run
 * against a real vault with a real editor open, or it only proves the landing
 * page is quiet.
 */
async function createVault(page: Page, name = 'Audit vault'): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /create my first vault/i }).click()
  await page.getByLabel('Vault name').fill(name)
  await page.getByRole('button', { name: /Blank vault/ }).click()
  await page.getByRole('button', { name: /^Create vault$/ }).click()
  await expect(page.locator('.cm-content')).toBeVisible()
}

/** Requests to the app's own origin are how a local-first app loads itself. */
function isOffOrigin(url: string, origin: string): boolean {
  if (url.startsWith(origin)) return false
  // data:, blob: and about: never touch the network.
  return /^https?:/i.test(url)
}

test('the app makes no off-origin requests on load', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const offOrigin: string[] = []

  page.on('request', (r: Request) => {
    if (isOffOrigin(r.url(), origin)) offOrigin.push(`${r.method()} ${r.url()}`)
  })

  await createVault(page)
  await page.waitForLoadState('networkidle')
  // Let anything deferred (service worker, lazy chunks, fonts) settle.
  await page.waitForTimeout(2000)

  expect(offOrigin, `Off-origin requests:\n${offOrigin.join('\n')}`).toEqual([])
})

test('no off-origin requests while using the editor', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const offOrigin: string[] = []
  page.on('request', (r: Request) => {
    if (isOffOrigin(r.url(), origin)) offOrigin.push(r.url())
  })

  await createVault(page)

  // Typing exercises the editor, the parser and the preview renderer — the
  // paths most likely to reach for something remote. KaTeX in particular is a
  // common source of CDN font loads.
  const editor = page.locator('.cm-content').first()
  await editor.click()
  await editor.pressSequentially('# Audit\n\nSome **text** with $x^2$ and a [[Link]].\n', {
    delay: 5,
  })
  await page.waitForTimeout(2000)

  expect(offOrigin, `Off-origin requests:\n${offOrigin.join('\n')}`).toEqual([])
})

/**
 * The cases NOT under the application's control: content the user puts in a
 * note. Markdown permits remote images and video embeds, the renderer passes
 * absolute URLs straight to the browser, and with `csp: null` in tauri.conf
 * nothing at the platform level stops the fetch.
 *
 * These tests must run in READING mode. In edit mode the markdown is never
 * rendered to HTML, so no <img> exists and no request is made — proving
 * nothing. Getting this wrong is how an audit produces a false clean bill.
 */
test('remote images remain blocked in reading mode by default', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const external: string[] = []
  page.on('request', (r: Request) => {
    if (isOffOrigin(r.url(), origin)) external.push(r.url())
  })

  // .invalid never resolves, so no packet reaches a real host even though the
  // browser attempts the connection.
  const probe = 'https://neoma-network-audit.invalid/pixel.png'

  await createVault(page)
  const editor = page.locator('.cm-content').first()
  await editor.click()
  await editor.pressSequentially(`![probe](${probe})`, { delay: 5 })

  // Render it. Without this the image element never exists.
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.markdown-body')).toBeVisible()
  await page.waitForTimeout(2500)

  const attempted = external.some((u) => u.includes('neoma-network-audit.invalid'))
  console.log(
    attempted
      ? 'FINDING: remote images in notes ARE fetched. This is a tracking vector.'
      : 'FINDING: remote image was NOT fetched even in reading mode.',
  )
  expect(attempted).toBe(false)
})

test('YouTube embeds remain blocked in reading mode by default', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const external: string[] = []
  page.on('request', (r: Request) => {
    if (isOffOrigin(r.url(), origin)) external.push(r.url())
  })

  await createVault(page)
  const editor = page.locator('.cm-content').first()
  await editor.click()
  await editor.pressSequentially('[Video](https://youtu.be/dQw4w9WgXcQ)', { delay: 5 })
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.markdown-body')).toBeVisible()
  await page.waitForTimeout(2500)

  const yt = external.filter((u) => /youtube|ytimg|googlevideo/i.test(u))
  console.log(
    yt.length
      ? `FINDING: YouTube embed contacted ${yt.length} host(s):\n  ${[...new Set(yt.map((u) => new URL(u).host))].join('\n  ')}`
      : 'FINDING: YouTube embed made no request.',
  )
  expect(yt).toEqual([])
})
