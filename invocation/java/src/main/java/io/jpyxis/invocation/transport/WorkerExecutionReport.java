package io.jpyxis.invocation.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

public record WorkerExecutionReport(
        WorkerCoordinates coordinates,
        String workerIdentity,
        String workerVersion,
        String runtimeIdentity,
        String runtimeVersion,
        JsonNode canonicalOutput,
        WorkerFailureObservation failure,
        ObjectNode rawReport) {
}
