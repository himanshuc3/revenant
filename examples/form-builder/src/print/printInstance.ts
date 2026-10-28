import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Instance } from '../domain/template';
import { buildPrintModel, printTitle } from './model';
import { PrintableForm } from './PrintableForm';
import printCss from './print.css?inline';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The complete, self-contained HTML document for a response. */
export function renderPrintDocument(instance: Instance): string {
  const body = renderToStaticMarkup(createElement(PrintableForm, { model: buildPrintModel(instance) }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(printTitle(instance))}</title><style>${printCss}</style></head><body>${body}</body></html>`;
}

const CLEANUP_FALLBACK_MS = 60_000;

/**
 * Opens the browser's print dialog for a response (choose "Save as PDF").
 * Uses only browser-native APIs: a hidden iframe holds the document so the app
 * itself never needs print styles, and it works for any stored response.
 */
export function printInstance(instance: Instance): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error('Could not open the print preview');
  }

  frameDocument.open();
  frameDocument.write(renderPrintDocument(instance));
  frameDocument.close();

  // Chrome names the saved PDF after the top-level page title, so borrow it for the print.
  const originalTitle = document.title;
  document.title = printTitle(instance);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = originalTitle;
    iframe.remove();
  };
  frameWindow.addEventListener('afterprint', cleanup);
  window.setTimeout(cleanup, CLEANUP_FALLBACK_MS);

  // Give the iframe a tick to lay out before the dialog snapshots it.
  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 100);
}
