package io.jpyxis.host;

import java.util.Objects;

public record AffineBatchResult(Float32Tensor values, int rows) {
    public AffineBatchResult {
        Objects.requireNonNull(values, "values");
    }
}
