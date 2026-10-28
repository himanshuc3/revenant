# Testing guide

There are three layers of verification. Run them in this order — each is slower and broader than the last.

| Layer | Command | What it proves | Needs |
|---|---|---|---|
| Static | `npm run typecheck` · `npm run lint` | Types hold (strict, `noUncheckedIndexedAccess`, no `any`), code style | Node 22.12+ |
| Unit / component | `npm test` | Logic engine, storage, reducers, pages in jsdom | Node 22.12+ |
| End-to-end | `npm run e2e` | The real app in real Chromium, including PDF export | A Chromium browser |

Everything at once: `npm run test:all` (typecheck → lint → unit → e2e).
Expected result today: **110 unit tests in 11 files, 10 e2e tests, all passing**.

## 1. Setup

```bash
npm install
npx playwright install chromium      # once, only needed for the e2e layer
```

Already have a Chromium (CI image, container, corporate machine)? Skip the install and point Playwright at it:

```bash
PW_CHROMIUM_PATH=/path/to/chrome npm run e2e
```

## 2. Static checks

```bash
npm run typecheck   # tsc -b over src/, vite.config.ts and e2e/
npm run lint        # eslint; bans `any`, enforces `import type`, react-hooks rules
npm run build       # typecheck + production bundle
```

## 3. Unit and component tests (Vitest + React Testing Library)

```bash
npm test                      # run once
npm run test:watch            # re-run on change
npx vitest run src/logic      # one folder
npx vitest run -t "chained"   # tests whose name matches
```

| File | Tests | Covers |
|---|---|---|
| `src/logic/logic.test.ts` | 41 | **The conditional-logic engine** — every operator per field type, empty-target behaviour, show/hide, require/unrequire, last-match-wins, independent axes, chained conditions (also when fields are listed out of dependency order), cycles/self-reference/dangling targets, hidden-but-required, hidden values dropped from output, calculation (sum/avg/min/max, rounding, hidden sources, 0 as a value), template validation, reference cleanup |
| `src/domain/template.test.ts` | 17 | Zod schemas for every field type (min>max, decimals 0–4, labels, unique options, never-required header/calculation), `parseAccept`, template/instance JSON round-trip, invalid-value stripping |
| `src/storage/repository.test.ts` | 7 | Persist/reload, corrupt entries skipped and counted, invalid JSON, cascade delete, quota errors, subscriptions, draft creation (prefill today + snapshot) |
| `src/builder/reducer.test.ts` | 8 | Add/move/reorder/duplicate/remove, rule + calc-source pruning when a field or option is removed, dirty tracking |
| `src/builder/BuilderPage.test.tsx` | 4 | Add field → edit label → Save persists; incomplete calculation blocks save with a reason; reorder/delete; 404 |
| `src/fields/singleSelect/view.test.tsx` | 12 | Radio, Dropdown and Tiles each: select emits the option, clear emits `undefined`, required validation identical |
| `src/fill/fillReducer.test.ts` | 2 | Set/delete values; when errors become visible (touched → submit attempt) |
| `src/pages/FillPage.test.tsx` | 7 | Nothing red on first paint; required blocks submit; hidden-required ignored; hidden answer never persisted; revealed required enforced; live calculation; draft survives remount; submitted is read-only; 404 |
| `src/print/print.test.ts` | 6 | Print model (visible only, order, dash for empty, header sizes, multi-select lines, file note), HTML escaping, hidden values absent, iframe print flow (retitle → print → cleanup) |
| `src/pages/ResponsesPage.test.tsx` | 5 | Newest-first table, drafts section, Re-download targets the right response, delete with confirm, empty state, 404 |
| `src/App.test.tsx` | 1 | Shell renders |

Notes
- jsdom lacks `matchMedia`, `ResizeObserver` and `scrollIntoView`; `src/test/setup.ts` stubs them.
- `vite.config.ts` excludes `e2e/**` from Vitest and processes only `print.css` (it is inlined into the exported document, so an empty stylesheet would silently break PDF tests).
- Tests seed `localStorage` directly through the repository; each test file clears it in `beforeEach`.

## 4. End-to-end tests (Playwright)

```bash
npm run e2e                            # starts the dev server on :5199 automatically
npx playwright test builder-to-pdf     # one spec
npx playwright test --headed --debug   # watch it
npx playwright show-trace test-results/<folder>/trace.zip   # after a failure
```

| Spec | Flow |
|---|---|
| `e2e/builder-to-pdf.spec.ts` | Builds a form **entirely through the UI** (required field, two rules — one *show*, one *hide* — two Number fields, a Calculation) → saves → refreshes → New Response → required error on submit, nothing red before → conditional reveal/hide → required-once-revealed → live calculation → refresh mid-fill restores the draft → submit → read-only after refresh → stored data has no hidden values → Download PDF from the fill page and Re-download from the responses list → asserts content, escaping and field order → renders the exact captured document to a real A4 PDF |
| `e2e/field-types.spec.ts` | Radio / Dropdown / Tiles behave identically (required → pick → clear); date pre-fill with today; file upload (extension normalisation, count/type limits, metadata only — file bytes never reach storage); drag-and-drop **and** keyboard reordering; loop-creating rule targets not offered; corrupt `localStorage` shows a notice instead of crashing; unsaved-changes guard |

How the print dialog is tested: the native dialog cannot be automated, so `e2e/helpers.ts → capturePrints` replaces `print()` on the hidden export iframe, records it, and keeps the exact HTML. That HTML is then turned into a PDF with `page.pdf()`.

## 5. Manual checks automation cannot do

Run `npm run dev` and try these once in Chrome (and Safari/Firefox if you can):

1. **Real print dialog** — fill and submit a form, click *Download PDF*, choose *Save as PDF*. Check the suggested file name is `<Form title> – <date>`, margins look right, and the page is not blank.
2. **Long forms** — a 50+ field form should flow onto several A4 pages without splitting a row and without orphaned section headings. (Verified in Chromium: 8 pages for a 60-field form.)
3. **Two tabs** — open the Home page in two tabs, create a template in one: the other updates without a reload.
4. **Storage full** — in DevTools, fill `localStorage` to its quota and click *Save*: you get an error toast, not a crash.
5. **Hand-corrupt data** — edit `fb:v1:templates` in DevTools to invalid JSON and reload: the page shows "could not be read and was skipped".
6. **Keyboard** — Tab to a field's drag handle, `Space`, arrow keys, `Space` to reorder; Tiles are focusable and toggle with `Enter`/`Space`.
7. **Narrow screen** — the Fill form is fully responsive; the builder stacks its three panes below 1100 px.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `browserType.launch: Executable doesn't exist` | `npx playwright install chromium`, or set `PW_CHROMIUM_PATH` |
| `port 5199 is already in use` | Another dev server is running; stop it (the config reuses a server already on that port) |
| Lots of `dbus` / `UPower` lines in e2e output | Harmless noise from headless Chromium in containers |
| Vitest picks up `e2e/*.spec.ts` | Check `exclude` in `vite.config.ts` |
| Tests pass locally, e2e flaky after UI change | Prefer role/label locators; antd `Select` needs the visible `.ant-select` wrapper clicked (see `openSelect` in `e2e/helpers.ts`) |

## 7. Adding tests

- Logic: add cases to `src/logic/logic.test.ts` using the builders in `src/logic/testing.ts` (`text`, `num`, `rule`, `withId`, `templateOf`). When a test should prove the engine is doing the work, temporarily break the engine and confirm the test fails (that is how the "hidden fields contribute no value" rule was validated).
- New field type: add a model test next to its `model.ts`; the registry loop in `template.test.ts` already checks every type's default config.
- UI flows: extend `e2e/` and reuse `e2e/helpers.ts`.

## 8. Suggested CI

```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run typecheck && npm run lint && npm test
- run: npm run e2e
```
