package io.jpyxis.invocation.transport.grpc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.util.concurrent.FutureCallback;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.MoreExecutors;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.invocation.transport.InvocationAttempt;
import io.jpyxis.invocation.transport.InvocationTransport;
import io.jpyxis.invocation.transport.TransportCall;
import io.jpyxis.invocation.transport.TransportException;
import io.jpyxis.invocation.transport.WorkerCoordinates;
import io.jpyxis.invocation.transport.WorkerExecutionReport;
import io.jpyxis.invocation.transport.WorkerFailureObservation;
import io.jpyxis.invocation.wire.v1.AffineInput;
import io.jpyxis.invocation.wire.v1.AffineOutput;
import io.jpyxis.invocation.wire.v1.DType;
import io.jpyxis.invocation.wire.v1.InvokeRequest;
import io.jpyxis.invocation.wire.v1.InvocationWorkerGrpc;
import io.jpyxis.invocation.wire.v1.Layout;
import io.jpyxis.invocation.wire.v1.TensorValue;
import io.jpyxis.invocation.wire.v1.TransportProbeRequest;
import io.jpyxis.invocation.wire.v1.WorkerFailure;
import io.jpyxis.invocation.wire.v1.WorkerReport;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public final class GrpcInvocationTransport implements InvocationTransport {
    private final ManagedChannel channel;

    public GrpcInvocationTransport(int port) {
        channel = ManagedChannelBuilder.forAddress("127.0.0.1", port).usePlaintext().build();
    }

    @Override
    public void probe(Duration timeout) throws TransportException {
        try {
            InvocationWorkerGrpc.newBlockingStub(channel)
                    .withDeadlineAfter(timeout.toNanos(), TimeUnit.NANOSECONDS)
                    .probe(TransportProbeRequest.getDefaultInstance());
        } catch (StatusRuntimeException exception) {
            throw mapFailure(exception);
        }
    }

    @Override
    public TransportCall invoke(InvocationAttempt attempt, Duration timeout) {
        ListenableFuture<WorkerReport> wireFuture = InvocationWorkerGrpc.newFutureStub(channel)
                .withDeadlineAfter(timeout.toNanos(), TimeUnit.NANOSECONDS)
                .invoke(toWire(attempt));
        CompletableFuture<WorkerExecutionReport> completion = new CompletableFuture<>();
        Futures.addCallback(wireFuture, new FutureCallback<>() {
            @Override
            public void onSuccess(WorkerReport result) {
                completion.complete(fromWire(result));
            }

            @Override
            public void onFailure(Throwable throwable) {
                completion.completeExceptionally(mapFailure(throwable));
            }
        }, MoreExecutors.directExecutor());
        return new TransportCall(completion, () -> wireFuture.cancel(true));
    }

    private InvokeRequest toWire(InvocationAttempt attempt) {
        TensorValue.Builder tensor = TensorValue.newBuilder()
                .setDtype(DType.DTYPE_FLOAT32)
                .setLayout(Layout.LAYOUT_ROW_MAJOR)
                .addAllShape(attempt.input().values().shape())
                .addAllFloatValues(attempt.input().values().values());
        return InvokeRequest.newBuilder()
                .setCoordinates(io.jpyxis.invocation.wire.v1.InvocationCoordinates.newBuilder()
                        .setContractIdentity(attempt.coordinates().contractIdentity())
                        .setContractDigest(attempt.contractDigest())
                        .setDefinitionIdentity(attempt.coordinates().definitionIdentity())
                        .setDefinitionDigest(attempt.definitionDigest())
                        .setInvocationId(attempt.coordinates().invocationId())
                        .setAttemptId(attempt.coordinates().attemptId())
                        .setTraceId(attempt.coordinates().traceId()))
                .setDeadlineUnixMillis(attempt.deadlineUnixMillis())
                .setInput(AffineInput.newBuilder()
                        .setValues(tensor)
                        .setScale(attempt.input().scale())
                        .setBias(attempt.input().bias()))
                .build();
    }

    private WorkerExecutionReport fromWire(WorkerReport report) {
        var coordinates = report.getObservedCoordinates();
        JsonNode output = report.hasOutput() ? outputToCanonical(report.getOutput()) : null;
        WorkerFailureObservation failure = report.hasFailure()
                ? failureFromWire(report.getFailure())
                : null;
        return new WorkerExecutionReport(
                new WorkerCoordinates(
                        coordinates.getContractIdentity(),
                        coordinates.getContractDigest(),
                        coordinates.getDefinitionIdentity(),
                        coordinates.getDefinitionDigest(),
                        coordinates.getInvocationId(),
                        coordinates.getAttemptId(),
                        coordinates.getTraceId()),
                report.getWorkerIdentity(),
                report.getWorkerVersion(),
                report.getRuntimeIdentity(),
                report.getRuntimeVersion(),
                output,
                failure,
                rawReport(report, output));
    }

    private WorkerFailureObservation failureFromWire(WorkerFailure failure) {
        WorkerFailureObservation.Kind kind = switch (failure.getCategory()) {
            case WORKER_FAILURE_CATEGORY_CONTRACT -> WorkerFailureObservation.Kind.CONTRACT;
            case WORKER_FAILURE_CATEGORY_DEFINITION -> WorkerFailureObservation.Kind.DEFINITION;
            case WORKER_FAILURE_CATEGORY_RUNTIME -> WorkerFailureObservation.Kind.RUNTIME;
            default -> WorkerFailureObservation.Kind.UNSPECIFIED;
        };
        return new WorkerFailureObservation(
                kind,
                failure.getCode(),
                failure.getSummary(),
                failure.getRetryable(),
                failure.getOriginLayer(),
                failure.getCausalReference());
    }

    private JsonNode outputToCanonical(AffineOutput output) {
        ObjectNode result = JsonSupport.MAPPER.createObjectNode();
        ObjectNode tensor = result.putObject("values");
        tensor.put("dtype", output.getValues().getDtype() == DType.DTYPE_FLOAT32
                ? "float32" : "int32");
        ArrayNode shape = tensor.putArray("shape");
        output.getValues().getShapeList().forEach(shape::add);
        tensor.put("layout", output.getValues().getLayout() == Layout.LAYOUT_ROW_MAJOR
                ? "ROW_MAJOR" : "UNSPECIFIED");
        ArrayNode values = tensor.putArray("values");
        if (output.getValues().getDtype() == DType.DTYPE_FLOAT32) {
            output.getValues().getFloatValuesList().forEach(values::add);
        } else {
            output.getValues().getIntValuesList().forEach(values::add);
        }
        result.put("rows", output.getRows());
        return result;
    }

    private ObjectNode rawReport(WorkerReport report, JsonNode output) {
        ObjectNode node = JsonSupport.MAPPER.createObjectNode();
        node.put("schemaVersion", "jpyxis.io/m2-worker-report/v1alpha1");
        node.put("workerIdentity", report.getWorkerIdentity());
        node.put("workerVersion", report.getWorkerVersion());
        node.put("runtimeIdentity", report.getRuntimeIdentity());
        node.put("runtimeVersion", report.getRuntimeVersion());
        ObjectNode coordinateNode = node.putObject("observedCoordinates");
        var coordinates = report.getObservedCoordinates();
        coordinateNode.put("contractIdentity", coordinates.getContractIdentity());
        coordinateNode.put("contractDigest", coordinates.getContractDigest());
        coordinateNode.put("definitionIdentity", coordinates.getDefinitionIdentity());
        coordinateNode.put("definitionDigest", coordinates.getDefinitionDigest());
        coordinateNode.put("invocationId", coordinates.getInvocationId());
        coordinateNode.put("attemptId", coordinates.getAttemptId());
        coordinateNode.put("traceId", coordinates.getTraceId());
        if (report.hasFailure()) {
            WorkerFailure workerFailure = report.getFailure();
            ObjectNode failure = node.putObject("failure");
            failure.put("category", workerFailure.getCategory().name());
            failure.put("code", workerFailure.getCode());
            failure.put("summary", workerFailure.getSummary());
            failure.put("retryable", workerFailure.getRetryable());
            failure.put("originLayer", workerFailure.getOriginLayer());
            failure.put("causalReference", workerFailure.getCausalReference());
        } else if (output != null) {
            node.set("output", output.deepCopy());
        }
        return node;
    }

    private TransportException mapFailure(Throwable throwable) {
        Status.Code code = Status.fromThrowable(throwable).getCode();
        TransportException.Kind kind = switch (code) {
            case DEADLINE_EXCEEDED -> TransportException.Kind.DEADLINE_EXCEEDED;
            case CANCELLED -> TransportException.Kind.CANCELLED;
            case UNAVAILABLE -> TransportException.Kind.UNAVAILABLE;
            default -> TransportException.Kind.INTERRUPTED;
        };
        return new TransportException(kind, throwable);
    }

    @Override
    public void close() {
        channel.shutdownNow();
    }
}
