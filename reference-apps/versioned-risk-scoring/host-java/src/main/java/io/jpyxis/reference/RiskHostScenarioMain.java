package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.function.Predicate;

/** Serial end-to-end scenario through the same HTTP surface, with actual child processes. */
public final class RiskHostScenarioMain {
    private final RiskHostServer app;
    private final HttpClient client=HttpClient.newHttpClient();
    private final List<JsonNode> steps=new ArrayList<>();
    private final Path root;
    private RiskHostScenarioMain(RiskHostServer app,Path root){this.app=app;this.root=root;}
    private JsonNode get(String route) throws Exception {
        var response=client.send(HttpRequest.newBuilder(URI.create(app.url()+route)).GET().build(),HttpResponse.BodyHandlers.ofString());
        ReferenceJson.require(response.statusCode()==200,"GET "+route+" rejected");
        return io.jpyxis.contract.JsonSupport.MAPPER.readTree(response.body());
    }
    private JsonNode action(String action,Object... fields) throws Exception {
        return submit(200,action,fields);
    }
    private JsonNode submit(int expectedStatus,String action,Object... fields) throws Exception {
        Map<String,Object> body=new LinkedHashMap<>();body.put("action",action);
        for(int i=0;i<fields.length;i+=2)body.put(fields[i].toString(),fields[i+1]);
        var response=client.send(HttpRequest.newBuilder(URI.create(app.url()+"/api/action")).header("X-Reference-Token",app.token)
                .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofByteArray(ReferenceJson.canonical(ReferenceJson.tree(body)))).build(),HttpResponse.BodyHandlers.ofString());
        JsonNode result=io.jpyxis.contract.JsonSupport.MAPPER.readTree(response.body());
        steps.add(ReferenceJson.tree(Map.of("operation",body,"httpStatus",response.statusCode(),"response",result)));
        ReferenceJson.write(root.resolve("http-scenario.json"),steps);
        ReferenceJson.require(response.statusCode()==expectedStatus,"Unexpected HTTP action status: "+result);return result;
    }
    private JsonNode waitState(Predicate<JsonNode> predicate) throws Exception {
        long until=System.nanoTime()+Duration.ofSeconds(12).toNanos();
        do {JsonNode state=get("/api/state");if(predicate.test(state))return state;Thread.sleep(25);}while(System.nanoTime()<until);
        throw new IllegalStateException("real HTTP state did not reach expected condition: "+get("/api/state"));
    }
    private JsonNode request(String id) throws Exception {
        JsonNode state=waitState(s->{for(JsonNode r:s.path("requests"))if(r.path("id").asText().equals(id))return !r.path("executionState").asText().equals("IN_FLIGHT");return false;});
        for(JsonNode r:state.path("requests"))if(r.path("id").asText().equals(id))return r;
        throw new IllegalStateException("request missing");
    }
    private void idle() throws Exception {
        JsonNode state=waitState(s->s.path("operation").asText().equals("IDLE"));
        ReferenceJson.require(state.path("operationError").asText().isEmpty(),"retained lifecycle failure: "+state.path("operationError"));
    }
    private void run() throws Exception {
        JsonNode before=action("invoke","sample","STANDARD");
        ReferenceJson.require(before.path("executionState").asText().equals("FAILED_BEFORE_EXECUTION")&&before.path("decision").asText().equals("WITHHELD"),"invoke before activate must not bootstrap");
        ReferenceJson.require(get("/api/state").path("deployments").isEmpty(),"invoke implicitly deployed");
        action("install","version","v1");idle();
        ReferenceJson.require(get("/api/state").path("activeVersion").asText().isEmpty(),"install implicitly activated");
        action("activate","version","v1");
        for(String sample:List.of("LOW","HIGH")) {
            JsonNode r=request(action("invoke","sample",sample).path("id").asText());
            ReferenceJson.require(r.path("decision").asText().equals(sample.equals("LOW")?"ALLOW":"REJECT"),"Java policy branch");
        }
        String a=action("invoke","sample","STANDARD","mode","hold").path("id").asText();
        waitState(s->{for(JsonNode r:s.path("requests"))if(r.path("id").asText().equals(a))return r.path("runtimeEntered").asBoolean();return false;});
        action("install","version","v2");idle();
        JsonNode standby=get("/api/state");ReferenceJson.write(root.resolve("standby-state.json"),standby);
        ReferenceJson.require(!standby.path("canRollback").asBoolean()&&standby.path("rollbackVersion").asText().isEmpty(),"standby is not a previously active rollback target");
        submit(409,"rollback");ReferenceJson.require(get("/api/state").path("deployments").size()==2,"rejected rollback implicitly constructed a worker");
        action("activate","version","v2");
        JsonNode afterCutover=get("/api/state");ReferenceJson.write(root.resolve("cutover-state.json"),afterCutover);
        String b=action("invoke","sample","STANDARD").path("id").asText();
        JsonNode second=request(b);ReferenceJson.require(second.path("version").asText().equals("v2")&&second.path("decision").asText().equals("REJECT"),"B must use v2");
        action("release","requestId",a);JsonNode first=request(a);
        ReferenceJson.require(first.path("version").asText().equals("v1")&&first.path("decision").asText().equals("REVIEW"),"A must finish on old v1 pin");
        JsonNode unknown=request(action("invoke","sample","STANDARD","mode","crash").path("id").asText());
        ReferenceJson.require(unknown.path("executionState").asText().equals("OUTCOME_UNKNOWN")&&unknown.path("decision").asText().equals("WITHHELD")&&unknown.path("score").isNull(),"post-dispatch crash cannot become a business decision");
        ReferenceJson.write(root.resolve("unknown-state.json"),get("/api/state"));
        action("rollback");idle();
        JsonNode rolled=get("/api/state");ReferenceJson.write(root.resolve("rollback-state.json"),rolled);
        ReferenceJson.require(rolled.path("activeVersion").asText().equals("v1"),"fresh rollback route");
        var deployments=rolled.path("deployments");
        ReferenceJson.require(!deployments.get(0).path("realization").path("launchNonce").equals(deployments.get(2).path("realization").path("launchNonce")),"rollback reused launch/handle");
        JsonNode finalRequest=request(action("invoke","sample","STANDARD").path("id").asText());
        ReferenceJson.require(finalRequest.path("decision").asText().equals("REVIEW"),"rollback actual scoring");
        action("close");JsonNode receipt=get("/api/receipt");
        ReferenceJson.require(receipt.path("allOwnedWorkersStopped").asBoolean(),"workers remain alive");
        ReferenceJson.write(root.resolve("scenario-export.json"),receipt);
        System.out.println("Actual HTTP risk journey complete: before-dispatch, policy branches, pinned cutover, real crash/UNKNOWN, fresh rollback, receipt and shutdown.");
    }
    public static void main(String[] args) throws Exception {
        JsonNode config=ReferenceJson.read(Path.of(args[0]));Path root=Path.of(config.path("evidenceRoot").asText());
        try(var app=new RiskHostServer(config,root,0)){new RiskHostScenarioMain(app,root).run();}
    }
}
