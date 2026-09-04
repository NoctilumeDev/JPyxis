package io.jpyxis.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContractProfileTest {
    private static final Path ROOT = findRepositoryRoot();

    @Test
    void canonicalObjectOrderIsStable() throws Exception {
        JsonNode value = JsonSupport.MAPPER.readTree("{\"b\":2,\"a\":1}");
        assertEquals("{\"a\":1,\"b\":2}", JsonSupport.canonicalize(value));
    }

    @Test
    void referenceContractMatchesLockedIdentity() throws Exception {
        ContractModel.AlgorithmContract contract = new ContractParser().parse(
                ROOT.resolve("spec/m1/contracts/example.affine-batch.v1.json"));
        JsonNode lock = JsonSupport.read(ROOT.resolve("spec/m1/identity.lock.json"));
        assertEquals(lock.path("contractIdentity").asText(), contract.identity());
        assertEquals(lock.path("contractDigest").asText(), contract.digest());
    }

    @Test
    void contractIdentityIsFormatIndependent() throws Exception {
        Path path = ROOT.resolve("spec/m1/contracts/example.affine-batch.v1.json");
        JsonNode value = JsonSupport.read(path);
        ContractParser parser = new ContractParser();
        assertEquals(parser.parse(path).identity(), parser.parse(value).identity());
    }

    @Test
    void unknownContractFieldsAreRejected() throws Exception {
        ObjectNode value = (ObjectNode) JsonSupport.read(
                ROOT.resolve("spec/m1/contracts/example.affine-batch.v1.json"));
        value.put("transport", "grpc");
        ContractException exception = assertThrows(
                ContractException.class, () -> new ContractParser().parse(value));
        assertEquals("CONTRACT_DOCUMENT_INVALID", exception.code());
    }

    @Test
    void duplicateJsonKeysAreRejected(@TempDir Path directory) throws Exception {
        Path file = directory.resolve("duplicate.json");
        Files.writeString(file, "{\"name\":\"first\",\"name\":\"second\"}\n");
        assertThrows(JsonProcessingException.class, () -> JsonSupport.read(file));
    }

    private static Path findRepositoryRoot() {
        Path current = Path.of("").toAbsolutePath().normalize();
        while (current != null) {
            if (current.resolve("spec/m1/identity.lock.json").toFile().isFile()) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Cannot locate JPyxis repository root");
    }
}
