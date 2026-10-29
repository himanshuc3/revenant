import re
from dataclasses import dataclass

_URL = re.compile(r"https?://\S+")
_UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
_HEX = re.compile(r"\b[0-9a-f]{16,}\b", re.I)
_NUM = re.compile(r"\b\d+(?:\.\d+)?\b")
# Vite/rollup bundle hashes, e.g. react-dom-BCNX9mNN.js
_BUNDLE_HASH = re.compile(r"-[A-Za-z0-9_]{8}(?=\.(?:js|mjs|css)$)")


def template_message(message: str) -> str:
    """Replace URLs, IDs and numbers so the same bug yields the same text."""
    for pattern, token in ((_URL, "<url>"), (_UUID, "<id>"), (_HEX, "<id>"), (_NUM, "<n>")):
        message = pattern.sub(token, message)
    return message.strip()


def normalize_file(path: str) -> str:
    path = path.split("?")[0].lstrip("/")
    return _BUNDLE_HASH.sub("", path)


def normalize_function(name: str | None) -> str:
    # "Object.onClick" and "HTMLUnknownElement.onClick" are the same handler.
    return (name or "<anonymous>").split(".")[-1]


@dataclass
class Signature:
    exc_type: str
    message_template: str
    top_file: str | None
    top_function: str | None
    files: list[str]
    symbols: list[str]

    @property
    def key(self) -> str:
        return "|".join(
            [self.exc_type, self.message_template, self.top_file or "", self.top_function or ""]
        )


def from_event(event: dict) -> Signature | None:
    """Build a signature from a Sentry event, or None if it has no exception."""
    exception = next((e for e in event.get("entries", []) if e["type"] == "exception"), None)
    if not exception:
        return None
    value = exception["data"]["values"][-1]
    frames = (value.get("stacktrace") or {}).get("frames") or []
    in_app = [f for f in frames if f.get("inApp")]
    # Sentry orders frames oldest first, so the crash site is the last one.
    top = in_app[-1] if in_app else None
    return Signature(
        exc_type=value.get("type") or "Error",
        message_template=template_message(value.get("value") or ""),
        top_file=normalize_file(top["filename"]) if top and top.get("filename") else None,
        top_function=normalize_function(top.get("function")) if top else None,
        files=sorted({normalize_file(f["filename"]) for f in in_app if f.get("filename")}),
        symbols=sorted({normalize_function(f.get("function")) for f in in_app}),
    )
