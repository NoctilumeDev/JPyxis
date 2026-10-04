"""Negative and cleanup witnesses for the bounded external-evidence consumer."""

import copy
import hashlib
import io
import json
import pathlib
import tempfile
import urllib.error
import zipfile

from external_evidence_consumer import (
    ExternalEvidenceContractError,
    ExternalEvidenceIntegrityError,
    ExternalEvidenceTransportError,
    acquire_verified_object,
    canonical_asset_url,
    load_migration_ledger,
    sha256,
    verify_zip_members,
)


class BytesResponse(io.BytesIO):
    status = 200

    def __init__(self, payload: bytes):
        super().__init__(payload)
        self.headers = {"Content-Length": str(len(payload))}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def record_for(payload: bytes) -> dict:
    digest = sha256(payload)
    record = {
        "schemaVersion": "jpyxis.io/external-evidence-migration/v1",
        "objectId": digest,
        "bytes": len(payload),
        "sha256": digest,
        "provider": "github-immutable-release-asset",
        "repository": "NoctilumeDev/JPyxis",
        "releaseTag": "consumer-mutation-fixture",
        "releaseImmutable": True,
        "assetName": f"fixture-{digest.removeprefix('sha256:')}.zip",
        "providerDigest": digest,
        "migrationState": "DUAL_RETAINED",
    }
    record["browserDownloadUrl"] = canonical_asset_url(record)
    return record


def opener_for(payload: bytes):
    return lambda *_args, **_kwargs: BytesResponse(payload)


def expect(label, failure, action):
    try:
        action()
    except failure:
        return {"mutation": label, "verdict": "PASS"}
    raise AssertionError(f"mutation did not fail closed: {label}")


def acquire_once(record, payload, temporary_parent):
    with acquire_verified_object(
        record,
        opener=opener_for(payload),
        temporary_parent=temporary_parent,
        budget_seconds=1.0,
        retry_delays=(0.0,),
    ) as path:
        assert path.exists()


with tempfile.TemporaryDirectory(prefix="jpyxis-consumer-mutations-") as temporary:
    root = pathlib.Path(temporary)
    archive_buffer = io.BytesIO()
    with zipfile.ZipFile(archive_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("evidence.txt", b"qualified")
    good_zip = archive_buffer.getvalue()
    good_record = record_for(good_zip)
    member_ledger = root / "members.json"
    member_ledger.write_text(
        json.dumps(
            {
                "members": [
                    {
                        "path": "evidence.txt",
                        "bytes": len(b"qualified"),
                        "sha256": sha256(b"qualified"),
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    results = []
    results.append(
        expect(
            "missing-ledger",
            ExternalEvidenceContractError,
            lambda: load_migration_ledger(root / "missing.json"),
        )
    )
    unauthorized = copy.deepcopy(good_record)
    unauthorized["migrationState"] = "EXTERNAL_READBACK_VERIFIED"
    results.append(
        expect(
            "unqualified-state",
            ExternalEvidenceContractError,
            lambda: acquire_once(unauthorized, good_zip, root),
        )
    )
    wrong_locator = copy.deepcopy(good_record)
    wrong_locator["browserDownloadUrl"] = "https://example.invalid/wrong.zip"
    results.append(
        expect(
            "wrong-locator",
            ExternalEvidenceContractError,
            lambda: acquire_once(wrong_locator, good_zip, root),
        )
    )

    def transport_failure():
        with acquire_verified_object(
            good_record,
            opener=lambda *_args, **_kwargs: (_ for _ in ()).throw(urllib.error.URLError("offline")),
            temporary_parent=root,
            budget_seconds=1.0,
            retry_delays=(0.0,),
        ):
            pass

    results.append(expect("transport-failure", ExternalEvidenceTransportError, transport_failure))

    def missing_asset():
        def not_found(request, **_kwargs):
            raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)

        with acquire_verified_object(
            good_record,
            opener=not_found,
            temporary_parent=root,
            budget_seconds=1.0,
            retry_delays=(0.0,),
        ):
            pass

    results.append(expect("missing-asset", ExternalEvidenceTransportError, missing_asset))

    class AdvancingClock:
        def __init__(self):
            self.value = 0.0

        def __call__(self):
            self.value += 0.6
            return self.value

    def deadline_exhaustion():
        with acquire_verified_object(
            good_record,
            opener=opener_for(good_zip),
            temporary_parent=root,
            budget_seconds=1.0,
            retry_delays=(0.0,),
            clock=AdvancingClock(),
        ):
            pass

    results.append(expect("absolute-deadline", ExternalEvidenceTransportError, deadline_exhaustion))
    results.append(
        expect(
            "truncated-object",
            ExternalEvidenceTransportError,
            lambda: acquire_once(good_record, good_zip[:-1], root),
        )
    )
    results.append(
        expect(
            "oversized-object",
            ExternalEvidenceIntegrityError,
            lambda: acquire_once(good_record, good_zip + b"x", root),
        )
    )
    corrupted = bytearray(good_zip)
    corrupted[-1] ^= 1
    results.append(
        expect(
            "object-digest-mismatch",
            ExternalEvidenceIntegrityError,
            lambda: acquire_once(good_record, bytes(corrupted), root),
        )
    )

    malformed = b"not-a-zip"
    malformed_record = record_for(malformed)

    def malformed_zip():
        with acquire_verified_object(
            malformed_record,
            opener=opener_for(malformed),
            temporary_parent=root,
            budget_seconds=1.0,
            retry_delays=(0.0,),
        ) as path:
            verify_zip_members(path, member_ledger)

    results.append(expect("malformed-zip", ExternalEvidenceIntegrityError, malformed_zip))
    wrong_members = root / "wrong-members.json"
    wrong_members.write_text(
        json.dumps(
            {
                "members": [
                    {
                        "path": "evidence.txt",
                        "bytes": len(b"qualified"),
                        "sha256": "sha256:" + hashlib.sha256(b"wrong").hexdigest(),
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    def member_mismatch():
        with acquire_verified_object(
            good_record,
            opener=opener_for(good_zip),
            temporary_parent=root,
            budget_seconds=1.0,
            retry_delays=(0.0,),
        ) as path:
            verify_zip_members(path, wrong_members)

    results.append(expect("member-digest-mismatch", ExternalEvidenceIntegrityError, member_mismatch))

    with acquire_verified_object(
        good_record,
        opener=opener_for(good_zip),
        temporary_parent=root,
        budget_seconds=1.0,
        retry_delays=(0.0,),
    ) as path:
        verify_zip_members(path, member_ledger)
        assert path.exists()
    results.append(expect("no-cache-fallback", ExternalEvidenceTransportError, transport_failure))
    assert sorted(path.name for path in root.iterdir()) == ["members.json", "wrong-members.json"]
    results.append({"mutation": "success-and-cleanup", "verdict": "PASS"})

print(json.dumps({"verdict": "PASS", "mutations": results}, indent=2))
