package io.jpyxis.invocation.transport;

import java.util.Set;

public record RuntimeCapabilityReport(
        RuntimeBinding binding,
        String operationIdentity,
        Set<String> supportedDtypes,
        Set<String> supportedLayouts) {

    public boolean supports(
            String capabilityIdentity,
            String capabilityVersion,
            String operation,
            String dtype,
            String layout) {
        return binding != null
                && binding.runtimeIdentity() != null
                && !binding.runtimeIdentity().isBlank()
                && binding.runtimeVersion() != null
                && !binding.runtimeVersion().isBlank()
                && binding.capabilityIdentity() != null
                && binding.capabilityVersion() != null
                && operationIdentity != null
                && supportedDtypes != null
                && supportedLayouts != null
                && binding.capabilityIdentity().equals(capabilityIdentity)
                && binding.capabilityVersion().equals(capabilityVersion)
                && operationIdentity.equals(operation)
                && supportedDtypes.contains(dtype)
                && supportedLayouts.contains(layout);
    }
}
