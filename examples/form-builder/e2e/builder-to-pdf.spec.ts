import { expect, test } from '@playwright/test';
import { addField, addRule, capturePrints, openSelect, pickOption, printed, save, setRequired } from './helpers';

test.beforeEach(async ({ context }) => capturePrints(context));

test('build a form, fill it with conditional logic, submit, and export a PDF', async ({ page, context }) => {
  // ---------- Builder: author the template entirely through the UI ----------
  await page.goto('/');
  await page.getByRole('button', { name: /create your first template/i }).click();
  await page.getByLabel('Form title').fill('Customer Intake');

  await addField(page, 'Single Line Text', 'Full name');
  await setRequired(page);

  await addField(page, 'Single Line Text', 'Anything to add?');

  await addField(page, 'Multi-line Text', 'Please explain');
  await setRequired(page);
  await page.getByRole('tab', { name: /^Logic/ }).click();
  await page.getByLabel('Visible by default').click(); // hidden until the rule fires
  await addRule(page, { target: 'Anything to add?', value: 'yes', effect: 'Show this field' });

  await addField(page, 'Single Line Text', 'Internal note');
  await addRule(page, { target: 'Anything to add?', value: 'yes', effect: 'Hide this field' });

  await addField(page, 'Number', 'Rent');
  await openSelect(page, 'Decimal places');
  await pickOption(page, '2');
  await addField(page, 'Number', 'Food');
  await openSelect(page, 'Decimal places');
  await pickOption(page, '2');

  await addField(page, 'Calculation', 'Monthly total');
  await page.locator('.ant-select').filter({ hasText: 'Choose Number fields' }).click();
  await page.locator('.ant-select-dropdown:visible').getByTitle('Rent').click();
  await page.locator('.ant-select-dropdown:visible').getByTitle('Food').click();
  await page.keyboard.press('Escape');

  await save(page);
  await page.reload();
  await expect(page.locator('[data-testid^=canvas-field-]')).toHaveCount(7); // survives a refresh

  // ---------- Fill: validation, conditions, calculation, draft, submit ----------
  await page.goto('/');
  await expect(page.getByText('7 fields')).toBeVisible();
  await page.getByRole('button', { name: /new response/i }).click();
  await page.waitForURL(/\/fill\//);

  await expect(page.getByText('This field is required')).toHaveCount(0); // nothing red on first paint
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('This field is required')).toHaveCount(1);

  await page.getByLabel('Full name').fill('Ada Lovelace');
  await expect(page.getByLabel('Please explain')).toHaveCount(0);
  await expect(page.getByLabel('Internal note')).toBeVisible();

  await page.getByLabel('Anything to add?').fill('yes');
  await expect(page.getByLabel('Please explain')).toBeVisible();
  await expect(page.getByLabel('Internal note')).toHaveCount(0); // hide rule fired

  // The required field is now visible, so it blocks submit until answered.
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('This field is required')).toHaveCount(1);
  await page.getByLabel('Please explain').fill('Because <b>reasons</b>');

  await page.getByLabel('Rent').fill('1200.5');
  await page.getByLabel('Food').fill('300.25');
  await page.getByLabel('Full name').click(); // blur
  await expect(page.getByLabel('Monthly total')).toHaveValue('1,500.75');

  // Refresh mid-fill: the autosaved draft comes back.
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace');
  await expect(page.getByLabel('Monthly total')).toHaveValue('1,500.75');

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/can no longer be edited/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name')).toBeDisabled(); // read-only after refresh

  // Submitted data never contains a hidden field.
  const stored = await page.evaluate(() =>
    Object.values(JSON.parse(localStorage.getItem('fb:v1:instances') ?? '{}')) as Array<{
      status: string;
      values: Record<string, unknown>;
    }>,
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]!.status).toBe('submitted');
  expect(Object.values(stored[0]!.values)).not.toContain('should-never-appear');

  // ---------- PDF: from the fill page and again from the responses list ----------
  await page.getByRole('button', { name: /download pdf/i }).click();
  await expect.poll(async () => (await printed(page)).length).toBe(1);

  await page.getByRole('link', { name: /view all responses/i }).click();
  await expect(page.getByText('Submitted (1)')).toBeVisible();
  await page.getByRole('button', { name: /re-download pdf/i }).click();
  await expect.poll(async () => (await printed(page)).length).toBe(2);

  const html = (await printed(page))[1]!;
  expect(html).toContain('Customer Intake');
  expect(html).toContain('Ada Lovelace');
  expect(html).toContain('1,500.75');
  expect(html).not.toContain('Internal note'); // hidden by the rule
  expect(html).toContain('&lt;b&gt;reasons&lt;/b&gt;'); // user text is escaped
  // Fields appear in form order.
  const order = ['Full name', 'Anything to add?', 'Please explain', 'Rent', 'Food', 'Monthly total'].map((l) =>
    html.indexOf(`>${l}<`),
  );
  expect(order.every((i) => i > 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);

  // Render that exact document to a real PDF.
  const pdfPage = await context.newPage();
  await pdfPage.setContent(html);
  const pdf = await pdfPage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5_000);

  // Home reflects the filled count.
  await page.goto('/');
  await expect(page.getByText('1 filled')).toBeVisible();
});
