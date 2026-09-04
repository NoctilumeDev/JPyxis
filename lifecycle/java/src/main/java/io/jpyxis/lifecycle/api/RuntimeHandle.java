package io.jpyxis.lifecycle.api;

import java.util.Objects;

public record RuntimeHandle(
        String providerIdentity,
        String providerVersion,
        String opaqueHandle) {
    public RuntimeHandle {
        providerIdentity = requireText(providerIdentity, "providerIdentity");
        providerVersion = requireText(providerVersion, "providerVersion");
        opaqueHandle = requireText(opaqueHandle, "opaqueHandle");
    }

    private static String requireText(String value, String label) {
        Objects.requireNonNull(value, label);
        if (value.isBlank()) {
            throw new IllegalArgumentException(label + " must not be blank");
        }
        return value;
    }
}
