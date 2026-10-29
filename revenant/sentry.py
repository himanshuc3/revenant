import re

import httpx

from .config import env

BASE = "https://sentry.io/api/0"
_NEXT = re.compile(r'<([^>]+)>; rel="next"; results="true"')


class Sentry:
    def __init__(self) -> None:
        self.org = env("SENTRY_ORG")
        self.project = env("SENTRY_PROJECT")
        self.http = httpx.Client(
            headers={"Authorization": f"Bearer {env('SENTRY_AUTH_TOKEN')}"},
            timeout=30,
        )

    def resolved_issues(self):
        """Yield every resolved issue, following Sentry's Link-header pagination."""
        url = f"{BASE}/projects/{self.org}/{self.project}/issues/"
        params = {"query": "is:resolved"}
        while url:
            resp = self.http.get(url, params=params)
            resp.raise_for_status()
            yield from resp.json()
            match = _NEXT.search(resp.headers.get("link", ""))
            url, params = (match.group(1), None) if match else (None, None)

    def latest_event(self, issue_id: str) -> dict:
        resp = self.http.get(f"{BASE}/issues/{issue_id}/events/latest/")
        resp.raise_for_status()
        return resp.json()
