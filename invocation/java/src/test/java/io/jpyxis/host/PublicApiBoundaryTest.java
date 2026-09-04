package io.jpyxis.host;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicApiBoundaryTest {
    @Test
    void publicHostApiDoesNotExposeCarrierOrRuntimeTypes() {
        for (Class<?> type : List.of(
                AffineBatchMapper.class,
                AffineBatchMappers.class,
                AffineBatchInput.class,
                AffineBatchResult.class,
                Float32Tensor.class,
                InvocationOptions.class,
                CancellationToken.class,
                JPyxisInvocationException.class)) {
            assertFalse(type.getName().startsWith("io.grpc"));
            for (Method method : type.getDeclaredMethods()) {
                String signature = method.toGenericString();
                assertFalse(signature.contains("io.grpc"), signature);
                assertFalse(signature.contains("com.google.protobuf"), signature);
                assertFalse(signature.contains("numpy"), signature);
                assertFalse(signature.contains("python"), signature);
            }
        }
    }

    @Test
    void invalidTypedShapeFailsBeforeAnyWorkerDispatch() throws Exception {
        Path root = Path.of("..", "..").toAbsolutePath().normalize();
        Path observations = Path.of("target", "m2-invalid-host-observations.jsonl");
        try (AffineBatchMapper mapper = AffineBatchMappers.connectLoopback(
                1,
                root.resolve("spec/m1/contracts/example.affine-batch.v1.json"),
                root.resolve("spec/m2/definitions/example_affine_v1.py"),
                "jpyxis:definition:example/affine-batch@1.0.0",
                observations)) {
            AffineBatchInput input = new AffineBatchInput(
                    new Float32Tensor(List.of(1, 3), List.of(1f, 2f, 3f)),
                    2f,
                    1f);
            JPyxisInvocationException failure = assertThrows(
                    JPyxisInvocationException.class,
                    () -> mapper.execute(input, InvocationOptions.withTimeout(Duration.ofSeconds(1))));
            assertEquals(FailureCategory.CONTRACT_FAULT, failure.category());
            assertEquals("TENSOR_SHAPE_MISMATCH", failure.code());
            assertFalse(failure.executionMayContinue());
        }
    }

    @Test
    void failingCancellationObserverCannotBlockOtherObservers() {
        CancellationToken token = new CancellationToken();
        AtomicBoolean secondObserverReached = new AtomicBoolean();
        token.onCancellation(() -> {
            throw new IllegalStateException("observer failure");
        });
        token.onCancellation(() -> secondObserverReached.set(true));

        assertTrue(token.cancel());
        assertTrue(secondObserverReached.get());
        assertFalse(token.cancel());
    }
}
