package io.jpyxis.resilience.port;

import io.jpyxis.resilience.api.AttemptObservation;
import io.jpyxis.resilience.api.AttemptPlan;

@FunctionalInterface
public interface AttemptExecutor {
    AttemptObservation execute(AttemptPlan plan);
}
