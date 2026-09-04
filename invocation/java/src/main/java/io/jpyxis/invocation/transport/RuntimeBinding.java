package io.jpyxis.invocation.transport;

public record RuntimeBinding(
        String runtimeIdentity,
        String runtimeVersion,
        String capabilityIdentity,
        String capabilityVersion) {
}
