import { expect, test, type Page } from '@playwright/test';
import { addField, save, setRequired } from './helpers';

async function newTemplate(page: Page, title: string) {
  await page.goto('/builder/new');
  await page.getByLabel('Form title').fill(title);
}

async function newResponse(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new response/i }).first().click();
  await page.waitForURL(/\/fill\//);
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('single select display types behave identically', () => {
  for (const display of ['Radio', 'Dropdown', 'Tiles'] as const) {
    test(`${display}: required, select, clear`, async ({ page }) => {
      await newTemplate(page, `Select ${display}`);
      await addField(page, 'Single Select', 'Plan');
      await setRequired(page);
      await page.locator('.ant-segmented').getByText(display, { exact: true }).click();
      await page.getByRole('button', { name: 'Preview' }).click();
      const modal = page.getByRole('dialog');

      await modal.getByRole('button', { name: 'Check validation' }).click();
      await expect(modal.getByText('This field is required')).toBeVisible();

      // choose "Option 2" the way each display expects
      if (display === 'Dropdown') {
        await modal.locator('.ant-select').click();
        await page.locator('.ant-select-dropdown:visible').getByTitle('Option 2').click();
      } else if (display === 'Tiles') {
        await modal.getByRole('radio', { name: 'Option 2' }).click();
      } else {
        await modal.getByLabel('Option 2').check();
      }
      await expect(modal.getByText('This field is required')).toHaveCount(0);
      await expect(modal.getByText('Looks good')).toBeVisible();

      await modal.getByRole('button', { name: /clear selection/i }).click();
      await expect(modal.getByText('This field is required')).toBeVisible();
    });
  }
});

test('date: pre-fill with today\'s date on a new response', async ({ page }) => {
  await newTemplate(page, 'Dates');
  await addField(page, 'Date', 'Start date');
  await page.getByLabel("Pre-fill with today's date").click();
  await save(page);

  await newResponse(page);
  await expect(page.getByLabel('Start date')).toHaveValue(todayIso());
});

test('file upload: metadata only, extension and count limits', async ({ page }) => {
  await newTemplate(page, 'Files');
  await addField(page, 'File Upload', 'Résumé');
  await page.getByLabel('Allowed file types').fill('PDF, .png');
  await page.getByLabel('Max number of files').fill('1');
  await page.getByLabel('Allowed file types').blur();
  await expect(page.getByLabel('Allowed file types')).toHaveValue('.pdf, .png'); // normalised
  await save(page);

  await newResponse(page);
  await page.locator('input[type=file]').setInputFiles({
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 hello'),
  });
  await expect(page.getByText('cv.pdf')).toBeVisible();

  // Too many files / wrong type are reported on submit.
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/at most 1 file|not an allowed type/)).toBeVisible();

  // Remove the extra file and submit; storage holds metadata only, never contents.
  await page.getByRole('button', { name: /delete|remove/i }).last().click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/can no longer be edited/)).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('fb:v1:instances') ?? '');
  expect(stored).toContain('cv.pdf');
  expect(stored).not.toContain('%PDF-1.4');
});

test('builder: reorder by drag-and-drop and by keyboard', async ({ page }) => {
  await newTemplate(page, 'Order');
  await addField(page, 'Single Line Text', 'First');
  await addField(page, 'Single Line Text', 'Second');
  await addField(page, 'Single Line Text', 'Third');
  const order = () =>
    page.locator('[data-testid^=canvas-field-]').evaluateAll((els) =>
      els.map((el) => el.querySelector('.ant-card-head-title strong')?.textContent?.replace(/\s*\*$/, '')),
    );
  expect(await order()).toEqual(['First', 'Second', 'Third']);

  // pointer: drag "Third" above "First"
  const handle = page.getByRole('button', { name: 'Drag Third to reorder' });
  const target = page.getByTestId(/canvas-field-/).first();
  const h = (await handle.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y - 40, { steps: 8 });
  await page.mouse.move(h.x + h.width / 2, t.y + 10, { steps: 12 });
  await page.mouse.up();
  await expect.poll(order).toEqual(['Third', 'First', 'Second']);

  // keyboard: Space to lift, arrow to move, Space to drop
  await page.getByRole('button', { name: 'Drag Third to reorder' }).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect.poll(order).toEqual(['First', 'Third', 'Second']);

  // and the explicit buttons still work
  await page.getByRole('button', { name: 'Move Second up' }).click();
  await expect.poll(order).toEqual(['First', 'Second', 'Third']);
});

test('rules: a rule target that would create a dependency loop is not offered', async ({ page }) => {
  await newTemplate(page, 'Loops');
  await addField(page, 'Single Line Text', 'A');
  await addField(page, 'Single Line Text', 'B');
  // B depends on A...
  await page.getByRole('tab', { name: /^Logic/ }).click();
  await page.getByRole('button', { name: 'Add rule' }).click();
  // ...so A may not depend on B.
  await page.getByTestId(/canvas-field-/).first().locator('.ant-card-head').click();
  await page.getByRole('tab', { name: /^Logic/ }).click();
  await expect(page.getByRole('button', { name: 'Add rule' })).toBeDisabled();
  // A cannot target itself either (only B is a candidate, and B loops back)
  await expect(page.getByText('Rule 1')).toHaveCount(0);
});

test('storage: corrupt data is skipped with a notice instead of crashing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('fb:v1:templates', JSON.stringify({ bad: { id: 'bad', fields: 'nope' } }));
    localStorage.setItem('fb:v1:instances', '{not json');
  });
  await page.reload();
  await expect(page.getByText(/could not be read and was skipped/)).toBeVisible();
  await expect(page.getByText('No templates yet')).toBeVisible();
  // the app still works
  await page.getByRole('button', { name: /create your first template/i }).click();
  await expect(page.getByLabel('Form title')).toBeVisible();
});

test('unsaved changes are guarded; saved changes are not', async ({ page }) => {
  await newTemplate(page, 'Guard');
  await addField(page, 'Number', 'Qty');
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.locator('.ant-modal-confirm-title')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Form title')).toBeVisible();

  await save(page);
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.locator('.ant-modal-confirm-title')).toHaveCount(0);
  await expect(page.getByText('Templates', { exact: true })).toBeVisible();
});

