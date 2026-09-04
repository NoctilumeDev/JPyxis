package io.jpyxis.host;

import java.util.Objects;

public record AffineBatchInput(Float32Tensor values, float scale, float bias) {
    public AffineBatchInput {
        Objects.requireNonNull(values, "values");
    }
}
