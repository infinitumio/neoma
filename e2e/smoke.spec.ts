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
  await page.getByRole('button', { name: /create my first vault/i }).click()
  await page.getByLabel('Vault name').fill(name)
  // Blank starter → a single empty "Untitled" page, so tests start clean.
  await page.getByRole('button', { name: /Blank vault/ }).click()
  await page.getByRole('button', { name: /^Create vault$/ }).click()
  await expect(page.getByRole('button', { name: 'New page', exact: true })).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()
}

/**
 * Type into a fresh page. Reuses the blank vault's initial empty "Untitled"
 * page on first call, and creates a new page on subsequent calls.
 */
async function createNote(page: Page, content: string): Promise<void> {
  const editor = page.locator('.cm-content')
  await expect(editor).toBeVisible()
  // An empty editor shows the placeholder widget; reuse it, else make a new page.
  const isEmpty = (await editor.locator('.cm-placeholder').count()) > 0
  if (!isEmpty) {
    await page.getByRole('button', { name: 'New page', exact: true }).click()
    await expect(editor.locator('.cm-placeholder')).toBeVisible()
  }
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
  await page.getByRole('option', { name: /rename page/i }).click()
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
  const fileInput = page.locator('[data-testid="import-input"]')
  await fileInput.setInputFiles(zipPath!)
  await expect(page.locator('.toast').filter({ hasText: /Imported/ })).toContainText(
    /Imported \d+ page/,
  )
})

test('renaming a linked note offers to update links', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'Base note')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('rename')
  await page.getByRole('option', { name: /rename page/i }).click()
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
  await page.getByRole('option', { name: /rename page/i }).click()
  await page.getByLabel('New name').fill('New Name')
  await page.getByRole('button', { name: 'OK' }).click()

  // The link-update dialog lists the affected note; apply it.
  await expect(page.getByRole('dialog', { name: /update links/i })).toBeVisible()
  await page.getByRole('button', { name: /update 1 link/i }).click()
  await expect(page.locator('.toast').filter({ hasText: /Updated/ })).toContainText(
    'Updated 1 link',
  )

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
  await expect(page.locator('.toast').filter({ hasText: /Restored/ })).toContainText('Restored')
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

test('Markdown source view shows the raw .md including frontmatter', async ({ page }) => {
  await createVault(page)
  await createNote(page, '---\ntitle: Raw\n---\n\n# Heading\n\n**bold** text')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  await page.getByRole('button', { name: 'Source', exact: true }).click()
  const source = page.locator('[data-testid="source-view"]')
  await expect(source).toBeVisible()
  // The exact file content is shown verbatim (frontmatter and markers).
  await expect(source.locator('.source-pre')).toContainText('title: Raw')
  await expect(source.locator('.source-pre')).toContainText('**bold** text')
  // It is a viewer, not an editor: no CodeMirror surface here.
  await expect(source.locator('.cm-content')).toHaveCount(0)
})

test('selection toolbar formats highlighted text in place', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'format me')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Select the whole line, then apply bold from the floating toolbar.
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  const toolbar = page.locator('.selection-toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByRole('button', { name: 'Bold' }).click()

  // Verify via the source view that the markers were written to the file.
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('[data-testid="source-view"] .source-pre')).toContainText(
    '**format me**',
  )
})

test('italic renders correctly (feedback: italics were broken)', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'plain *italic* and ***bold italic*** and _also italic_')
  await expect(page.locator('.status-bar')).toContainText('Saved')
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.markdown-body em', { hasText: 'italic' }).first()).toBeVisible()
  // Bold-italic nests em/strong (either order depending on the renderer).
  await expect(page.locator('.markdown-body em strong, .markdown-body strong em')).toHaveText(
    'bold italic',
  )
  await expect(page.locator('.markdown-body em', { hasText: 'also italic' })).toHaveText(
    'also italic',
  )
})

test('coloured highlight survives reopening the page', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'highlight this definition')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Highlight the whole line blue via the selection toolbar palette.
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.locator('.selection-toolbar button[aria-label="Highlight colour"]').click()
  await page.locator('.highlight-palette button[aria-label="Highlight blue"]').click()
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Reload, wait for the page to restore, then confirm the coloured mark
  // persisted and renders in reading view.
  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('highlight this definition')
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.markdown-body mark.mark-blue')).toContainText(
    'highlight this definition',
  )
})

test('create a subpage; breadcrumbs show the hierarchy', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'Parent page content')
  // Rename to a stable parent name.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('rename')
  await page.getByRole('option', { name: /rename page/i }).click()
  await page.getByLabel('New name').fill('Artificial Intelligence')
  await page.getByRole('button', { name: 'OK' }).click()

  // Create a subpage via the command palette.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('subpage')
  await page.getByRole('option', { name: /create subpage/i }).click()
  await page.getByLabel('Subpage title').fill('Machine Learning')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // Breadcrumbs should read Vault / Artificial Intelligence / Machine Learning.
  const crumbs = page.locator('.breadcrumbs')
  await expect(crumbs).toContainText('Artificial Intelligence')
  await expect(crumbs.locator('.crumb-current')).toHaveText('Machine Learning')
  // Stored portably as a folder note.
  await page.getByRole('button', { name: 'Source', exact: true }).isVisible()
})

test('slash menu: fuzzy search, keyboard insert, categories', async ({ page }) => {
  await createVault(page)
  const editor = page.locator('.cm-content')
  await editor.click()

  // Typing `/` opens the menu with category groups.
  await page.keyboard.type('/')
  const menu = page.locator('.slash-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.slash-group-label').first()).toBeVisible()

  // Fuzzy search: `/hea` surfaces headings; Enter inserts the top result.
  await page.keyboard.type('hea')
  await expect(menu.locator('.slash-item-title', { hasText: 'Heading 1' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(menu).toBeHidden()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('[data-testid="source-view"] .source-pre')).toContainText('#')
})

test('slash menu: click inserts, and AI commands are disabled', async ({ page }) => {
  await createVault(page)
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.type('/matrix')
  const menu = page.locator('.slash-menu')
  await menu.locator('.slash-item', { hasText: 'Matrix' }).first().click()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('[data-testid="source-view"] .source-pre')).toContainText('bmatrix')

  // AI commands appear but are disabled (no fake features).
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await editor.click()
  await page.keyboard.type('\n/rewrite')
  await expect(page.locator('.slash-item.disabled', { hasText: 'Rewrite' })).toBeVisible()
})

test('slash menu shares the registry with the command palette', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'palette shares slash')
  // The palette (Ctrl+K) can run an insert command from the shared registry.
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('Divider')
  await page
    .getByRole('option', { name: /Divider/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('[data-testid="source-view"] .source-pre')).toContainText('---')
})

test('search reports completion stats and supports exact phrase', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'the neural network learns representations')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const box = page.getByRole('searchbox', { name: 'Search vault' })
  await box.fill('neural network')
  await expect(page.locator('.search-status')).toContainText(/Search completed/)
  await expect(page.locator('.search-status')).toContainText(/match/)
  await expect(page.locator('.search-result')).toHaveCount(1)

  // Exact-phrase mode: a phrase that does not appear yields no matches.
  await page.getByRole('button', { name: 'Exact phrase' }).click()
  await box.fill('network neural')
  await expect(page.locator('.search-result')).toHaveCount(0)
})

test('vault switcher lists vaults and switches between them', async ({ page }) => {
  await createVault(page, 'First vault')
  await createNote(page, 'in the first vault')

  // Make a second vault via the switcher's "New vault" (→ welcome), so we
  // don't re-navigate and trigger the auto-reopen of the last vault.
  await page.locator('.vault-name-btn').click()
  await page.getByRole('button', { name: /New vault/ }).click()
  await page.getByRole('button', { name: /create my first vault/i }).click()
  await page.getByLabel('Vault name').fill('Second vault')
  await page.getByRole('button', { name: /Blank vault/ }).click()
  await page.getByRole('button', { name: /^Create vault$/ }).click()
  await expect(page.locator('.cm-content')).toBeVisible()

  // Open the switcher from the vault name; both vaults are listed.
  await page.locator('.vault-name-btn').click()
  const dialog = page.getByRole('dialog', { name: 'Your vaults' })
  await expect(dialog).toContainText('First vault')
  await expect(dialog).toContainText('Second vault')

  // Switch back to the first vault; its open tabs are restored, so its note
  // reappears without any further navigation.
  await dialog.getByRole('button', { name: /First vault/ }).click()
  await expect(page.locator('.cm-content')).toContainText('in the first vault', { timeout: 10_000 })
})

test('page colour is saved to frontmatter and shows a tree dot', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'colour me')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Set a colour from the note-header colour button.
  await page.getByRole('button', { name: 'Page colour' }).click()
  await page.locator('.color-picker button[aria-label="blue"]').click()
  await expect(page.locator('.toast').filter({ hasText: /colour/i })).toBeVisible()

  // The colour is written to frontmatter (portable) …
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(page.locator('[data-testid="source-view"] .source-pre')).toContainText('color: blue')
  // … and a colour dot appears in the page tree.
  await expect(page.locator('.file-tree .tree-color-dot')).toHaveCount(1)
})

test('slash menu shows icons and section labels', async ({ page }) => {
  await createVault(page)
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.type('/')
  const menu = page.locator('.slash-menu')
  await expect(menu).toBeVisible()
  // Each command renders an inline SVG icon …
  await expect(menu.locator('.slash-item-icon svg').first()).toBeVisible()
  // … grouped under category section labels.
  await expect(menu.locator('.slash-group-label').first()).toBeVisible()
  // The preview panel shows the selected command's details.
  await expect(menu.locator('.slash-preview')).toBeVisible()
})

test('attach a PDF: nests under the page, previews, and opens in-app', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'My lecture notes')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Insert an attachment via the command, uploading a file (adds under page).
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('insert attachment')
  await page.getByRole('option', { name: /insert attachment/i }).click()
  await page.getByRole('button', { name: /Add a file/ }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Choose a file/ }).click()
  await (await chooser).setFiles(new URL('./fixtures/lecture.pdf', import.meta.url).pathname)

  // The file is nested under the page (the note became a folder-note).
  await expect(page.locator('.file-tree')).toContainText('lecture')
  // The embed was inserted; reading view shows a PDF preview card.
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.pdf-embed-card')).toHaveCount(1)

  // Clicking the card opens the in-app viewer (not a download) with pages.
  await page.locator('.pdf-embed-card').first().click()
  await expect(page.locator('[data-testid="pdf-viewer"]')).toBeVisible()
  await expect(page.locator('.pdf-page canvas').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.pdf-toolbar')).toContainText('/ 6')
})

test('PDF viewer: text layer, find, thumbnails and split-with-note', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'lecture material')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByPlaceholder('Type a command…').fill('insert attachment')
  await page.getByRole('option', { name: /insert attachment/i }).click()
  await page.getByRole('button', { name: /Add a file/ }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Choose a file/ }).click()
  await (await chooser).setFiles(new URL('./fixtures/lecture.pdf', import.meta.url).pathname)
  await expect(page.locator('.file-tree')).toContainText('lecture')
  await page.keyboard.press('ControlOrMeta+Shift+r')
  await expect(page.locator('.pdf-embed-card')).toHaveCount(1)
  await page.locator('.pdf-embed-card').first().click()

  const viewer = page.locator('[data-testid="pdf-viewer"]')
  await expect(viewer).toBeVisible()
  await expect(page.locator('.pdf-page canvas').first()).toBeVisible({ timeout: 10_000 })

  // The text layer is present and selectable (enables copy).
  await expect(page.locator('.pdf-page[data-page="1"] .textLayer')).toContainText('Page 1 of 6', {
    timeout: 10_000,
  })

  // Thumbnails list every page.
  await page.getByRole('button', { name: 'Toggle thumbnails' }).click()
  await expect(page.locator('.pdf-thumb')).toHaveCount(6)

  // Find-in-document reports matches (one "Page" per page).
  await page.getByRole('button', { name: 'Find in document' }).click()
  await page.locator('.pdf-search-input').fill('Page')
  await expect(page.locator('.pdf-search-count')).toContainText('/ 6', { timeout: 10_000 })
  await expect(page.locator('.pdf-hl').first()).toBeVisible()
  await page.locator('.pdf-search-input').press('Escape')

  // Split with a companion note for paraphrasing.
  await page.getByRole('button', { name: 'Open note beside PDF' }).click()
  await expect(page.locator('.pdf-split-pane')).toHaveCount(2)
  await expect(page.locator('.pdf-split-note')).toContainText('lecture')
})

test('study workflow: flashcard review, dashboard and study mode', async ({ page }) => {
  await createVault(page)
  await createNote(
    page,
    'Question:: Powerhouse of the cell?\nAnswer:: Mitochondria\n\nThe capital of France :: Paris\n',
  )

  // Study dashboard counts the cards and opens a review.
  await page.getByRole('button', { name: 'Study', exact: true }).click()
  await expect(page.locator('.study-panel')).toBeVisible()
  await expect(page.locator('.study-badge')).toHaveText('2')
  await page.locator('.study-actions .btn-primary').click()

  const overlay = page.locator('.flashcard-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.flashcard-front')).toContainText('Powerhouse')
  // Reveal + rate advances the session.
  await page.keyboard.press('Space')
  await expect(overlay.locator('.flashcard-back')).toContainText('Mitochondria')
  await page.keyboard.press('2') // Good
  await expect(overlay.locator('.flashcard-front')).toContainText('capital of France')
  await page.keyboard.press('Escape')
  await expect(overlay).toBeHidden()

  // Study mode hides the chrome and offers an exit.
  await page.locator('.study-actions .btn', { hasText: 'Study mode' }).click()
  await expect(page.locator('.app-shell.study-mode')).toBeVisible()
  await expect(page.locator('.activity-rail')).toBeHidden()
  await page.locator('.study-exit').click()
  await expect(page.locator('.app-shell.study-mode')).toHaveCount(0)

  // The exam template creates a page that surfaces on the dashboard.
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('button', { name: /Exam preparation/ }).click()
  await page.getByLabel('Note title').fill('Calculus Final')
  await page.getByRole('button', { name: /^Create$/ }).click()
  await page.getByRole('button', { name: 'Study', exact: true }).click()
  await expect(page.locator('.study-exam-title')).toContainText('Calculus Final')
})

test('flashcards render as a flip card in the reader', async ({ page }) => {
  await createVault(page)
  await createNote(
    page,
    '# Cell Biology\n\nQuestion:: Powerhouse of the cell?\nAnswer:: Mitochondria\nTopic:: Organelles\n',
  )
  await page.keyboard.press('ControlOrMeta+Shift+r')
  const card = page.locator('.flashcard-embed')
  await expect(card).toBeVisible()
  await expect(card.locator('.flashcard-embed-front')).toContainText('Powerhouse')
  await expect(card.locator('.flashcard-embed-topic')).toHaveText('Organelles')
  // Clicking flips it to reveal the answer.
  await card.click()
  await expect(card).toHaveClass(/flipped/)
  await expect(card.locator('.flashcard-embed-back')).toContainText('Mitochondria')
})

test('PDF embed with special characters renders a card, not raw text', async ({ page }) => {
  await createVault(page)
  // An embed target with underscores/parentheses used to leak markdown emphasis.
  await createNote(page, '![[A_Study_(1_What_is_Research_).pdf]]')
  await page.keyboard.press('ControlOrMeta+Shift+r')
  // The embed becomes a PDF card (missing file → still a card shell), never
  // literal "![[…]]" text with stray italics.
  await expect(page.locator('.preview-content em')).toHaveCount(0)
  await expect(page.locator('.preview-content')).not.toContainText('![[')
})

test('pinned item shows a context menu so it can be unpinned', async ({ page }) => {
  await createVault(page)
  await createNote(page, 'pin me')
  await expect(page.locator('.status-bar')).toContainText('Saved')

  // Pin via the page's context menu.
  await page
    .locator('.file-tree .tree-item', { hasText: 'Untitled' })
    .first()
    .click({ button: 'right' })
  await page.getByRole('menuitem', { name: /^Pin$/ }).click()
  await expect(page.locator('.sidebar')).toContainText('Pinned')

  // Right-click the pinned entry (top) → menu appears with Unpin.
  await page
    .locator('.sidebar-section-label', { hasText: 'Pinned' })
    .locator('xpath=following-sibling::ul[1]')
    .locator('.tree-item')
    .first()
    .click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Unpin/ }).click()
  await expect(page.locator('.sidebar')).not.toContainText('Pinned')
})
