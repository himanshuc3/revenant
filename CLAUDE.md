# Revenant: project context for Claude Code

Handoff written Thu 2026-10-29 16:38 IST from a claude.ai planning session. Treat this file as the source of truth for decisions made so far. When something here conflicts with what you find in the repo, tell the user instead of silently picking one.

## What this is

Revenant remembers resolved production incidents from Sentry and warns on pull requests that risk bringing one back ("the bug we already fixed once, caught before it shipped twice"). It is a submission to the DEV Hacktoberfest Open-Source AI Challenge, Week 4, theme "Ghost in the Machine".

Challenge page: https://dev.to/challenges/hacktoberfest-week4-2026-10-26

### Hackathon rules that affect the code and repo

- Deadline: Oct 31, 11:59 PM PDT, which is Nov 1 about 12:29 PM IST. Plan to publish Saturday night IST. Sunday morning is buffer only.
- The project must be new and built inside the window. Any commit after the deadline must be noted in the README.
- Open-weight models or open-source AI must be at the core. The post must explain why open innovation mattered.
- Prior work must be credited. The form-builder example app predates the window, so it lives in `examples/form-builder/` as a copy WITHOUT git history, with a README naming the original repo (github.com/himanshuc3/assignment_keychain) and listing what was added (Sentry setup, planted bugs). Credit it again in the post.
- Judging: writing quality (weighted most), relevance to theme, creativity, technical execution, partner technology (optional).
- Partner categories to enter: Best Use of Gemma, Best Use of Tiger Data, Best Use of Sentry Agent Tracing. Only claim a category that is genuinely used.
- Post tags: devchallenge, hf26challenge. Submission template sections: What I Built, Demo, Code, How I Built It, Why Does Open Innovation Matter?, My Agent Session (optional), The Spirit of It (optional), Prize Categories.

## Decisions made, and why

| Decision | Reason |
| --- | --- |
| Data source v1: Sentry only | User wants a working v1. RCA docs and fix PRs are deferred. |
| Keep a real memory: dedupe plus vector search | User rejected a simpler file-path-only version as having no value. Do NOT scope down to grep-like matching. |
| Database: Tiger Data (managed Postgres with pgvector) | Unique-signature upserts, SQL for dedupe and evaluation, built-in full-text search for the keyword channel, same SQL locally and in cloud. Atlas was considered and rejected (M0 allows only 3 Atlas Search indexes; indexes can't be created via mongosh). |
| Models: hosted open-weight models through an OpenAI-compatible API, OpenRouter first | User has no local GPU plan. Keep base URL and model in env vars. Bedrock is an optional second provider so models can be compared. |
| Orchestration: GitHub Actions, no GitHub App | Less infrastructure. No webhook server or tunnel. Jobs are manual-trigger first (`workflow_dispatch`). |
| Language: Python 3.12 with uv | Embedding step is simplest in Python. |
| Temporal dropped | Not needed without a long-running service. |
| Monorepo | Revenant is the project; the form builder is the monitored example. |

## Repo layout

```
revenant/                 Python package: ingest, review, db, models
examples/form-builder/    the monitored app (credited copy, no history)
eval/                     labeled PRs, run scripts, results
docker-compose.yml        local pgvector Postgres for dev
.github/workflows/        later: manual-trigger ingest and review
README.md
```

## Flows

### Ingest (`revenant ingest --since <date>`)

1. List resolved issues for the Sentry project, paginating, and fetch each issue's latest event.
2. Normalize into a signature: exception type, message with numbers, IDs and URLs replaced by placeholders, top in-app frame as file and function. No line numbers, no bundle hashes.
3. Dedupe in three layers:
   - same Sentry issue ID is an upsert (re-running must be safe);
   - same signature merges into one incident (accumulate issue IDs, counts, last_seen);
   - near-duplicate by embedding similarity within the same file merges too. Start the threshold near 0.9. THIS NUMBER IS UNTESTED: tune it on the planted bugs.
4. Model writes a one-sentence generic failure pattern. Embed it plus the signature, then upsert.

### Review (`revenant review --pr <n> [--dry-run]`)

1. Get the PR diff. Normalize changed paths using an `app_root` setting (`examples/form-builder`), because Sentry frames show `src/...` while the diff shows `examples/form-builder/src/...`. Without this, file matching silently finds nothing.
2. Retrieve candidates three ways: file and function overlap, vector similarity between a change summary and incident patterns, keyword match on identifiers (Postgres full-text).
3. Model judges the top few. It must quote one diff line and one incident line. CODE verifies that the quoted diff line really appears in the diff and drops any finding that fails.
4. Post one sticky PR comment (marker `<!-- revenant -->`, update on each push), or print it in dry-run mode. Log every run to the `reviews` table.
5. If no candidates pass, post nothing. Noise is the main risk.

Dry-run mode doubles as the evaluation harness.

## Schema (Tiger Data / Postgres)

```sql
create extension if not exists vector;

create table incidents (
  id uuid primary key default gen_random_uuid(),
  signature text unique not null,
  exc_type text, message_template text,
  top_file text, top_function text,
  files text[], symbols text[],
  failure_pattern text, root_cause text,
  sentry_issue_ids text[], event_count int,
  first_seen timestamptz, last_seen timestamptz,
  embedding vector(384)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  pr int, head_sha text, mode text,
  candidates jsonb, verdicts jsonb,
  latency_ms int, tokens int, posted bool,
  created_at timestamptz default now()
);
```

The vector size 384 assumes `BAAI/bge-small-en-v1.5` through `fastembed`. CONFIRM the model's dimension before inserting data. If the model changes, change the column and re-embed everything. At a few hundred rows no vector index is needed; exact search is fine.

Smoke test to run first: insert a row with `array_fill(0.1, array[384])::vector`, query with `embedding <=> <same vector>`, expect distance near 0, delete the row.

## Sentry details

- Auth token scopes: `event:read`, `project:read`. Org and project slugs in env.
- Endpoints used: list project issues (`/api/0/projects/{org}/{project}/issues/` with query `is:resolved`; issue search does not support AND/OR), issue detail (`/api/0/issues/{id}/`), issue events and latest event. Check exact paths against a real response.
- The demo app is browser code. Stack frames show bundle filenames unless source maps are uploaded with the Sentry Vite plugin or the app runs from the dev server. Fix this first or file matching breaks.
- A Sentry-only record says what failed and where, not why. Plan: leave a short note on the Sentry issue when resolving it (cause and fix) and have ingest read it. UNVERIFIED which endpoint returns issue notes. Check first. If awkward, skip and leave `root_cause` empty; warnings then say "this code path crashed before: <pattern>".
- Use a second, separate Sentry project later for tracing Revenant's own model calls (Agent Tracing category).

## Model client

- One function `chat(prompt, schema)`; provider, base URL and model come from env.
- Structured-output support varies by model on OpenRouter and is silently ignored on some. Ask for JSON, parse, validate with pydantic, retry once to repair. Never trust unvalidated output.
- Hosted APIs mean diffs and error data leave the machine. Say so honestly in the post. The open-model argument is: swap models freely, same weights can be self-hosted by changing the base URL, no lock-in, measurable cost per review.

## Environment variables

`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `REVENANT_MODEL`, `REVENANT_APP_ROOT`. GitHub Actions provides `GITHUB_TOKEN`. Never commit secrets or print them in logs.

## Libraries

`openai` SDK (pointed at OpenRouter), `httpx`, `psycopg` + `pgvector`, `pydantic`, `typer`, `fastembed`. Demo app: `@sentry/react` and the Sentry Vite plugin.

## Evaluation plan (for the write-up)

- 20 labeled PRs: about 10 that reintroduce an old incident in a new shape (renamed function, moved file, dropped guard) and 10 clean ones, at least 4 of them hard negatives touching the same files safely. Label before running; do not tune prompts on the reported set.
- Compare three variants: A files only, B files plus vectors, C full pipeline with the model judge. Report regressions caught out of 10, false alarms out of 10, median latency, tokens per review. If time allows, repeat across 2 to 3 open models.
- Be upfront that the incidents are planted in a demo app and 20 PRs shows the approach works, not real-world accuracy.

## Demo app: planted bugs

Ideas from the form-builder README: a calculation over a hidden field, a corrupted localStorage entry bypassing validation, the print model with an empty optional field. For each: break it on a branch, trigger the error so Sentry captures it, fix it, resolve it in Sentry with a note.

## Status as of Thu 2026-10-29 16:38 IST

- User is creating a Tiger Data Free Plan service through its UI (not the 30-day trial). Schema and smoke test not yet run.
- Unknown: whether Sentry has already captured the planted bugs; whether the monorepo skeleton and the example app copy exist yet. Check the repo.
- Unknown: whether Tiger's free plan restricts connecting IP addresses. If it does, run jobs from the user's machine instead of Actions.

## Remaining schedule (IST)

- Thu (today): database ready, `revenant ingest` working end to end, 3 to 4 incidents checked by hand including one deliberate duplicate that merges. If ingest slips, cut embedding-similarity merge and keep exact-signature dedupe.
- Fri: `revenant review` with dry-run, manual-trigger workflows, Sentry tracing on model calls, the evaluation.
- Sat: feature freeze by midday, record a 2 to 3 minute demo (old incident, new PR reintroducing it, comment appears), README, publish the DEV post by night.
- Sun morning: buffer only.

## Cut order if time runs short

Inline hunk comments, a "crypt" dashboard, a GitHub check run, second model provider, then the embedding-similarity merge.

## How the user wants to work

- Easy wins are welcome, but the product must keep real value (deduped vector memory plus a judge that quotes evidence).
- Writing quality counts most in judging, so protect time for the post. Keep a short list of real moments to quote in it.
- State what you verified and what you did not. Do not present untested thresholds or unverified API details as facts.

## Open questions

- Embedding model final choice and dimension.
- Which Sentry endpoint returns issue notes.
- Whether to add Bedrock as a second provider for model comparison.

## Reference

The claude.ai planning doc (https://claude.ai/artifact/1T78T7JvxNG6ppP8tw2iux) is STALE: it still describes the earlier GitHub App, Temporal and local-Ollama design. This file supersedes it.
