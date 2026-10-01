package io.jpyxis.lifecycle.api;

public enum DeploymentState {
    REQUESTED,
    LOADING,
    WARMING,
    STANDBY,
    ACTIVE,
    DRAINING,
    UNLOADING,
    RETIRED,
    FAILED
}
