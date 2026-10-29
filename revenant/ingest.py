from datetime import datetime

from pydantic import BaseModel

from pgvector import Vector

from . import embed, models
from .db import connect
from .config import env
from .sentry import Sentry
from .signature import Signature, from_event


class Pattern(BaseModel):
    failure_pattern: str


def describe(sig: Signature) -> str:
    return f"{sig.exc_type}: {sig.message_template} in {sig.top_function} ({sig.top_file})"


def write_pattern(sig: Signature) -> str:
    prompt = (
        "A production bug was fixed in a web app. Write ONE sentence describing the generic "
        "failure pattern (the kind of mistake, not this exact line), so a reviewer can spot "
        "the same mistake in a future change.\n\n"
        f"Error: {describe(sig)}\nIn-app files involved: {', '.join(sig.files)}"
    )
    return models.chat(prompt, Pattern).failure_pattern.strip()


def merge(conn, incident_id, sig: Signature, issue: dict) -> None:
    conn.execute(
        """
        update incidents set
          files = array(select distinct unnest(files || %(files)s::text[])),
          symbols = array(select distinct unnest(symbols || %(symbols)s::text[])),
          sentry_issue_ids = array(select distinct unnest(sentry_issue_ids || %(ids)s::text[])),
          event_count = coalesce(event_count, 0) + %(count)s,
          first_seen = least(first_seen, %(first)s),
          last_seen = greatest(last_seen, %(last)s)
        where id = %(id)s
        """,
        {
            "files": sig.files, "symbols": sig.symbols, "ids": [issue["id"]],
            "count": int(issue["count"]), "first": issue["firstSeen"],
            "last": issue["lastSeen"], "id": incident_id,
        },
    )


def ingest(since: datetime | None, dry_run: bool) -> None:
    sentry = Sentry()
    conn = None if dry_run else connect()
    # Untested starting point. Tune on the planted bugs.
    threshold = float(env("REVENANT_MERGE_THRESHOLD", "0.9"))

    for issue in sentry.resolved_issues():
        if since and datetime.fromisoformat(issue["lastSeen"].replace("Z", "+00:00")) < since:
            continue
        sig = from_event(sentry.latest_event(issue["id"]))
        label = f"#{issue['id']} {issue['title'][:50]}"
        if sig is None:
            print(f"skip   {label}: no exception in latest event")
            continue
        if dry_run:
            print(f"sig    {label}\n         {sig.key}")
            continue

        # Layer 1: same Sentry issue ID means this run already saw it.
        if conn.execute("select 1 from incidents where %s = any(sentry_issue_ids)", (issue["id"],)).fetchone():
            print(f"seen   {label}")
            continue
        # Layer 2: same signature merges into one incident.
        row = conn.execute("select id from incidents where signature = %s", (sig.key,)).fetchone()
        if row:
            merge(conn, row[0], sig, issue)
            print(f"merge  {label} (same signature)")
            continue

        pattern = write_pattern(sig)
        vector = Vector(embed.embed(f"{pattern}\n{describe(sig)}"))
        # Layer 3: near-duplicate by embedding similarity within the same file.
        near = conn.execute(
            "select id, 1 - (embedding <=> %s) from incidents where top_file = %s "
            "order by embedding <=> %s limit 1",
            (vector, sig.top_file, vector),
        ).fetchone()
        if near and near[1] >= threshold:
            merge(conn, near[0], sig, issue)
            print(f"merge  {label} (similarity {near[1]:.3f})")
            continue

        conn.execute(
            """
            insert into incidents (signature, exc_type, message_template, top_file, top_function,
              files, symbols, failure_pattern, sentry_issue_ids, event_count, first_seen,
              last_seen, embedding)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (sig.key, sig.exc_type, sig.message_template, sig.top_file, sig.top_function,
             sig.files, sig.symbols, pattern, [issue["id"]], int(issue["count"]),
             issue["firstSeen"], issue["lastSeen"], vector),
        )
        print(f"new    {label}\n         {pattern}")
