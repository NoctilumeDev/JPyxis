"""Run the shared M1 corpus with the independent Python binding."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .codec import decode_fixture_values, load_json, write_json
from .compatibility import compare_types
from .evidence import validate_evidence_envelope
from .model import RawJsonValue, ValidationResult
from .normalization import normalize_value
from .parser import parse_contract, parse_type
from .validation import validate_value


def run(
    contract_path: Path, corpus_path: Path, output_path: Path
) -> dict[str, RawJsonValue]:
    contract = parse_contract(contract_path)
    corpus = load_json(corpus_path)
    if (
        not isinstance(corpus, dict)
        or corpus.get("schemaVersion") != "jpyxis.io/conformance-corpus/v1alpha1"
        or not isinstance(corpus.get("cases"), list)
    ):
        raise ValueError("Unsupported or malformed conformance corpus")

    report_cases: list[dict[str, RawJsonValue]] = []
    mismatches: list[str] = []
    for case in corpus["cases"]:
        case_id = case["id"]
        kind = case["kind"]
        if kind == "input":
            actual = _validation_result(
                validate_value(
                    contract.operation.input,
                    decode_fixture_values(case["value"]),
                    case.get("bindings", {}),
                )
            )
        elif kind == "output":
            actual = _validation_result(
                validate_value(
                    contract.operation.output,
                    decode_fixture_values(case["value"]),
                    case.get("bindings", {}),
                )
            )
        elif kind == "type":
            actual = _validation_result(
                validate_value(
                    parse_type(case["type"]),
                    decode_fixture_values(case["value"]),
                    case.get("bindings", {}),
                )
            )
        elif kind == "compatibility":
            actual = {
                "relation": compare_types(
                    parse_type(case["baseType"]), parse_type(case["candidateType"])
                ).value
            }
        elif kind == "evidence":
            actual = _validation_result_without_bindings(
                validate_evidence_envelope(case["value"])
            )
        else:
            raise ValueError(f"Unknown case kind: {kind}")

        report_case = {"id": case_id, "kind": kind, "result": actual}
        if (
            kind in {"input", "output", "type", "evidence"}
            and "accepted" in actual
            and not actual["accepted"]
        ):
            report_case["failureCategory"] = "CONTRACT_FAULT"
        if kind == "input":
            report_case["executionEligible"] = actual["accepted"]
        elif kind == "output":
            report_case["invocationSuccessEligible"] = actual["accepted"]
        report_cases.append(report_case)
        if actual.get("accepted") and kind in {"input", "output", "type"}:
            if kind == "input":
                type_spec = contract.operation.input
            elif kind == "output":
                type_spec = contract.operation.output
            else:
                type_spec = parse_type(case["type"])
            report_cases[-1]["normalizedValue"] = normalize_value(
                type_spec, decode_fixture_values(case["value"])
            )
        if case.get("expected") != actual:
            mismatches.append(
                f"{case_id}: expected {case.get('expected')!r} but got {actual!r}"
            )

    report = {
        "schemaVersion": "jpyxis.io/conformance-report/v1alpha1",
        "binding": "python",
        "contractIdentity": contract.identity,
        "contractDigest": contract.digest,
        "cases": report_cases,
    }
    write_json(output_path, report)
    if mismatches:
        raise AssertionError("\n".join(mismatches))
    return report


def _validation_result(result: ValidationResult) -> dict[str, RawJsonValue]:
    value = _validation_result_without_bindings(result)
    if result.accepted:
        value["bindings"] = result.bindings
    return value


def _validation_result_without_bindings(result: ValidationResult) -> dict[str, RawJsonValue]:
    return {"accepted": result.accepted, "code": result.code}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    report = run(arguments.contract, arguments.corpus, arguments.output)
    print(f"Python M1 conformance passed: {len(report['cases'])} cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())
