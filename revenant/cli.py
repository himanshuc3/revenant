from datetime import datetime, timezone
from typing import Optional

import typer

app = typer.Typer(no_args_is_help=True)


@app.callback()
def main() -> None:
    """Revenant: remember resolved incidents, warn when a PR could bring one back."""


@app.command("ingest")
def ingest_cmd(
    since: Optional[datetime] = typer.Option(None, help="Only issues last seen on/after this date."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print signatures; no model or DB calls."),
) -> None:
    from .ingest import ingest

    if since and since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    ingest(since, dry_run)
