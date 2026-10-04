"""Anonymous, fail-closed readback for the bounded external-evidence pilot."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from typing import Any


RETRYABLE_HTTP = {408, 429, 500, 502, 503, 504}
MAX_ATTEMPTS = 5
MAX_BACKOFF_SECONDS = 8.0


class VerificationError(RuntimeError):
    """A fail-closed pilot verification error."""


def sha256(raw: bytes) -> str:
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def load_json(path: pathlib.Path) -> tuple[bytes, dict[str, Any]]:
    raw = path.read_bytes()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise VerificationError(f"expected JSON object: {path}")
    return raw, value


def repository_path(root: pathlib.Path, relative: str) -> pathlib.Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise VerificationError(f"repository path escapes root: {relative}")
    return path


def request_bytes(
    *,
    label: str,
    url: str,
    deadline: float,
    max_bytes: int,
    attempts: list[dict[str, Any]],
) -> bytes:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise VerificationError(f"{label}: absolute retrieval deadline exhausted")

        started = time.monotonic()
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "jpyxis-external-evidence-pilot-v1",
                "X-GitHub-Api-Version": "2026-03-10",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=min(remaining, 30.0)) as response:
                status = response.status
                raw = response.read(max_bytes + 1)
                if len(raw) > max_bytes:
                    raise VerificationError(f"{label}: response exceeded {max_bytes} bytes")
                attempts.append(
                    {
                        "label": label,
                        "attempt": attempt,
                        "httpStatus": status,
                        "bytes": len(raw),
                        "elapsedMs": round((time.monotonic() - started) * 1000),
                    }
                )
                if status != 200:
                    raise VerificationError(f"{label}: unexpected HTTP {status}")
                return raw
        except urllib.error.HTTPError as error:
            attempts.append(
                {
                    "label": label,
                    "attempt": attempt,
                    "httpStatus": error.code,
                    "bytes": 0,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                }
            )
            retryable = error.code in RETRYABLE_HTTP
            reason = f"HTTP {error.code}"
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            attempts.append(
                {
                    "label": label,
                    "attempt": attempt,
                    "transportError": type(error).__name__,
                    "bytes": 0,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                }
            )
            retryable = True
            reason = type(error).__name__

        if not retryable or attempt == MAX_ATTEMPTS:
            raise VerificationError(f"{label}: retrieval failed: {reason}")

        backoff = min(2**attempt, MAX_BACKOFF_SECONDS)
        if time.monotonic() + backoff >= deadline:
            raise VerificationError(f"{label}: retry budget exhausted after {reason}")
        time.sleep(backoff)

    raise VerificationError(f"{label}: retrieval exhausted without a terminal result")


def git_output(root: pathlib.Path, *args: str, binary: bool = False) -> bytes | str:
    output = subprocess.check_output(["git", *args], cwd=root)
    if binary:
        return output
    return output.decode("utf-8").strip()


def verify(record_path: pathlib.Path, timeout_seconds: float) -> dict[str, Any]:
    if os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN"):
        raise VerificationError("anonymous readback requires GH_TOKEN and GITHUB_TOKEN to be absent")
    if timeout_seconds <= 0:
        raise VerificationError("timeout must be positive")

    root = pathlib.Path(__file__).resolve().parents[1]
    record_raw, record = load_json(record_path.resolve())
    if record.get("schemaVersion") != "jpyxis.io/external-evidence-migration/v1":
        raise VerificationError("unsupported migration ledger schema")
    if record.get("migrationState") not in {
        "EXTERNAL_READBACK_VERIFIED",
        "DUAL_RETAINED",
        "CONSUMERS_MIGRATED",
        "CURRENT_TREE_REMOVAL_ELIGIBLE",
        "EXTERNALIZED",
    }:
        raise VerificationError("migration ledger is not eligible for anonymous readback")
    if record.get("provider") != "github-immutable-release-asset":
        raise VerificationError("unexpected external evidence provider")
    if record.get("mediaType") != "application/zip":
        raise VerificationError("unexpected external evidence media type")
    if record.get("originalRecoveryCommit") != record.get("firstRetainingCommit"):
        raise VerificationError("recovery commit does not match first retaining commit")
    if record.get("originalRecoveryGitBlob") != record.get("originalGitBlob"):
        raise VerificationError("recovery blob does not match original Git blob")

    verifier_revision = record["readbackVerifierRevision"]
    verifier_path = record["readbackVerifierPath"]
    expected_verifier_blob = git_output(root, "rev-parse", f"{verifier_revision}:{verifier_path}")
    current_verifier_blob = git_output(root, "hash-object", str(pathlib.Path(__file__).resolve()))
    if current_verifier_blob != expected_verifier_blob:
        raise VerificationError("current readback verifier differs from its recorded revision")

    member_path = repository_path(root, record["memberLedgerPath"])
    claim_path = repository_path(root, record["claimRecordPath"])
    member_raw, member_ledger = load_json(member_path)
    claim_raw, claim = load_json(claim_path)

    if sha256(member_raw) != record["memberLedgerSha256"]:
        raise VerificationError("member ledger digest mismatch")
    if sha256(claim_raw) != record["claimRecordSha256"]:
        raise VerificationError("claim record digest mismatch")

    historical_blob = git_output(
        root,
        "rev-parse",
        f"{record['firstRetainingCommit']}:{record['originalGitPath']}",
    )
    if historical_blob != record["originalGitBlob"]:
        raise VerificationError("original Git blob coordinate mismatch")
    historical_raw = git_output(
        root,
        "show",
        f"{record['firstRetainingCommit']}:{record['originalGitPath']}",
        binary=True,
    )
    if len(historical_raw) != record["bytes"] or sha256(historical_raw) != record["sha256"]:
        raise VerificationError("historical Git bytes do not match the evidence object identity")

    deadline = time.monotonic() + timeout_seconds
    attempts: list[dict[str, Any]] = []
    api_url = (
        "https://api.github.com/repos/"
        f"{record['repository']}/releases/tags/{record['releaseTag']}"
    )
    metadata_raw = request_bytes(
        label="release-metadata",
        url=api_url,
        deadline=deadline,
        max_bytes=2 * 1024 * 1024,
        attempts=attempts,
    )
    metadata = json.loads(metadata_raw)

    expected_release = {
        "id": record["releaseId"],
        "tag_name": record["releaseTag"],
        "target_commitish": record["releaseTarget"],
        "draft": False,
        "prerelease": True,
        "immutable": True,
    }
    for field, expected in expected_release.items():
        if metadata.get(field) != expected:
            raise VerificationError(f"release metadata mismatch: {field}")

    assets = metadata.get("assets")
    if not isinstance(assets, list) or len(assets) != 1:
        raise VerificationError("pilot release must contain exactly one asset")
    asset = assets[0]
    expected_asset = {
        "id": record["assetId"],
        "name": record["assetName"],
        "size": record["bytes"],
        "digest": record["providerDigest"],
        "state": "uploaded",
        "browser_download_url": record["browserDownloadUrl"],
    }
    for field, expected in expected_asset.items():
        if asset.get(field) != expected:
            raise VerificationError(f"release asset metadata mismatch: {field}")

    raw = request_bytes(
        label="release-asset",
        url=record["browserDownloadUrl"],
        deadline=deadline,
        max_bytes=record["bytes"],
        attempts=attempts,
    )
    if len(raw) != record["bytes"] or sha256(raw) != record["sha256"]:
        raise VerificationError("external evidence complete-object identity mismatch")
    if record["objectId"] != record["sha256"]:
        raise VerificationError("object ID is not the canonical content digest")

    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        expected_names = sorted(member["path"] for member in member_ledger["members"])
        if sorted(archive.namelist()) != expected_names:
            raise VerificationError("ZIP member inventory mismatch")
        for member in member_ledger["members"]:
            content = archive.read(member["path"])
            if len(content) != member["bytes"] or sha256(content) != member["sha256"]:
                raise VerificationError(f"ZIP member mismatch: {member['path']}")

        source = json.loads(archive.read("source.json"))
        config = json.loads(archive.read("config.json"))
        construction = json.loads(archive.read("construction.json"))
        receipt = json.loads(archive.read("receipt.json"))
        shutdown = json.loads(archive.read("independent-shutdown.json"))

    source_revision = record["sourceRevision"]
    source_tree = record["sourceTree"]
    if not (
        source["revision"]
        == member_ledger["sourceRevision"]
        == claim["sourceRevision"]
        == config["executionBuild"]["sourceRevision"]
        == source_revision
    ):
        raise VerificationError("source revision continuity mismatch")
    if not (
        source["tree"]
        == claim["sourceTree"]
        == config["executionBuild"]["sourceTree"]
        == source_tree
    ):
        raise VerificationError("source tree continuity mismatch")
    if git_output(root, "rev-parse", f"{source_revision}^{{tree}}") != source_tree:
        raise VerificationError("Git source tree does not match retained source identity")
    if claim["installedArtifactSha256"] != construction["javaArtifactSha256"]:
        raise VerificationError("installed artifact continuity mismatch")
    if claim["status"] != "SUPERSEDED":
        raise VerificationError("pilot claim status changed")
    if len(receipt["requests"]) != 5 or not receipt["allOwnedWorkersStopped"]:
        raise VerificationError("retained receipt invariant mismatch")
    observations = shutdown["observations"]
    if len(observations) != 6 or any(observation["alive"] for observation in observations):
        raise VerificationError("retained shutdown invariant mismatch")

    return {
        "verdict": "PASS",
        "anonymous": True,
        "tokenEnvironmentAbsent": True,
        "migrationState": record["migrationState"],
        "objectId": record["objectId"],
        "releaseId": record["releaseId"],
        "assetId": record["assetId"],
        "bytes": len(raw),
        "members": len(member_ledger["members"]),
        "sourceRevision": source_revision,
        "sourceTree": source_tree,
        "requests": len(receipt["requests"]),
        "allOwnedWorkersStopped": receipt["allOwnedWorkersStopped"],
        "attempts": attempts,
        "ledgerSha256": sha256(record_raw),
        "observedAt": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ledger",
        default="archive/historical-residuals/migration-ledgers/external-evidence-pilot-v1.json",
    )
    parser.add_argument("--timeout-seconds", type=float, default=60.0)
    args = parser.parse_args()
    try:
        result = verify(pathlib.Path(args.ledger), args.timeout_seconds)
    except (VerificationError, KeyError, OSError, ValueError, zipfile.BadZipFile) as error:
        print(json.dumps({"verdict": "FAIL", "reason": str(error)}, indent=2))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
