// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test'
import { unzipSync, strFromU8 } from 'fflate'
import { readFile } from 'node:fs/promises'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('phone navigation, visible page actions and immediate backup round trip', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'neoma.settings',
      JSON.stringify({ state: { settings: { autosaveDelayMs: 5000 } }, version: 0 }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'New vault', exact: true }).click()
  await page.getByLabel('Vault name').fill('Release backup')
  await page.getByRole('button', { name: /Blank vault/ }).click()
  await page.getByRole('button', { name: 'Create vault', exact: true }).click()
  await expect(page.locator('.cm-content')).toBeVisible()
  await page.locator('.cm-content').fill('Latest edit in the backup')
  await expect(page.locator('.activity-rail-bottom')).toHaveText(/FilesSearchCalendarStudyMore/)
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  await page.getByRole('button', { name: 'More vault actions' }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export vault as ZIP' }).click()
  const download = await downloadEvent
  const bytes = await readFile((await download.path())!)
  expect(strFromU8(unzipSync(bytes)['Untitled.md'])).toBe('Latest edit in the backup')

  await page.getByRole('button', { name: 'Actions for Untitled', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Rename…', exact: true }).click()
  await page.getByLabel('New name').fill('Research')
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Research Close Research' })).toBeVisible()
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Actions for Research', exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeVisible()
  await page.getByRole('button', { name: 'Privacy', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '‹ Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Backups', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()

  // Restore the ZIP through the actual picker, then reopen the note.
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  await page.getByRole('button', { name: 'More vault actions' }).click()
  const chooserEvent = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Import files or ZIP…', exact: true }).click()
  await (
    await chooserEvent
  ).setFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: bytes })
  await page
    .locator('.tree-item')
    .filter({ hasText: /^Untitled$/ })
    .click()
  await expect(page.locator('.cm-content')).toContainText('Latest edit in the backup')
  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('Latest edit in the backup')
})
