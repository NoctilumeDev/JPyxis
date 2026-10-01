package io.jpyxis.reference;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import io.jpyxis.contract.JsonSupport;

final class SourceJournal implements AutoCloseable {
    private final BufferedWriter writer;
    private long sequence;
    SourceJournal(Path path) throws Exception {
        Files.createDirectories(path.toAbsolutePath().getParent());
        writer=Files.newBufferedWriter(path,StandardCharsets.UTF_8);
    }
    synchronized void record(String owner,String event,Object details) {
        try {
            writer.write(JsonSupport.MAPPER.writeValueAsString(Map.of("schemaVersion","jpyxis.io/reference-source/v1alpha1",
                    "sequence",++sequence,"observedAt",Instant.now().toString(),"owner",owner,"event",event,"details",details)));
            writer.newLine();writer.flush();
        } catch(Exception e){throw new IllegalStateException("required source record unavailable",e);}
    }
    @Override public synchronized void close() throws Exception {writer.close();}
}
