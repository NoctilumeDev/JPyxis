from __future__ import annotations

import sys
import tempfile
import unittest
from typing import cast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE_ROOT = ROOT / "bindings" / "python"
sys.path.insert(0, str(PACKAGE_ROOT))

from jpyxis_contract.codec import canonicalize, load_json  # noqa: E402
from jpyxis_contract.model import ContractError, RawJsonValue  # noqa: E402
from jpyxis_contract.parser import parse_contract  # noqa: E402


class ContractProfileTest(unittest.TestCase):
    def test_canonical_object_order_is_stable(self) -> None:
        self.assertEqual('{"a":1,"b":2}', canonicalize({"b": 2, "a": 1}))

    def test_reference_contract_matches_locked_identity(self) -> None:
        contract = parse_contract(ROOT / "spec" / "m1" / "contracts" / "example.affine-batch.v1.json")
        lock = load_json(ROOT / "spec" / "m1" / "identity.lock.json")
        self.assertEqual(lock["contractIdentity"], contract.identity)
        self.assertEqual(lock["contractDigest"], contract.digest)

    def test_contract_identity_is_format_independent(self) -> None:
        path = ROOT / "spec" / "m1" / "contracts" / "example.affine-batch.v1.json"
        value = load_json(path)
        self.assertEqual(parse_contract(path).identity, parse_contract(value).identity)

    def test_unknown_contract_fields_are_rejected(self) -> None:
        path = ROOT / "spec" / "m1" / "contracts" / "example.affine-batch.v1.json"
        value = load_json(path)
        value["transport"] = "grpc"
        with self.assertRaisesRegex(ContractError, "unknown fields"):
            parse_contract(value)

    def test_duplicate_json_keys_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"name":"first","name":"second"}\n', encoding="utf-8")
            with self.assertRaises(ContractError):
                load_json(path)

    def test_forward_symbol_reference_is_rejected(self) -> None:
        contract = self._reference_contract_document()
        fields = self._input_fields(contract)
        fields.insert(0, self._symbol_scalar_field("rows"))
        with self.assertRaises(ContractError) as context:
            parse_contract(contract)
        self.assertEqual("CONTRACT_DOCUMENT_INVALID", context.exception.code)

    def test_optional_symbol_binder_is_not_guaranteed(self) -> None:
        contract = self._reference_contract_document()
        fields = self._input_fields(contract)
        first_field = cast(dict[str, RawJsonValue], fields[0])
        first_field["required"] = False
        fields.insert(1, self._symbol_scalar_field("rows"))
        with self.assertRaises(ContractError) as context:
            parse_contract(contract)
        self.assertEqual("CONTRACT_DOCUMENT_INVALID", context.exception.code)

    @staticmethod
    def _reference_contract_document() -> dict[str, RawJsonValue]:
        path = ROOT / "spec" / "m1" / "contracts" / "example.affine-batch.v1.json"
        return cast(dict[str, RawJsonValue], load_json(path))

    @staticmethod
    def _input_fields(contract: dict[str, RawJsonValue]) -> list[RawJsonValue]:
        spec = cast(dict[str, RawJsonValue], contract["spec"])
        operation = cast(dict[str, RawJsonValue], spec["operation"])
        input_type = cast(dict[str, RawJsonValue], operation["input"])
        return cast(list[RawJsonValue], input_type["fields"])

    @staticmethod
    def _symbol_scalar_field(name: str) -> dict[str, RawJsonValue]:
        return {
            "name": name,
            "required": True,
            "type": {
                "kind": "scalar",
                "scalarType": "int32",
                "equalsSymbol": "B",
            },
        }


if __name__ == "__main__":
    unittest.main()
