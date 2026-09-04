package io.jpyxis.invocation;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.AffineBatchInput;
import io.jpyxis.host.AffineBatchMapper;
import io.jpyxis.host.AffineBatchResult;
import io.jpyxis.host.JPyxisInvocationException;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.transport.grpc.GrpcInvocationTransport;

import java.io.IOException;
import java.nio.file.Path;

public final class DefaultAffineBatchMapper implements AffineBatchMapper {
    private final InvocationManager manager;

    private DefaultAffineBatchMapper(InvocationManager manager) {
        this.manager = manager;
    }

    public static DefaultAffineBatchMapper connect(
            int port,
            Path contractPath,
            Path definitionArtifact,
            String definitionIdentity,
            HostObservationRecorder recorder) throws IOException {
        GrpcInvocationTransport transport = new GrpcInvocationTransport(port);
        try {
            return new DefaultAffineBatchMapper(new InvocationManager(
                    transport,
                    contractPath,
                    definitionArtifact,
                    definitionIdentity,
                    recorder));
        } catch (IOException | RuntimeException exception) {
            transport.close();
            recorder.close();
            throw exception;
        }
    }

    @Override
    public AffineBatchResult execute(AffineBatchInput input, InvocationOptions options)
            throws JPyxisInvocationException {
        ObjectNode canonicalInput = JsonSupport.MAPPER.createObjectNode();
        ObjectNode tensor = canonicalInput.putObject("values");
        tensor.put("dtype", "float32");
        ArrayNode shape = tensor.putArray("shape");
        input.values().shape().forEach(shape::add);
        tensor.put("layout", "ROW_MAJOR");
        ArrayNode values = tensor.putArray("values");
        input.values().values().forEach(values::add);
        canonicalInput.put("scale", input.scale());
        canonicalInput.put("bias", input.bias());

        InvocationExecution execution = manager.invokeCanonical(canonicalInput, options);
        if (execution.state() == TerminalState.SUCCEEDED) {
            return execution.result();
        }
        InvocationFailure failure = execution.failure();
        throw new JPyxisInvocationException(
                failure.category(),
                failure.code(),
                failure.summary(),
                execution.coordinates(),
                failure.retryable(),
                failure.executionMayContinue(),
                failure.resultProducedButRejected());
    }

    @Override
    public void close() {
        manager.close();
    }
}
