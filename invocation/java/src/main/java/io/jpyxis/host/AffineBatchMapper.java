package io.jpyxis.host;

public interface AffineBatchMapper extends AutoCloseable {
    AffineBatchResult execute(AffineBatchInput input, InvocationOptions options)
            throws JPyxisInvocationException;

    @Override
    void close();
}
