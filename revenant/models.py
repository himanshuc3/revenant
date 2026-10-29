import json
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from .config import env

T = TypeVar("T", bound=BaseModel)


def _client() -> OpenAI:
    return OpenAI(
        base_url=env("REVENANT_BASE_URL", "https://openrouter.ai/api/v1"),
        api_key=env("OPENROUTER_API_KEY"),
    )


def _extract_json(text: str) -> str:
    start, end = text.find("{"), text.rfind("}")
    return text[start : end + 1] if start != -1 and end > start else text


def chat(prompt: str, schema: type[T]) -> T:
    """Ask for JSON, validate with pydantic, retry once to repair. Never trust raw output."""
    client, model = _client(), env("REVENANT_MODEL")
    messages = [
        {
            "role": "user",
            "content": f"{prompt}\n\nReply with only a JSON object matching this schema:\n"
            f"{json.dumps(schema.model_json_schema())}",
        }
    ]
    for attempt in range(2):
        reply = client.chat.completions.create(model=model, messages=messages)
        text = reply.choices[0].message.content or ""
        try:
            return schema.model_validate_json(_extract_json(text))
        except ValidationError as err:
            if attempt:
                raise
            messages += [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"That did not validate: {err}. Reply with corrected JSON only."},
            ]
    raise AssertionError("unreachable")
