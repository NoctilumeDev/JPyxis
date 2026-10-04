"""Fail-closed acquisition for the bounded external-evidence pilot."""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import pathlib
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from collections.abc import Callable, Iterator, Mapping, Sequence
from typing import Any


class ExternalEvidenceError(RuntimeError):
    """Base failure for external evidence acquisition."""


class ExternalEvidenceContractError(ExternalEvidenceError):
    """The Git-resident migration ledger is not eligible for consumption."""


class ExternalEvidenceTransportError(ExternalEvidenceError):
    """The external object could not be retrieved completely."""


class ExternalEvidenceIntegrityError(ExternalEvidenceError):
    """Retrieved bytes do not match their frozen identity."""


ALLOWED_CONSUMER_STATES = {
    "DUAL_RETAINED",
    "CONSUMERS_MIGRATED",
    "CURRENT_TREE_REMOVAL_ELIGIBLE",
    "EXTERNALIZED",
}
RETRYABLE_HTTP_STATUS = {408, 429, 500, 502, 503, 504}


def sha256(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def load_migration_ledger(path: pathlib.Path) -> dict[str, Any]:
    try:
        record = json.loads(path.read_bytes())
    except (OSError, ValueError) as error:
        raise ExternalEvidenceContractError(f"cannot read migration ledger: {path}") from error
    if not isinstance(record, dict):
        raise ExternalEvidenceContractError("migration ledger must be a JSON object")
    validate_migration_ledger(record)
    return record


def canonical_asset_url(record: Mapping[str, Any]) -> str:
    repository = urllib.parse.quote(str(record.get("repository", "")), safe="/")
    release_tag = urllib.parse.quote(str(record.get("releaseTag", "")), safe="")
    asset_name = urllib.parse.quote(str(record.get("assetName", "")), safe="")
    return f"https://github.com/{repository}/releases/download/{release_tag}/{asset_name}"


def validate_migration_ledger(record: Mapping[str, Any]) -> None:
    required = {
        "schemaVersion",
        "objectId",
        "bytes",
        "sha256",
        "provider",
        "repository",
        "releaseTag",
        "releaseImmutable",
        "assetName",
        "browserDownloadUrl",
        "providerDigest",
        "migrationState",
    }
    missing = sorted(required - record.keys())
    if missing:
        raise ExternalEvidenceContractError(f"migration ledger missing fields: {', '.join(missing)}")
    if record["schemaVersion"] != "jpyxis.io/external-evidence-migration/v1":
        raise ExternalEvidenceContractError("unsupported migration ledger schema")
    if record["migrationState"] not in ALLOWED_CONSUMER_STATES:
        raise ExternalEvidenceContractError("external evidence is not eligible for consumer migration")
    if record["provider"] != "github-immutable-release-asset" or record["releaseImmutable"] is not True:
        raise ExternalEvidenceContractError("migration ledger does not bind an immutable Release asset")
    if not isinstance(record["bytes"], int) or record["bytes"] <= 0:
        raise ExternalEvidenceContractError("external object length must be a positive integer")
    if record["objectId"] != record["sha256"] or record["providerDigest"] != record["sha256"]:
        raise ExternalEvidenceContractError("external object identities disagree")
    if record["browserDownloadUrl"] != canonical_asset_url(record):
        raise ExternalEvidenceContractError("external asset locator does not match its frozen coordinate")


def _download_attempt(
    record: Mapping[str, Any],
    partial_path: pathlib.Path,
    *,
    opener: Callable[..., Any],
    timeout: float,
    deadline: float,
    clock: Callable[[], float],
) -> None:
    request = urllib.request.Request(
        str(record["browserDownloadUrl"]),
        headers={"Accept": "application/octet-stream", "User-Agent": "jpyxis-external-consumer-v1"},
    )
    expected_bytes = int(record["bytes"])
    written = 0
    try:
        with opener(request, timeout=timeout) as response, partial_path.open("xb") as output:
            status = getattr(response, "status", 200)
            if status != 200:
                raise ExternalEvidenceTransportError(f"unexpected HTTP status: {status}")
            content_length = response.headers.get("Content-Length")
            if content_length is not None:
                try:
                    declared = int(content_length)
                except ValueError as error:
                    raise ExternalEvidenceTransportError("invalid Content-Length") from error
                if declared > expected_bytes:
                    raise ExternalEvidenceIntegrityError("external object exceeds its frozen length")
            while True:
                chunk = response.read(65536)
                if clock() >= deadline:
                    raise ExternalEvidenceTransportError("external download exceeded its absolute budget")
                if not chunk:
                    break
                written += len(chunk)
                if written > expected_bytes:
                    raise ExternalEvidenceIntegrityError("external object exceeds its frozen length")
                output.write(chunk)
    except FileExistsError as error:
        raise ExternalEvidenceTransportError("unique partial path already exists") from error
    if written != expected_bytes:
        raise ExternalEvidenceTransportError(
            f"external object is truncated: expected {expected_bytes} bytes, received {written}"
        )


@contextlib.contextmanager
def acquire_verified_object(
    record: Mapping[str, Any],
    *,
    opener: Callable[..., Any] = urllib.request.urlopen,
    temporary_parent: pathlib.Path | None = None,
    budget_seconds: float = 60.0,
    retry_delays: Sequence[float] = (0.0, 1.0, 2.0, 4.0, 8.0),
    clock: Callable[[], float] = time.monotonic,
    sleeper: Callable[[float], None] = time.sleep,
) -> Iterator[pathlib.Path]:
    validate_migration_ledger(record)
    if budget_seconds <= 0 or not retry_delays:
        raise ExternalEvidenceContractError("download budget and attempt schedule must be positive")
    parent = str(temporary_parent) if temporary_parent is not None else None
    deadline = clock() + budget_seconds
    with tempfile.TemporaryDirectory(prefix="jpyxis-external-evidence-", dir=parent) as temporary:
        directory = pathlib.Path(temporary)
        verified_path = directory / "verified.zip"
        last_transport: Exception | None = None
        for attempt, delay in enumerate(retry_delays, start=1):
            remaining = deadline - clock()
            if remaining <= 0:
                break
            if delay:
                if delay >= remaining:
                    break
                sleeper(delay)
                remaining = deadline - clock()
                if remaining <= 0:
                    break
            partial_path = directory / f"attempt-{attempt}-{uuid.uuid4().hex}.partial"
            try:
                _download_attempt(
                    record,
                    partial_path,
                    opener=opener,
                    timeout=min(30.0, remaining),
                    deadline=deadline,
                    clock=clock,
                )
                raw = partial_path.read_bytes()
                if sha256(raw) != record["sha256"]:
                    raise ExternalEvidenceIntegrityError("external object digest mismatch")
                os.replace(partial_path, verified_path)
                yield verified_path
                return
            except urllib.error.HTTPError as error:
                partial_path.unlink(missing_ok=True)
                if error.code not in RETRYABLE_HTTP_STATUS:
                    raise ExternalEvidenceTransportError(f"permanent HTTP status: {error.code}") from error
                last_transport = error
            except (urllib.error.URLError, TimeoutError, ConnectionError, ExternalEvidenceTransportError) as error:
                partial_path.unlink(missing_ok=True)
                last_transport = error
            except ExternalEvidenceIntegrityError:
                partial_path.unlink(missing_ok=True)
                raise
        raise ExternalEvidenceTransportError("external download retry budget exhausted") from last_transport


def verify_zip_members(container: pathlib.Path, member_ledger_path: pathlib.Path) -> None:
    try:
        ledger = json.loads(member_ledger_path.read_bytes())
        members = ledger["members"]
        with zipfile.ZipFile(container) as archive:
            names = archive.namelist()
            expected_names = [member["path"] for member in members]
            if len(names) != len(set(names)) or sorted(names) != sorted(expected_names):
                raise ExternalEvidenceIntegrityError("ZIP member set mismatch")
            for member in members:
                info = archive.getinfo(member["path"])
                if info.file_size != member["bytes"]:
                    raise ExternalEvidenceIntegrityError(f"ZIP member length mismatch: {member['path']}")
                content = archive.read(member["path"])
                if sha256(content) != member["sha256"]:
                    raise ExternalEvidenceIntegrityError(f"ZIP member digest mismatch: {member['path']}")
    except ExternalEvidenceIntegrityError:
        raise
    except (KeyError, OSError, ValueError, zipfile.BadZipFile) as error:
        raise ExternalEvidenceIntegrityError("malformed ZIP or member ledger") from error
