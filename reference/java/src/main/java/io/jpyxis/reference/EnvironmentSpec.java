package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class EnvironmentSpec {
    private final JsonNode specification;
    private final String digest;
    EnvironmentSpec(JsonNode input) {
        var fields=new HashSet<String>();input.fieldNames().forEachRemaining(fields::add);
        ReferenceJson.require(input.isObject()&&fields.equals(Set.of("schemaVersion","pythonImplementation",
                "pythonMajorMinor","platform","architecture","requirementsClosureDigest","runtimePackages")),"Environment fields");
        for(String key:fields)if(!key.equals("runtimePackages"))
            ReferenceJson.require(input.get(key).isTextual()&&!input.get(key).asText().isBlank(),"Environment scalar: "+key);
        ReferenceJson.require(input.path("schemaVersion").asText().equals("jpyxis.io/reference-environment/v1alpha1"),"Environment schema");
        ReferenceJson.require(input.path("pythonImplementation").asText().equals("CPython")&&input.path("pythonMajorMinor").asText().equals("3.12"),"Interpreter profile");
        String platform=input.path("platform").asText(),architecture=input.path("architecture").asText();
        ReferenceJson.require((platform.equals("win32")&&architecture.equals("AMD64"))||
                (platform.equals("linux")&&architecture.equals("x86_64")),"Selected first host profile");
        ReferenceJson.require(input.path("requirementsClosureDigest").asText().matches("sha256:[0-9a-f]{64}"),"Requirements closure digest");
        ReferenceJson.require(input.path("runtimePackages").equals(ReferenceJson.tree(Map.of("numpy","2.2.6","grpcio","1.83.1","protobuf","7.35.1"))),"Runtime package profile");
        specification=ReferenceJson.sorted(input);digest=ReferenceJson.digest(ReferenceJson.canonical(specification));
    }
    JsonNode value(){return specification.deepCopy();}
    String digest(){return digest;}
    boolean matches(JsonNode observed){return specification.equals(observed);}
}
