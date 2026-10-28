# AI usage log

**Tool:** Claude Code (an AI coding agent) working in a cloud session on this repository, from the first planning prompt to the final documentation. Everything below happened in that one continuous session. Prompts are quoted or closely paraphrased. It is kept short on purpose — a few prompts that mattered, what was checked, and what was wrong.

> This log was drafted by the AI at the author's request, from what actually happened in the session. The author should read it, correct anything that doesn't match their recollection, and add any prompts sent to other tools outside this session — this log only covers this one.

---

## 1. Planning, before any code

**Prompt (summary):** _Read the assignment PDF. Plan the approach as a staff frontend engineer: milestones, tech stack, serialization/deserialization, JSON-schema management and validation; list every stage with granular steps and expected output._

**What the AI did:** read the 8-page PDF, found the repo empty, asked four decisions that change the architecture, and wrote a milestone plan (M0–M10).

**The author's decisions** (the AI asked; these were not its defaults):

| Question            | Chosen                                                                   | Alternative that was offered                                 |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| PDF engine          | Print stylesheet + `window.print()`                                      | A hand-written PDF byte writer (true download, Latin-1 only) |
| Multiple conditions | Ordered rules, last match wins, visibility and required as separate axes | A per-field ALL/ANY toggle                                   |
| Refresh mid-fill    | Autosaved draft instances                                                | In-memory until Submit                                       |
| Stack               | Vite + React + strict TS + Zod + Vitest + **Ant Design**                 | Tailwind, or no extra libraries                              |

**Verified:** the AI re-read the PDF pages (as images) before planning — notably that the spec's "10 field types" actually lists 9 types plus Conditional Logic as a feature, which changed the data model.

## 2. "Build M0 through M6"

**Prompt (summary):** _Build phases M0–M6; tell me if you need anything._

**Verification the AI ran** (not just "it compiled"):

- Strict typecheck, ESLint (no `any`), 90 unit/component tests, production build, per milestone.
- **Mutation check on the riskiest rule.** It deliberately broke "a hidden field contributes no value" in the engine and confirmed that three tests failed (chained conditions, out-of-order chains, hidden calculation source), then restored it. Tests that pass on the first run can be vacuous; this proved they weren't.
- Drove the real app in headless Chromium: author a rule in the rule editor, watch a field appear/disappear live, save, refresh, reopen; add all nine field types; live calculation.
- Looked at screenshots rather than trusting the DOM.

## 3. "Implement M7 and M8"

**Prompt (summary):** _Implement Fill mode and PDF export + responses list._

**Verification:** a full browser run (required error blocks submit → conditional reveal → live calculation → refresh restores the draft → submit → read-only after refresh → stored data has no hidden values → print triggered from the fill page and the responses list). The exported document was rendered to a real A4 PDF and **viewed**, and a 60-field form was rendered to confirm multi-page flow (8 pages, no split rows).

## 4. "Finish the rest, verify functionality and UI, document testing"

**Prompt (summary):** _Complete remaining stages, verify the final functionality and UI, document the testing instructions._

**What changed as a result:** drag-and-drop (dnd-kit, keyboard operable) replacing buttons-only; a committed Playwright suite (10 tests) built from the throw-away scripts; responsive builder; README, `docs/TESTING.md`, this file. It also **tested the extensibility claim** by adding a real 11th field type, counting the files touched (2 existing files, one line each), then reverting it.

---

## Where the AI was wrong, or plausible-but-wrong

These are the real ones from this session, roughly in order of how much they would have mattered.

1. **Plausible but incorrect — labels that looked right but weren't wired.** The config panel rendered every label/input pair correctly on screen. A browser test using `getByLabel('Label')` then timed out: the antd `Form.Item` labels weren't associated with their controls (no `for`/`id` link), so screen readers would have announced unlabeled inputs. _Caught by:_ an accessibility-style locator failing, not by looking at the page. _Fix:_ `ConfigItem` generates an id and wires label → control.
2. **Wrong type, accepted by the author, rejected by the compiler.** The first `ValueOf<K>` type included `undefined`, which made every view's `Input` component incompatible with the registry's mapped type — a wall of errors. _Fix:_ `ValueOf` is the plain schema output; views handle `undefined` themselves.
3. **Test config silently hid a bug.** `css: false` in the Vitest config blanked the inlined print stylesheet, so an assertion that the exported document contains `@page` failed. The tests were right and the config wrong. _Fix:_ process only `print.css`. The production build was never affected.
4. **A test that would have given false confidence (my clear-selection test).** It rendered the component twice with freshly generated option ids, so the "selected" value never matched and the button it clicked didn't exist — failing for the wrong reason. Rewritten with one render.
5. **Test harness bug that looked like an app bug.** A "print() was never called" failure was first suspected to be a production bug. Probing showed the iframe, page title swap and print timer all worked; the harness's `MutationObserver` was attached to a `null` `documentElement`. Verified by reading the DOM state instead of editing app code.
6. **Misread behaviour.** A Playwright assertion expected a calculation of 22.50; the app showed 23.00 because the Tax field's default of **0 decimal places** rounded 2.5 → 3. The app was right per spec; the assertion was wrong. The behaviour was kept and documented as a product decision.
7. **Deprecated API from memory.** The first views used antd `addonBefore`/`addonAfter`; the browser console warned they are deprecated. Replaced with `prefix`/`suffix`. Same for `destroyOnClose` → `destroyOnHidden`.
8. **Sloppy first drafts that were rewritten:** `cleanReferences` shipped with a leftover `.filter(... && false)` no-op and was rewritten for clarity; several `as never` casts were removed once the types were right; the strict-typed `withOperator` in the rule editor originally didn't compile because a `<Select>` widens the operator to the whole union — it now verifies the operator against the kind's table at runtime before narrowing.
9. **Wrong setup instructions caught before publishing.** The first draft of the testing guide said "Node 20+". Checking `engines` in the installed packages showed Vitest 5 needs Node 22.12+. Docs, `package.json` and `.nvmrc` were corrected.
10. **Small command-line slip:** `pkill -f "vite --port"` matched its own shell and killed the command mid-way (exit 144). Checked repository state before re-running instead of assuming it had completed.

## What was checked, and how

- The spec's field list and what each config option means (re-read from the PDF pages; the "10 types" vs 9 discrepancy came from this).
- That tests can fail: the mutation check above, and the failures in items 1, 3 and 5 are evidence the suites aren't decorative.
- Screens, the PDF and multi-page output were **looked at**, not just asserted on.
- Claims in the README were checked against the code (casts audited with grep; "no `any`" confirmed; Node version read from `engines`).

## Alternatives rejected because of a decision

- Two registries instead of one (a React-free _model_ and a _view_ per field type): chosen so the logic layer can be tested without a DOM; costs one extra registration line.
- No PDF library and no hand-rolled PDF writer — print route chosen (see section 1).
- Per-field AND/OR toggle rejected in favour of last-match-wins per axis (see section 1).

## What I verified

This isn't an exhaustive list but some-things I remember as part of the process:

1. Create a list of flows that needs to be tested, first for happy flows and then stress testing for robustness.
2. Validating code is structured so that it doesn't hamper readability while having ease of extensibility and maintenance.
