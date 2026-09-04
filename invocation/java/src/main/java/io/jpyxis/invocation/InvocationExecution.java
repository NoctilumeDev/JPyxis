package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.host.AffineBatchResult;
import io.jpyxis.host.InvocationCoordinates;

public record InvocationExecution(
        TerminalState state,
        InvocationCoordinates coordinates,
        AffineBatchResult result,
        InvocationFailure failure,
        ObjectNode rawWorkerReport,
        boolean workerDispatched,
        boolean evidenceRecorderHealthy) {
}
