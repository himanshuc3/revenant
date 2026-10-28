import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * The native print dialog can't be driven, so record every `print()` on the
 * hidden export iframe together with the exact HTML it was about to print.
 */
export async function capturePrints(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __prints: string[] };
    w.__prints = [];
    new MutationObserver((mutations) => {
      for (const m of mutations)
        for (const node of m.addedNodes) {
          if (node instanceof HTMLIFrameElement && node.contentWindow) {
            const frame = node;
            frame.contentWindow!.print = () => w.__prints.push(frame.contentDocument!.documentElement.outerHTML);
          }
        }
    }).observe(document, { childList: true, subtree: true });
  });
}

export const printed = (page: Page) =>
  page.evaluate(() => (window as unknown as { __prints: string[] }).__prints);

/** Opens an antd Select by its accessible name (its real input is an invisible overlay). */
export async function openSelect(page: Page, name: string) {
  await page.locator('.ant-select').filter({ has: page.getByRole('combobox', { name }) }).first().click();
}

/** Picks an option from the dropdown that is currently open. */
export async function pickOption(page: Page, text: string) {
  await page.locator('.ant-select-dropdown:visible').getByTitle(text, { exact: true }).click();
}

/** Adds a field from the palette; it becomes the selected field. */
export async function addField(page: Page, title: string, label?: string) {
  await page.getByRole('button', { name: `Add ${title}` }).click();
  if (label !== undefined) await page.getByLabel('Label', { exact: true }).fill(label);
}

export async function setRequired(page: Page) {
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByLabel('Required', { exact: true }).click();
}

/** Opens the Logic tab of the selected field and adds a rule against `target`. */
export async function addRule(
  page: Page,
  opts: { target: string; value?: string; effect?: RegExp | string },
) {
  await page.getByRole('tab', { name: /^Logic/ }).click();
  await page.getByRole('button', { name: 'Add rule' }).click();
  await openSelect(page, 'Field to check');
  await pickOption(page, opts.target);
  if (opts.value !== undefined) await page.getByLabel('Value', { exact: true }).fill(opts.value);
  if (opts.effect) {
    await openSelect(page, 'Effect');
    await page.locator('.ant-select-dropdown:visible').getByText(opts.effect).click();
  }
}

export async function save(page: Page) {
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Template saved')).toBeVisible();
}

export const fieldOrder = (page: Page) =>
  page.locator('[data-testid^=canvas-field-] .ant-card-head-title strong, [data-testid^=canvas-field-] .ant-card-head-title .ant-typography strong').allTextContents();
