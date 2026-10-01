package io.jpyxis.host;

import java.util.List;
import java.util.Objects;

public record Float32Tensor(List<Integer> shape, List<Float> values) {
    public Float32Tensor {
        shape = List.copyOf(Objects.requireNonNull(shape, "shape"));
        values = List.copyOf(Objects.requireNonNull(values, "values"));
    }
}
