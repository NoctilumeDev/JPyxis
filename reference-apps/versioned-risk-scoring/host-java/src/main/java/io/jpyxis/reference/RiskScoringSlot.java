package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.lifecycle.api.*;
import io.jpyxis.lifecycle.port.*;
import io.jpyxis.resilience.api.LogicalInvocationState;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** Private business host. The reused owners retain every execution/lifecycle decision. */
final class RiskScoringSlot implements AutoCloseable {
    record RiskFeatures(String sample, double normalizedExposure, double activity, double velocity, double concentration) {
        static RiskFeatures synthetic(String sample) {
            return switch(sample) {
                case "LOW" -> new RiskFeatures(sample, 0.10, 0.12, 0.07, 0.11);
                case "STANDARD" -> new RiskFeatures(sample, 0.90, 0.35, 0.20, 0.45);
                case "HIGH" -> new RiskFeatures(sample, 0.99, 0.85, 0.76, 0.94);
                default -> throw new IllegalArgumentException("unknown synthetic sample");
            };
        }
    }
    record Definition(String version, String identity, byte[] bytes, float scale, float bias) {}
    record Installed(Definition definition, ReferenceControl.Candidate candidate, String purpose) {}
    static final JsonNode POLICY=ReferenceJson.tree(Map.of("identity","jpyxis.reference/risk-policy@1.0.0",
            "allowBelow",0.55,"reviewBelow",0.80,"nonSuccess","WITHHELD"));
    static final String POLICY_DIGEST=ReferenceJson.digest(ReferenceJson.canonical(POLICY));
    private final JsonNode config;
    final ReferenceControl control;
    private final EnvironmentSpec environment;
    private final Map<String,Definition> definitions=new LinkedHashMap<>();
    private final Map<String,Installed> latest=new ConcurrentHashMap<>();
    private final List<Installed> installed=new CopyOnWriteArrayList<>();
    private final Map<String,Request> requests=new ConcurrentHashMap<>();
    private final List<JsonNode> ceremonies=new CopyOnWriteArrayList<>();
    private final ExecutorService invocations=Executors.newFixedThreadPool(2);
    private final ExecutorService lifecycle=Executors.newSingleThreadExecutor();
    private final LifecycleContext context=new LifecycleContext("risk-reference-host","explicit host operation",UUID.randomUUID().toString());
    private final Path root;
    private volatile String operation="IDLE",lastOperationError="";
    private volatile boolean closed,closing;
    private int sequence;
    private JsonNode sealed;
    private volatile Installed priorActive;

    RiskScoringSlot(JsonNode config,Path root) throws Exception {
        this.config=config.deepCopy();this.root=root;
        control=new ReferenceControl(config,root);environment=new EnvironmentSpec(config.path("environment"));
        for(String version:List.of("v1","v2")) {
            JsonNode value=config.path("definitions").path(version);
            byte[] bytes=Base64.getDecoder().decode(value.path("bytes").asText());
            String marker=Arrays.stream(new String(bytes,java.nio.charset.StandardCharsets.UTF_8).split("\\R"))
                    .filter(line->line.startsWith("# RISK_CALIBRATION ")).findFirst().orElseThrow();
            JsonNode calibration=JsonSupport.MAPPER.readTree(marker.substring("# RISK_CALIBRATION ".length()));
            ReferenceJson.require(calibration.size()==2&&calibration.path("scale").isNumber()&&calibration.path("bias").isNumber(),"bounded calibration envelope");
            float scale=(float)calibration.path("scale").asDouble(),bias=(float)calibration.path("bias").asDouble();
            ReferenceJson.require(Float.isFinite(scale)&&Float.isFinite(bias)&&scale>0&&bias>=0&&scale+bias<=1,"finite bounded score calibration");
            definitions.put(version,new Definition(version,value.path("identity").asText(),bytes,scale,bias));
        }
        ReferenceJson.write(root.resolve("risk-host-entry.json"),Map.of("schemaVersion","jpyxis.io/risk-host-entry/v1alpha1",
                "executionBuild",config.path("executionBuild"),"policy",POLICY,"policyDigest",POLICY_DIGEST,
                "definitions",definitions.values().stream().map(d->Map.of("version",d.version(),"identity",d.identity(),"digest",ReferenceJson.digest(d.bytes()),"scale",d.scale(),"bias",d.bias())).toList()));
    }
    private synchronized void ceremony(String phase,Installed target) {
        JsonNode event=ReferenceJson.tree(Map.of("phase",phase,"observedAt",Instant.now().toString(),
                "version",target==null?"":target.definition().version(),"deploymentId",target==null?"":target.candidate().deploymentId));
        ceremonies.add(event);control.source.record("JAVA_HOST","HOST_CEREMONY",event);
    }
    synchronized void install(String version) {
        ready();if(latest.containsKey(version))throw new IllegalStateException("artifact already installed; rollback constructs a fresh realization");
        Definition d=Objects.requireNonNull(definitions.get(version),"unknown version");
        operation="CONSTRUCTING "+version;lastOperationError="";
        lifecycle.submit(()->{
            try {
                ceremony("CONSTRUCT_FRESH_WORKER",null);
                var candidate=control.construct(d.identity(),d.bytes(),environment,"normal");
                Installed item=new Installed(d,candidate,"INSTALL");installed.add(item);
                control.requireQualified(candidate);ceremony("REPRESENTATIVE_WARM_AND_CONTROL_QUALIFICATION",item);
                synchronized(control.lock) {
                    control.deployments.request(candidate.deploymentId,ReferenceControl.SLOT,candidate.artifact,runtime(candidate),context);
                    candidate.admitted=true;
                    control.deployments.load(candidate.deploymentId,context);control.deployments.warm(candidate.deploymentId,context);
                    control.source.record("JAVA_HOST","DEPLOYMENT_STANDBY",Map.of("deploymentId",candidate.deploymentId,"realization",candidate.realization));
                }
                latest.put(version,item);ceremony("ELIGIBLE_FOR_ACTIVATION",item);
            } catch(Exception error) {lastOperationError=error.toString();}
            finally {operation="IDLE";}
        });
    }
    synchronized void activate(String version) {
        ready();Installed item=Objects.requireNonNull(latest.get(version),"version is not installed");
        synchronized(control.lock) {
            String previousId=control.deployments.activeBindings().get(ReferenceControl.SLOT);
            Installed previous=installed.stream().filter(i->i.candidate().deploymentId.equals(previousId)).findFirst().orElse(null);
            control.requireQualified(item.candidate());
            if(control.deployments.snapshot(item.candidate().deploymentId).state()!=DeploymentState.STANDBY)throw new IllegalStateException("activation requires STANDBY");
            control.deployments.activate(item.candidate().deploymentId,context);
            priorActive=previous;
            control.source.record("JAVA_HOST","DEPLOYMENT_ACTIVATED",Map.of("deploymentId",item.candidate().deploymentId,"binding",control.deployments.activeBindings()));
            ceremony("ACTIVE_BINDING_ESTABLISHED",item);
        }
    }
    private DeploymentRuntime runtime(ReferenceControl.Candidate r) {
        return new DeploymentRuntime() {
            public RuntimeHandle load(ArtifactPayload payload) {
                ReferenceJson.require(payload.coordinate().equals(r.artifact)&&Arrays.equals(payload.content(),r.definition)&&payload.contractIdentity().equals(r.contract.identity()),"immutable application payload association");
                return r.runtimeHandle;
            }
            public void warm(RuntimeHandle handle) {ReferenceJson.require(handle==r.runtimeHandle&&r.launch.process.isAlive(),"canonical warm ownership");}
            public void unload(RuntimeHandle handle) throws LifecycleCapabilityException {
                ReferenceJson.require(handle==r.runtimeHandle,"canonical release ownership");
                try {if(!r.workers.stopOwned(r.launch,false))throw new LifecycleCapabilityException("PHYSICAL_RELEASE_UNKNOWN","owned worker is alive");}
                catch(LifecycleCapabilityException e){throw e;}catch(Exception e){throw new LifecycleCapabilityException("PHYSICAL_RELEASE_UNKNOWN",e.toString());}
            }
        };
    }
    synchronized void rollback() {
        ready();String active=control.deployments.activeBindings().get(ReferenceControl.SLOT);
        Installed current=installed.stream().filter(i->i.candidate().deploymentId.equals(active)).findFirst().orElseThrow();
        Installed prior=priorActive;
        if(prior==null)throw new IllegalStateException("no prior active artifact; a standby artifact is not a rollback target");
        Definition d=prior.definition();operation="FRESH ROLLBACK "+d.version();lastOperationError="";
        lifecycle.submit(()->{
            try {
                ceremony("SELECT_PRIOR_IMMUTABLE_ARTIFACT",prior);
                var candidate=control.construct(d.identity(),d.bytes(),environment,"normal");
                Installed fresh=new Installed(d,candidate,"FRESH_ROLLBACK");installed.add(fresh);
                control.requireQualified(candidate);ceremony("CONSTRUCT_FRESH_WORKER_AND_REPRESENTATIVE_WARM",fresh);
                ceremony("CONTROL_QUALIFICATION_GRANTED",fresh);control.rollback(candidate);
                latest.put(d.version(),fresh);priorActive=current;ceremony("FRESH_ROLLBACK_ACTIVATED",fresh);
            } catch(Exception error) {lastOperationError=error.toString();}
            finally {operation="IDLE";}
        });
    }
    private void ready() {
        if(closed||closing)throw new IllegalStateException("host is closed");
        if(!operation.equals("IDLE"))throw new IllegalStateException("explicit lifecycle operation already running");
    }
    private final class Request {
        final String id,mode,acceptedAt=Instant.now().toString();
        final RiskFeatures features;
        final Installed target;
        final ReferenceControl.Prepared prepared;
        volatile JsonNode terminal;
        Request(String id,String mode,RiskFeatures features,Installed target,ReferenceControl.Prepared prepared) {
            this.id=id;this.mode=mode;this.features=features;this.target=target;this.prepared=prepared;
        }
        JsonNode view() {
            if(terminal!=null)return terminal;
            ObjectNode result=base();result.put("executionState","IN_FLIGHT");result.put("decision","WITHHELD");result.putNull("score");
            boolean entered=Files.exists(target.candidate().launch.root.resolve("runtime-entered.json"));
            result.put("runtimeEntered",entered);result.put("canRelease",mode.equals("hold")&&entered);
            result.put("observation",entered?(mode.equals("hold")?"ACTUAL M3 WITNESS BARRIER · 15 SECOND LIMIT":"ACTUAL RUNTIME ENTERED"):"CONTROL PREPARED · AWAITING RUNTIME OBSERVATION");
            return result;
        }
        ObjectNode base() {
            ObjectNode result=JsonSupport.MAPPER.createObjectNode();result.put("id",id);result.put("mode",mode);result.put("acceptedAt",acceptedAt);
            result.set("features",ReferenceJson.tree(features));result.put("version",target==null?"":target.definition().version());
            result.set("executionBinding",target==null?JsonSupport.MAPPER.createObjectNode():ReferenceJson.tree(Map.of(
                    "definition",target.candidate().operands,"realization",target.candidate().realization,
                    "qualificationId",target.candidate().qualificationId,"pin",prepared.pin,"plan",prepared.plan)));
            result.set("javaPolicy",POLICY.deepCopy());result.put("policyDigest",POLICY_DIGEST);return result;
        }
    }
    synchronized JsonNode invoke(String sample,String mode) {
        if(closed||closing)throw new IllegalStateException("closed host cannot invoke");
        if(!List.of("normal","hold","crash").contains(mode))throw new IllegalArgumentException("unsupported explicit diagnostic");
        RiskFeatures features=RiskFeatures.synthetic(sample);Request request;
        synchronized(control.lock) {
            String active=control.deployments.activeBindings().get(ReferenceControl.SLOT);
            Installed item=installed.stream().filter(i->i.candidate().deploymentId.equals(active)).findFirst().orElse(null);
            String id=String.format("R%03d",++sequence);
            if(item==null||!item.candidate().launch.process.isAlive()) {
                request=new Request(id,mode,features,null,null);ObjectNode failed=request.base();
                failed.put("executionState","FAILED_BEFORE_EXECUTION");failed.put("decision","WITHHELD");failed.putNull("score");
                failed.put("wireCalled",false);failed.put("reason","No eligible active realization; invoke performs no installation or retry");
                request.terminal=retain(request,failed);requests.put(id,request);return request.view();
            }
            if(requests.values().stream().anyMatch(r->r.target==item&&r.terminal==null))throw new IllegalStateException("one pending request per realization; no shared diagnostic gate");
            try {
                Path launch=item.candidate().launch.root;
                Files.deleteIfExists(launch.resolve("runtime-entered.json"));Files.deleteIfExists(launch.resolve("release-execution"));
                ReferenceJson.write(launch.resolve("execution-control.json"),Map.of("mode",mode.equals("hold")?"wait":mode));
            } catch(Exception e) {throw new IllegalStateException("cannot retain explicit diagnostic mode",e);}
            JsonNode input=ReferenceJson.tree(Map.of("values",Map.of("dtype","float32","shape",List.of(1,4),"layout","ROW_MAJOR",
                    "values",List.of(features.normalizedExposure(),features.activity(),features.velocity(),features.concentration())),"scale",item.definition().scale(),"bias",item.definition().bias()));
            var prepared=control.prepare(input);
            ReferenceJson.require(prepared.candidate==item.candidate(),"atomic active route and calibration selection");
            request=new Request(id,mode,features,item,prepared);requests.put(id,request);
            control.source.record("JAVA_HOST","RISK_REQUEST_PREPARED",Map.of("requestId",id,"features",features,"pin",prepared.pin,"input",input));
        }
        invocations.submit(()->execute(request));return request.view();
    }
    private void execute(Request request) {
        var p=request.prepared;ObjectNode terminal=request.base();
        try {
            var outcome=control.invoke(p,InvocationOptions.withTimeout(Duration.ofSeconds(20)));
            String state=outcome.state()==LogicalInvocationState.FAILED&&!p.wireCalled?"FAILED_BEFORE_EXECUTION":outcome.state().name();
            terminal.put("executionState",state);terminal.set("logicalOutcome",ReferenceJson.tree(outcome));
            terminal.put("wireCalled",p.wireCalled);terminal.set("dispatchAssociation",ReferenceJson.tree(p.association));
            terminal.set("observedExecution",ReferenceJson.tree(p.m2));
            if(outcome.state()==LogicalInvocationState.SUCCEEDED) {
                JsonNode values=p.m2.rawWorkerReport().path("output").path("values").path("values");
                float score=(float)values.get(0).asDouble();
                ReferenceJson.require(Float.isFinite(score)&&score>=0&&score<=1,"bounded RiskScore");
                terminal.put("score",score);terminal.put("signal",(float)values.get(1).asDouble());
                var signals=JsonSupport.MAPPER.createArrayNode();
                for(int index=1;index<values.size();index++)signals.add(values.get(index));
                terminal.set("signals",signals);
                terminal.put("decision",score<0.55f?"ALLOW":score<0.80f?"REVIEW":"REJECT");
            } else {terminal.putNull("score");terminal.put("decision","WITHHELD");}
            if(request.mode.equals("crash")&&p.wireCalled&&p.candidate.launch.process.waitFor(5,TimeUnit.SECONDS)) {
                control.source.record("HOST_PROCESS_OBSERVER","RISK_CRASH_EXIT_OBSERVED",Map.of("requestId",request.id,
                        "ownedProcess",p.candidate.workers.observation(p.candidate.launch),"exitCode",p.candidate.launch.process.exitValue()));
            }
            if(!p.wireCalled||p.completionKnown) {
                control.release(p);
                if(control.deployments.snapshot(p.candidate.deploymentId).state()==DeploymentState.DRAINING
                        &&control.deployments.snapshot(p.candidate.deploymentId).outstandingPins()==0)control.retire(p.candidate);
            }
        } catch(Exception error) {
            terminal.put("executionState",p.wireCalled?"OUTCOME_UNKNOWN":"FAILED_BEFORE_EXECUTION");
            terminal.putNull("score");terminal.put("decision","WITHHELD");terminal.put("reason",error.toString());terminal.put("wireCalled",p.wireCalled);
        }
        terminal.put("completedAt",Instant.now().toString());
        request.terminal=retain(request,terminal);
    }
    private JsonNode retain(Request r,JsonNode terminal) {
        try {
            Files.createDirectories(root.resolve("risk-requests"));
            Files.write(root.resolve("risk-requests").resolve(r.id+".json"),ReferenceJson.canonical(terminal),StandardOpenOption.CREATE_NEW);
            control.source.record("JAVA_HOST_POLICY","RISK_DECISION_RETAINED",terminal);
            return terminal;
        } catch(Exception e) {
            ObjectNode rejected=(ObjectNode)terminal.deepCopy();rejected.put("decision","WITHHELD");rejected.putNull("score");
            rejected.put("decisionRecordHealthy",false);rejected.put("reason","Required business receipt failed: "+e);
            lastOperationError="Required business receipt failed: "+e;return rejected;
        }
    }
    synchronized void release(String id) throws Exception {
        Request r=Objects.requireNonNull(requests.get(id),"unknown request");
        if(r.terminal!=null||!r.mode.equals("hold"))throw new IllegalStateException("no held request to release");
        Files.writeString(r.target.candidate().launch.root.resolve("release-execution"),"explicit host release of diagnostic witness\n",StandardOpenOption.CREATE_NEW);
        ceremony("RELEASE_HELD_REQUEST",r.target);
    }
    JsonNode state() {
        ObjectNode state=JsonSupport.MAPPER.createObjectNode();state.put("closed",closed);state.put("closing",closing);state.put("operation",operation);
        state.put("operationError",lastOperationError);state.put("controlStatus",closed?"CLOSED":closing?"CLOSING":"CONTROL READY");
        String active=control.deployments.activeBindings().get(ReferenceControl.SLOT);state.put("activeDeploymentId",active==null?"":active);
        Installed activeItem=installed.stream().filter(i->i.candidate().deploymentId.equals(active)).findFirst().orElse(null);
        state.put("activeVersion",activeItem==null?"":activeItem.definition().version());
        state.put("activeEligible",!closed&&activeItem!=null&&eligible(activeItem));
        state.put("eligibleWorkers",installed.stream().filter(this::eligible).count());
        state.put("observedLiveWorkers",installed.stream().filter(i->i.candidate().launch!=null&&i.candidate().launch.process.isAlive()).count());state.put("totalRealizations",installed.size());
        state.set("source",config.path("executionBuild").deepCopy());
        state.set("definitions",ReferenceJson.tree(definitions.values().stream().map(d->Map.of("version",d.version(),"identity",d.identity(),"digest",ReferenceJson.digest(d.bytes()),"installed",latest.containsKey(d.version()))).toList()));
        state.set("deployments",ReferenceJson.tree(installed.stream().map(i->{
            var c=i.candidate();ObjectNode view=JsonSupport.MAPPER.createObjectNode();view.put("version",i.definition().version());view.put("deploymentId",c.deploymentId);
            view.put("qualified",c.qualified);view.put("alive",c.launch!=null&&c.launch.process.isAlive());view.put("purpose",i.purpose());view.set("realization",ReferenceJson.tree(c.realization));
            if(c.admitted){var snapshot=control.deployments.snapshot(c.deploymentId);view.put("state",snapshot.state().name());view.put("outstandingPins",snapshot.outstandingPins());}
            else {view.put("state",c.qualified?"QUALIFIED":"REJECTED");view.put("outstandingPins",0);}return view;
        }).map(view->{
            var history=control.lifecycleJournal.events().stream().filter(e->view.path("deploymentId").asText().equals(e.deploymentId())&&e.newState()!=null)
                    .map(e->Map.of("sequence",e.sequence(),"event",e.event(),"state",e.newState())).toList();
            view.set("history",ReferenceJson.tree(history));return view;
        }).toList()));
        state.set("requests",ReferenceJson.tree(requests.values().stream().sorted(Comparator.comparing(r->r.id)).map(Request::view).toList()));
        state.set("ceremonies",ReferenceJson.tree(ceremonies));state.put("rollbackVersion",priorActive==null?"":priorActive.definition().version());
        state.put("canRollback",!closed&&!closing&&operation.equals("IDLE")&&activeItem!=null&&priorActive!=null);
        state.put("canClose",!closed&&!closing&&operation.equals("IDLE")&&requests.values().stream().noneMatch(r->r.terminal==null));
        state.put("allOwnedWorkersStopped",closed&&installed.stream().noneMatch(i->i.candidate().launch!=null&&i.candidate().launch.process.isAlive()));return state;
    }
    private boolean eligible(Installed item) {
        var c=item.candidate();return c.qualified&&c.launch!=null&&c.launch.process.isAlive()
                &&c.qualifiedWorker.equals(c.supervisor.snapshot(c.workerId))&&c.supervisor.snapshot(c.workerId).eligible();
    }
    synchronized JsonNode receipt() {
        if(!closed||sealed==null)throw new IllegalStateException("Close owned workers before sealing the receipt");return sealed.deepCopy();
    }
    @Override public synchronized void close() throws Exception {
        if(closed)return;
        if(!operation.equals("IDLE")||requests.values().stream().anyMatch(r->r.terminal==null))throw new IllegalStateException("finish or release pending work before close");
        closing=true;
        try {
            invocations.shutdown();if(!invocations.awaitTermination(3,TimeUnit.SECONDS))throw new IllegalStateException("invocation records still pending");
            control.close();lifecycle.shutdown();
            JsonNode finalState=ReferenceJson.read(root.resolve("final-state.json"));
            ReferenceJson.require(finalState.path("processes").findValues("alive").stream().noneMatch(JsonNode::asBoolean),"owned process remains alive");
            sealed=ReferenceJson.tree(Map.of("schemaVersion","jpyxis.io/risk-host-receipt/v1alpha1","source",config.path("executionBuild"),
                    "scope","trusted local CPU stateless typed affine risk reference host","requests",requests.values().stream().sorted(Comparator.comparing(r->r.id)).map(r->r.terminal).toList(),
                    "policy",POLICY,"policyDigest",POLICY_DIGEST,"ceremonies",ceremonies,"physicalShutdown",finalState,"allOwnedWorkersStopped",true));
            Files.write(root.resolve("receipt.json"),ReferenceJson.canonical(sealed),StandardOpenOption.CREATE_NEW);closed=true;
        } finally {closing=false;}
    }
    void emergencyContainment() {
        for(var candidate:control.candidates)try {candidate.workers.close();}catch(Exception ignored) {}
        invocations.shutdownNow();lifecycle.shutdownNow();
    }
}
