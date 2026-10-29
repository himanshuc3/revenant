create extension if not exists vector;

create table if not exists incidents (
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

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  pr int, head_sha text, mode text,
  candidates jsonb, verdicts jsonb,
  latency_ms int, tokens int, posted bool,
  created_at timestamptz default now()
);
