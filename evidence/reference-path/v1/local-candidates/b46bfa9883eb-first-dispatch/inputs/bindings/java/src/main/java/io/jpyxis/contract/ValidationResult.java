package io.jpyxis.contract;

import java.util.Collections;
import java.util.Map;
import java.util.TreeMap;

public record ValidationResult(boolean accepted, String code, Map<String, Integer> bindings) {
    public ValidationResult {
        bindings = Collections.unmodifiableMap(new TreeMap<>(bindings));
    }

    public static ValidationResult accepted(Map<String, Integer> bindings) {
        return new ValidationResult(true, "OK", bindings);
    }

    public static ValidationResult rejected(String code, Map<String, Integer> bindings) {
        return new ValidationResult(false, code, bindings);
    }
}
