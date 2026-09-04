"""Process-local evidence utilities shared by the M2 and M3 worker adapters."""

from __future__ import annotations

import json
import math
import threading
import time
from pathlib import Path
from typing import Any


class ObservationRecorder:
    def __init__(
        self,
        path: Path,
        schema_version: str = "jpyxis.io/m2-observation/v1alpha1",
    ) -> None:
        self._schema_version = schema_version
        self._sequence = 0
        self._lock = threading.Lock()
        self._healthy = True
        self._failure: str | None = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._stream = path.open("w", encoding="utf-8", newline="\n")
        except OSError as error:
            self._stream = None
            self._healthy = False
            self._failure = type(error).__name__

    @property
    def healthy(self) -> bool:
        return self._healthy

    @property
    def failure(self) -> str | None:
        return self._failure

    def record(
        self,
        event: str,
        coordinates: Any | None = None,
        details: dict[str, Any] | None = None,
        *,
        late: bool = False,
    ) -> None:
        with self._lock:
            if not self._healthy or self._stream is None:
                return
            self._sequence += 1
            item = {
                "schemaVersion": self._schema_version,
                "sequence": self._sequence,
                "observedAt": _utc_now(),
                "source": "WORKER",
                "event": event,
                "late": late,
                "invocationId": getattr(coordinates, "invocation_id", ""),
                "attemptId": getattr(coordinates, "attempt_id", ""),
                "traceId": getattr(coordinates, "trace_id", ""),
                "details": details or {},
            }
            try:
                self._stream.write(json.dumps(item, separators=(",", ":"), sort_keys=True))
                self._stream.write("\n")
                self._stream.flush()
            except OSError as error:
                self._healthy = False
                self._failure = type(error).__name__

    def close(self) -> None:
        if self._stream is None:
            return
        try:
            self._stream.close()
        except OSError as error:
            self._healthy = False
            self._failure = type(error).__name__


def _utc_now() -> str:
    milliseconds = math.floor(time.time() * 1000)
    seconds, fraction = divmod(milliseconds, 1000)
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(seconds)) + f".{fraction:03d}Z"


__all__ = ["ObservationRecorder"]
