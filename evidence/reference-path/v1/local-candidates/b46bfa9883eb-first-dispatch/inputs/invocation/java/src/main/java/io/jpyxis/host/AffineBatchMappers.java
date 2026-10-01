package io.jpyxis.host;

import io.jpyxis.invocation.DefaultAffineBatchMapper;
import io.jpyxis.invocation.HostObservationRecorder;

import java.io.IOException;
import java.nio.file.Path;

public final class AffineBatchMappers {
    private AffineBatchMappers() {
    }

    public static AffineBatchMapper connectLoopback(
            int port,
            Path contractPath,
            Path definitionArtifact,
            String definitionIdentity,
            Path hostObservationPath) throws IOException {
        HostObservationRecorder recorder = HostObservationRecorder.open(hostObservationPath);
        return DefaultAffineBatchMapper.connect(
                port, contractPath, definitionArtifact, definitionIdentity, recorder);
    }
}
