"""Strict JSON loading, fixture decoding, and bounded canonicalization."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .model import ContractError, RawJsonValue


def _reject_constant(token: str) -> None:
    raise ContractError("JSON_INVALID", f"Non-standard JSON number {token} is forbidden")


def _unique_object(pairs: list[tuple[str, RawJsonValue]]) -> dict[str, RawJsonValue]:
    result: dict[str, RawJsonValue] = {}
    for key, value in pairs:
        if key in result:
            raise ContractError("JSON_DUPLICATE_KEY", f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> RawJsonValue:
    return json.loads(
        path.read_text(encoding="utf-8"),
        object_pairs_hook=_unique_object,
        parse_constant=_reject_constant,
    )


def write_json(path: Path, value: RawJsonValue) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def canonicalize(value: RawJsonValue) -> str:
    if isinstance(value, dict):
        for key in value:
            if not isinstance(key, str) or not key or any(ord(char) < 0x20 or ord(char) > 0x7E for char in key):
                raise ContractError(
                    "CONTRACT_DOCUMENT_INVALID",
                    "Canonical object keys must be non-empty printable ASCII",
                )
        return "{" + ",".join(
            _string(key) + ":" + canonicalize(value[key]) for key in sorted(value)
        ) + "}"
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, str):
        return _string(value)
    if type(value) is bool:
        return "true" if value else "false"
    if type(value) is int:
        return str(value)
    raise ContractError(
        "CONTRACT_DOCUMENT_INVALID",
        "Canonical contract documents admit only objects, arrays, strings, booleans, and integers",
    )


def sha256(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def decode_fixture_values(value: RawJsonValue) -> RawJsonValue:
    if isinstance(value, dict) and set(value) == {"$fixtureFloat"}:
        token = value["$fixtureFloat"]
        if token == "NaN":
            return float("nan")
        if token == "+Infinity":
            return float("inf")
        if token == "-Infinity":
            return float("-inf")
        raise ContractError("CORPUS_INVALID_SENTINEL", f"Unknown fixture float token: {token}")
    if isinstance(value, dict):
        return {key: decode_fixture_values(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode_fixture_values(item) for item in value]
    return value


def _string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
