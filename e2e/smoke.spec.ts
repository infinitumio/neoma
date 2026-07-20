// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * End-to-end smoke tests against the production build. They exercise the
 * critical user flows: vault creation, editing with autosave, wiki links and
 * backlinks, search, daily notes, templates, export/import, rename with link
 * updates, delete/restore, and offline reload via the service worker.
 */
import { test, expect, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

async function createVault(page: Page, name = 'Test vault'): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /create browser vault/i }).click()
  await page.getByLabel('Vault name').fill(name)
  await page.getByRole('button', { name: /create vault/i }).click()
  await expect(page.getByRole('button', { name: 'New note', exact: true })).toBeVisible()
}

async function createNote(page: Page, content: string): Promise<void> {
  await page.getByRole('button', { name: 'New note', exact: true }).click()
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  await editor.click()
  await editor.pressSequentially(content)
}

test('welcome flow creates a browser vault and shows the workspace', async ({ page }) => {
  await createVault(page)
  await expect(page.locator('.activity-rail')).toBeVisible()
  await expect(page.locator('.status-bar')).toContainText('Browser vault')
})

test('creates, edits and autosaves a note', async ({ page }) => {
  await createVault(page)
  await createNote(page, '# Hello neoma\n\nFirst note body.')
  await expect(page.locator('.status-bar')).toContainText('Saved', { timeout: 5000 })
  // Content survives a reload (tabs + vault restored).
  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('Hello neoma')
})

test('wiki links resolve and backlinks appear', async ({ page }) => {
  await createVault(page)
  // Create target note.
  await createNote(page, 'Target note content')
  await page
    .getByRole('button', { name: 'Rename note…' })
    .isVisible()
    .catch(() => {})
  // Rename it via command palette for a stable name.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('rename')
  await page.getByRole('option', { name: /rename note/i }).click()
  await page.getByLabel('New name').fill('Target')
  await page.getByRole('button', { name: 'OK' }).click()

  // Create linking note.
  await createNote(page, 'Points to [[Target]]')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Open Target through quick open and check backlinks in right sidebar.
  await page.keyboard.press('ControlOrMeta+o')
  await page.getByPlaceholder('Open note…').fill('Target')
  await page
    .getByRole('option', { name: /^Target/ })
    .first()
    .click()
  await expect(page.locator('.cm-content')).toContainText('Target note content')

  await page.getByRole('button', { name: 'Toggle context sidebar' }).click()
  await page.getByRole('tab', { name: 'Backlinks' }).click()
  await expect(page.locator('.right-sidebar')).toContainText('Linked mentions (1)')
  await expect(page.locator('.right-sidebar .backlink-card').first()).toContainText('Untitled')
})

test('search finds phrases locally', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'The mitochondria is the powerhouse of the cell')
  await expect(page.locator('.status-bar')).toContainText('Saved')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search vault' }).fill('"powerhouse of the cell"')
  await expect(page.locator('.search-result')).toHaveCount(1)
  await expect(page.locator('.search-result')).toContainText('powerhouse')
  // Excluded terms remove results.
  await page.getByRole('searchbox', { name: 'Search vault' }).fill('powerhouse -mitochondria')
  await expect(page.locator('.search-result')).toHaveCount(0)
})

test('daily note is created from template after confirmation', async ({ page }) => {
  await createVault(page)
  await page.getByRole('button', { name: 'Daily journal' }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // CodeMirror virtualises long documents, so assert on above-the-fold text.
  await expect(page.locator('.cm-content')).toContainText('Objectives')
  await expect(page.locator('.cm-content')).toContainText('Work completed')
})

test('notes can be created from research templates', async ({ page }) => {
  await createVault(page)
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('button', { name: /Experiment log/ }).click()
  await page.getByLabel('Note title').fill('Experiment 42')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Hypothesis')
  await expect(page.locator('.cm-content')).toContainText('Environment')
  await expect(page.locator('.tab.active')).toContainText('Experiment 42')
})

test('vault exports as ZIP and reimports', async ({ page }) => {
  await createVault(page, 'Export vault')
  await createNote(page, 'exportable content')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  const downloadPromise = page.waitForEvent('download')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('export vault')
  await page.getByRole('option', { name: /export vault as zip/i }).click()
  const download = await downloadPromise
  const zipPath = await download.path()
  expect(zipPath).toBeTruthy()

  // Re-import through the files panel import input.
  const fileInput = page.locator('input[type="file"][accept*=".zip"]')
  await fileInput.setInputFiles(zipPath!)
  await expect(page.locator('.toast')).toContainText(/Imported 1 notes/)
})

test('renaming a linked note offers to update links', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'Base note')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('rename')
  await page.getByRole('option', { name: /rename note/i }).click()
  await page.getByLabel('New name').fill('Old Name')
  await page.getByRole('button', { name: 'OK' }).click()

  await createNote(page, 'refers to [[Old Name]]')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Open "Old Name" and rename it.
  await page.keyboard.press('ControlOrMeta+o')
  await page.getByPlaceholder('Open note…').fill('Old Name')
  await page
    .getByRole('option', { name: /Old Name/ })
    .first()
    .click()
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('rename')
  await page.getByRole('option', { name: /rename note/i }).click()
  await page.getByLabel('New name').fill('New Name')
  await page.getByRole('button', { name: 'OK' }).click()

  // The link-update dialog lists the affected note; apply it.
  await expect(page.getByRole('dialog', { name: /update links/i })).toBeVisible()
  await page.getByRole('button', { name: /update 1 link/i }).click()
  await expect(page.locator('.toast')).toContainText('Updated 1 link')

  // Verify the linking note now points at the new name.
  await page.keyboard.press('ControlOrMeta+o')
  await page.getByPlaceholder('Open note…').fill('Untitled')
  await page
    .getByRole('option', { name: /Untitled/ })
    .first()
    .click()
  await expect(page.locator('.cm-content')).toContainText('[[New Name]]')
})

test('deleted notes can be restored from recently deleted', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'delete me please')
  await expect(page.locator('.status-bar')).toContainText('Saved')
  const noteItem = page.locator('.file-tree .tree-item', { hasText: 'Untitled' }).first()
  await noteItem.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await page.getByRole('button', { name: 'Recently deleted' }).click()
  await expect(page.locator('.sidebar')).toContainText('Untitled.md')
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.locator('.toast.success')).toContainText('Restored')
  await expect(page.locator('.cm-content')).toContainText('delete me please')
})

test('reading mode renders markdown and the app works offline after reload', async ({
  page,
  context,
}) => {
  await createVault(page)
  await createNote(page, '# Rendered\n\n**bold** and [[SomeLink]] and #atag')
  await expect(page.locator('.status-bar')).toContainText('Saved')
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.markdown-body h1')).toHaveText('Rendered')
  await expect(page.locator('.markdown-body strong')).toHaveText('bold')
  await expect(page.locator('.markdown-body .wiki-link')).toContainText('SomeLink')

  // Wait until the service worker has activated and precached the app, then
  // reload once online so the page becomes controlled (registerType:
  // 'prompt' does not claim existing pages), and only then go offline.
  await page.waitForFunction(
    async () => (await navigator.serviceWorker?.ready)?.active != null,
    undefined,
    {
      timeout: 20_000,
    },
  )
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 20_000,
  })
  await context.setOffline(true)
  await page.reload()
  // Full offline reload: app shell and vault content still available.
  await expect(page.locator('.activity-rail')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.status-bar')).toContainText('Offline')
  await context.setOffline(false)
})
