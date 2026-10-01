package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.TreeMap;

final class ReferenceJson {
    static JsonNode tree(Object value) { return JsonSupport.MAPPER.valueToTree(value); }
    static JsonNode read(Path path) throws Exception { return JsonSupport.MAPPER.readTree(Files.readAllBytes(path)); }
    static JsonNode sorted(JsonNode value) {
        if (value.isObject()) {
            ObjectNode node=JsonSupport.MAPPER.createObjectNode();
            TreeMap<String,JsonNode> fields=new TreeMap<>();
            value.fields().forEachRemaining(e->fields.put(e.getKey(),e.getValue()));
            fields.forEach((key,item)->node.set(key,sorted(item)));return node;
        }
        if (value.isArray()) {
            var node=JsonSupport.MAPPER.createArrayNode();value.forEach(item->node.add(sorted(item)));return node;
        }
        return value.deepCopy();
    }
    static byte[] canonical(JsonNode value) {
        try { return JsonSupport.MAPPER.writeValueAsBytes(sorted(value)); }
        catch(Exception e){throw new IllegalStateException(e);}
    }
    static String digest(byte[] bytes) {
        try { return "sha256:"+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch(Exception e){throw new IllegalStateException(e);}
    }
    static void write(Path path,Object value) throws Exception {
        Files.createDirectories(path.toAbsolutePath().getParent());
        Files.write(path,JsonSupport.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsBytes(value));
    }
    static void require(boolean condition,String reason) { if(!condition)throw new IllegalStateException(reason); }
}
