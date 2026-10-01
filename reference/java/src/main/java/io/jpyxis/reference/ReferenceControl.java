package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.grpc.*;
import io.jpyxis.contract.ContractParser;
import io.jpyxis.contract.ContractModel.AlgorithmContract;
import io.jpyxis.contract.JsonSupport;
import io.jpyxis.contract.ValueValidator;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.invocation.*;
import io.jpyxis.invocation.transport.*;
import io.jpyxis.invocation.transport.grpc.GrpcInvocationTransport;
import io.jpyxis.lifecycle.api.*;
import io.jpyxis.lifecycle.core.*;
import io.jpyxis.lifecycle.evidence.InMemoryLifecycleJournal;
import io.jpyxis.lifecycle.port.*;
import io.jpyxis.resilience.api.*;
import io.jpyxis.resilience.core.*;
import io.jpyxis.resilience.evidence.DurableResilienceJournal;
import io.jpyxis.resilience.port.TelemetrySink;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/** One concrete reference assembly; existing module owners retain their state authority. */
final class ReferenceControl implements AutoCloseable {
    static final String SLOT="affine-reference";
    static final RuntimeBinding BINDING=new RuntimeBinding("numpy.cpu","2.2.6","jpyxis.capability/affine-float32","1");
    static final class Candidate {
        final String deploymentId=UUID.randomUUID().toString(),workerId="worker-"+deploymentId;
        final String qualificationId=UUID.randomUUID().toString();
        final String identity;
        final byte[] definition,contractBytes;
        final AlgorithmContract contract;
        final EnvironmentSpec environment;
        final JsonNode operands;
        final ArtifactCoordinate artifact;
        final Path root;
        final OwnedPythonWorkers workers;
        final DurableResilienceJournal resilienceJournal;
        final WorkerSupervisor supervisor;
        final ResilientInvocationManager invocations;
        OwnedPythonWorkers.Launch launch;
        WorkerSnapshot qualifiedWorker;
        RuntimeHandle runtimeHandle;
        JsonNode realization;
        boolean qualified,admitted;
        Candidate(JsonNode config,String identity,byte[] definition,EnvironmentSpec environment,String fault,
                  ArtifactCoordinate artifact,Path root,SourceJournal source,String epoch) throws Exception {
            this.identity=identity;this.definition=definition.clone();this.environment=environment;this.artifact=artifact;this.root=root;
            contractBytes=Base64.getDecoder().decode(config.path("contractBytes").asText());
            contract=new ContractParser().parse(JsonSupport.MAPPER.readTree(contractBytes));
            operands=ReferenceJson.tree(Map.of("artifact",artifact,"definitionIdentity",identity,"definitionDigest",ReferenceJson.digest(this.definition),
                    "contractIdentity",contract.identity(),"contractDigest",contract.digest(),"contractBytesDigest",ReferenceJson.digest(contractBytes),
                    "environment",environment.value(),"environmentDigest",environment.digest(),
                    "runtimeRequirement",Map.of("capabilityIdentity",BINDING.capabilityIdentity(),"capabilityVersion",BINDING.capabilityVersion(),
                            "operationIdentity","jpyxis.operation/affine-batch@1","dtype","float32","layout","ROW_MAJOR"),
                    "executionBuild",config.path("executionBuild")));
            ObjectNode descriptor=JsonSupport.MAPPER.createObjectNode();descriptor.put("deploymentId",deploymentId);
            descriptor.put("definitionIdentity",identity);descriptor.put("definitionBytes",Base64.getEncoder().encodeToString(this.definition));
            descriptor.put("contractBytes",Base64.getEncoder().encodeToString(contractBytes));descriptor.put("operandsDigest",ReferenceJson.digest(ReferenceJson.canonical(operands)));
            descriptor.set("requirementsBytes",config.path("requirementsBytes").deepCopy());
            workers=new OwnedPythonWorkers(config,descriptor,root,fault,source);
            resilienceJournal=new DurableResilienceJournal(root.resolve("m5-journal.jsonl"),TelemetrySink.noOp());
            supervisor=new WorkerSupervisor(resilienceJournal,workers,epoch);
            invocations=new ResilientInvocationManager(resilienceJournal,supervisor,epoch);
        }
    }
    static final class Prepared {
        final Candidate candidate;
        final InvocationPin pin;
        final AttemptPlan plan;
        final InvocationRequest request;
        final JsonNode input;
        JsonNode association;
        boolean dispatchReserved,wireCalled,recordFailure,completionKnown;
        InvocationExecution m2;
        Prepared(Candidate candidate,InvocationPin pin,AttemptPlan plan,InvocationRequest request,JsonNode input){
            this.candidate=candidate;this.pin=pin;this.plan=plan;this.request=request;this.input=input.deepCopy();
        }
    }
    final Object lock=new Object();
    final SourceJournal source;
    final InMemoryLifecycleJournal lifecycleJournal=new InMemoryLifecycleJournal();
    final ArtifactRegistry artifacts=new ArtifactRegistry(lifecycleJournal);
    final DeploymentManager deployments=new DeploymentManager(artifacts,lifecycleJournal);
    final List<Candidate> candidates=new ArrayList<>();
    final Map<String,InvocationPin> outstandingPins=new HashMap<>();
    final JsonNode config;
    final Path root;
    final String epoch=UUID.randomUUID().toString();
    private final LifecycleContext lc=new LifecycleContext("reference-control","bounded reference journey",UUID.randomUUID().toString());
    private final ResilienceContext rc=new ResilienceContext("reference-control","bounded reference journey",lc.traceId());
    ReferenceControl(JsonNode config,Path root) throws Exception {
        this.config=config.deepCopy();this.root=root;Files.createDirectories(root);source=new SourceJournal(root.resolve("control-source.jsonl"));
    }
    Candidate construct(String identity,byte[] definition,EnvironmentSpec environment,String fault) throws Exception {
        synchronized(lock){
            var contract=new ContractParser().parse(JsonSupport.MAPPER.readTree(Base64.getDecoder().decode(config.path("contractBytes").asText())));
            var registered=artifacts.register(identity,contract.identity(),definition,lc);
            if(registered.state()==ArtifactState.REGISTERED)artifacts.beginValidation(identity,lc);
            Candidate r=new Candidate(config,identity,definition,environment,fault,registered.coordinate(),root.resolve("candidate-"+candidates.size()),source,epoch);
            candidates.add(r);source.record("COMPOSITION_CONTROL","CANDIDATE_EXPECTED_OPERANDS",Map.of("deploymentId",r.deploymentId,"operands",r.operands));
            try {
                r.supervisor.register(r.workerId,rc);r.supervisor.start(r.workerId,rc);r.supervisor.probe(r.workerId,rc);
                r.launch=r.workers.current();ReferenceJson.require(r.launch!=null,"actual launch missing");
                r.qualifiedWorker=r.supervisor.snapshot(r.workerId);
                ReferenceJson.require(r.qualifiedWorker.eligible(),"candidate health unavailable");
                for(JsonNode facts:List.of(r.launch.independentProbe.path("actual"),r.launch.facts.path("actual"))){
                    ReferenceJson.require(facts.path("contractIdentity").asText().equals(r.contract.identity())&&facts.path("contractDigest").asText().equals(r.contract.digest()),"exact computation contract");
                    ReferenceJson.require(facts.path("definitionIdentity").asText().equals(r.identity)&&facts.path("definitionDigest").asText().equals(r.artifact.digest()),"exact definition bytes");
                    ReferenceJson.require(facts.path("definitionPlan").equals(ReferenceJson.tree(Map.of("schemaVersion","jpyxis.io/affine-definition-plan/v1alpha1","operationIdentity","jpyxis.operation/affine-batch@1"))),"definition plan");
                    ReferenceJson.require(environment.matches(facts.path("environment")),"expected Environment differs from actual construction/worker");
                    ReferenceJson.require(facts.path("runtimeBinding").equals(ReferenceJson.tree(BINDING)),"resolved Runtime binding");
                }
                ReferenceJson.require(!r.launch.birth.isBlank()&&r.launch.process.isAlive(),"owned process birth/liveness missing");
                if(artifacts.snapshot(identity).state()==ArtifactState.VALIDATING)artifacts.acceptValidation(identity,"bound-independent-definition-and-contract",lc);
                r.runtimeHandle=new RuntimeHandle("jpyxis.reference.python-launch","v1",r.launch.nonce);
                r.realization=realization(r);
                JsonNode input=config.path("representativeInput");
                try(var recorder=HostObservationRecorder.open(r.root.resolve("qualification-m2.jsonl"));
                    var manager=InvocationManager.fromSnapshots(new BoundTransport(r,null,"QUALIFICATION"),r.contractBytes,r.definition,r.identity,recorder)){
                    var result=manager.invokeCanonical(input,InvocationOptions.withTimeout(Duration.ofSeconds(5)));
                    source.record("COMPOSITION_CONTROL","REPRESENTATIVE_RESULT_OBSERVED",Map.of("deploymentId",r.deploymentId,"m2",result));
                    ReferenceJson.require(result.state()==TerminalState.SUCCEEDED&&result.evidenceRecorderHealthy()&&oracle(input,result.rawWorkerReport().path("output")),"representative invocation independent oracle");
                }
                source.record("COMPOSITION_CONTROL","QUALIFICATION_DECIDED",Map.of("deploymentId",r.deploymentId,"qualificationId",r.qualificationId,"positive",true,"realization",r.realization));
                r.qualified=true;
            }catch(Exception failure){
                source.record("COMPOSITION_CONTROL","QUALIFICATION_DECIDED",Map.of("deploymentId",r.deploymentId,"qualificationId",r.qualificationId,"positive",false,"reason",failure.toString()));
                if(artifacts.snapshot(identity).state()==ArtifactState.VALIDATING)artifacts.rejectValidation(identity,"bound-source-validation-rejected",lc);
                r.workers.close();
            }
            return r;
        }
    }
    private JsonNode realization(Candidate r){
        return ReferenceJson.tree(Map.of("deploymentId",r.deploymentId,"workerId",r.workerId,"instanceId",r.qualifiedWorker.instanceId(),
                "controlEpoch",epoch,"processId",r.launch.process.pid(),"launchNonce",r.launch.nonce,
                "runtimeHandle",r.runtimeHandle,"runtimeBinding",BINDING,"environmentDigest",r.environment.digest(),
                "operandsDigest",ReferenceJson.digest(ReferenceJson.canonical(r.operands))));
    }
    void activate(Candidate r){synchronized(lock){
        requireQualified(r);deployments.request(r.deploymentId,SLOT,r.artifact,runtime(r,false),lc);
        deployments.load(r.deploymentId,lc);deployments.warm(r.deploymentId,lc);deployments.activate(r.deploymentId,lc);r.admitted=true;
        source.record("COMPOSITION_CONTROL","DEPLOYMENT_ACTIVATED",Map.of("deploymentId",r.deploymentId,"binding",deployments.activeBindings()));
    }}
    void rollback(Candidate r){synchronized(lock){
        requireQualified(r);var state=deployments.rollback(r.deploymentId,SLOT,r.artifact,runtime(r,false),lc);
        ReferenceJson.require(state.state()==DeploymentState.ACTIVE,"fresh rollback did not activate");r.admitted=true;
        source.record("COMPOSITION_CONTROL","FRESH_ROLLBACK_ACTIVATED",Map.of("deploymentId",r.deploymentId,"realization",r.realization));
    }}
    void requireQualified(Candidate r){
        if(!r.qualified||r.launch==null||!r.launch.process.isAlive()||!r.qualifiedWorker.equals(r.supervisor.snapshot(r.workerId))){
            source.record("COMPOSITION_CONTROL","ACTIVATION_REJECTED",Map.of("deploymentId",r.deploymentId,"binding",deployments.activeBindings()));
            throw new IllegalStateException("exact unchanged realization is not qualified");
        }
    }
    private DeploymentRuntime runtime(Candidate r,boolean falseCleanup){return new DeploymentRuntime(){
        public RuntimeHandle load(ArtifactPayload payload){
            ReferenceJson.require(payload.coordinate().equals(r.artifact)&&Arrays.equals(payload.content(),r.definition)&&payload.contractIdentity().equals(r.contract.identity()),"M4 immutable payload association");
            return r.runtimeHandle;
        }
        public void warm(RuntimeHandle handle){ReferenceJson.require(handle==r.runtimeHandle&&r.launch.process.isAlive(),"canonical warm ownership");}
        public void unload(RuntimeHandle handle) throws LifecycleCapabilityException {
            ReferenceJson.require(handle==r.runtimeHandle,"canonical release ownership");
            try {if(!r.workers.stopOwned(r.launch,falseCleanup))throw new LifecycleCapabilityException("PHYSICAL_RELEASE_UNKNOWN","owned worker still alive");}
            catch(LifecycleCapabilityException e){throw e;}catch(Exception e){throw new LifecycleCapabilityException("PHYSICAL_RELEASE_UNKNOWN",e.toString());}
        }
    };}
    Prepared prepare(JsonNode input){synchronized(lock){
        String logical=UUID.randomUUID().toString();InvocationPin pin=deployments.pinInvocation(SLOT,UUID.randomUUID().toString(),logical,lc);
        Candidate r=candidates.stream().filter(c->c.deploymentId.equals(pin.deploymentId())).findFirst().orElseThrow();
        InvocationRequest request=new InvocationRequest(logical,UUID.randomUUID().toString(),IdempotencyMode.NONE,"",1);
        r.invocations.accept(request,rc);AttemptPlan plan=r.invocations.prepareAttempt(logical,rc);
        outstandingPins.put(pin.pinId(),pin);Prepared p=new Prepared(r,pin,plan,request,input);
        source.record("COMPOSITION_CONTROL","PRODUCT_PREPARED",Map.of("pin",pin,"plan",plan,"request",request,"input",input));return p;
    }}
    InvocationSnapshot invoke(Prepared p,InvocationOptions options) throws Exception {
        return invoke(p,p.candidate,options);
    }
    InvocationSnapshot invoke(Prepared p,Candidate dispatchCandidate,InvocationOptions options) throws Exception {
        Candidate r=p.candidate;AttemptObservation observation;
        p.m2=null;
        try(var recorder=HostObservationRecorder.open(r.root.resolve("product-"+p.plan.attemptId()+"-"+UUID.randomUUID()+"-m2.jsonl"));
            var manager=InvocationManager.fromSnapshots(new BoundTransport(dispatchCandidate,p,"PRODUCT"),r.contractBytes,r.definition,r.identity,recorder)){
            p.m2=manager.invokeCanonical(p.input,options);
            p.completionKnown=p.m2.rawWorkerReport()!=null&&matchesReport(p,p.m2.rawWorkerReport());
            if(!p.wireCalled)observation=AttemptObservation.failedBeforeExecution(p.m2.state().name());
            else if(p.m2.state()==TerminalState.SUCCEEDED&&p.m2.evidenceRecorderHealthy()&&oracle(p.input,p.m2.rawWorkerReport().path("output")))
                observation=AttemptObservation.succeeded(ReferenceJson.digest(ReferenceJson.canonical(p.m2.rawWorkerReport().path("output"))));
            else if(p.completionKnown)observation=AttemptObservation.failedAfterExecution(p.m2.failure()==null?"REJECTED_RESULT":p.m2.failure().code());
            else observation=AttemptObservation.unknown(p.m2.state().name());
        }catch(RuntimeException failure){
            source.record("COMPOSITION_CONTROL","DISPATCH_REJECTED",Map.of("logicalInvocationId",p.plan.logicalInvocationId(),"reason",failure.toString(),"wireCalled",p.wireCalled));
            observation=p.wireCalled?AttemptObservation.unknown("DISPATCH_UNCERTAIN"):AttemptObservation.failedBeforeExecution("DISPATCH_REJECTED");
        }
        synchronized(lock){
            var snapshot=r.invocations.recordObservation(p.plan,observation,rc);
            ObjectNode details=JsonSupport.MAPPER.createObjectNode();details.set("plan",ReferenceJson.tree(p.plan));details.set("observation",ReferenceJson.tree(observation));
            details.set("snapshot",ReferenceJson.tree(snapshot));details.set("m2",ReferenceJson.tree(p.m2));details.put("wireCalled",p.wireCalled);
            source.record("COMPOSITION_CONTROL","LOGICAL_TERMINAL_OBSERVED",details);return snapshot;
        }
    }
    private final class BoundTransport implements InvocationTransport {
        final Candidate r;final Prepared p;final String purpose;final GrpcInvocationTransport probe;
        final List<GrpcInvocationTransport> calls=new ArrayList<>();
        BoundTransport(Candidate r,Prepared p,String purpose){this.r=r;this.p=p;this.purpose=purpose;probe=new GrpcInvocationTransport(r.launch.port);}
        public RuntimeCapabilityReport probe(Duration timeout) throws TransportException {
            var actual=probe.probe(timeout);if(!actual.binding().equals(BINDING))throw new TransportException(TransportException.Kind.UNAVAILABLE,new IllegalStateException("expected binding mismatch"));return actual;
        }
        public TransportCall invoke(InvocationAttempt attempt,Duration timeout){
            ObjectNode association;
            synchronized(lock){
                ReferenceJson.require(attempt.runtimeBinding().equals(BINDING)&&r.launch.process.isAlive(),"bound current launch/runtime");
                ReferenceJson.require(r.qualifiedWorker.equals(r.supervisor.snapshot(r.workerId)),"instance changed before dispatch");
                if(p!=null){
                    ReferenceJson.require(r.qualified&&outstandingPins.get(p.pin.pinId())==p.pin&&p.pin.deploymentId().equals(r.deploymentId)&&p.pin.artifact().equals(r.artifact)&&p.pin.runtimeHandle()==r.runtimeHandle,"actual M4 pin realization");
                    ReferenceJson.require(p.plan.worker().equals(r.qualifiedWorker)&&p.plan.logicalInvocationId().equals(p.pin.invocationId())&&p.plan.idempotencyMode()==IdempotencyMode.NONE&&p.plan.deduplicationScope().isEmpty(),"retained M5 plan association");
                    ReferenceJson.require(!p.dispatchReserved&&!p.recordFailure,"duplicate admission or required record unavailable");
                }
                association=JsonSupport.MAPPER.createObjectNode();association.put("schemaVersion","jpyxis.io/reference-dispatch/v1alpha1");association.put("purpose",purpose);
                association.set("realization",r.realization.deepCopy());association.set("operands",r.operands.deepCopy());association.put("qualificationId",r.qualificationId);
                association.set("m2",ReferenceJson.tree(attempt));
                if(p!=null){association.set("pin",ReferenceJson.tree(p.pin));association.set("plan",ReferenceJson.tree(p.plan));association.set("request",ReferenceJson.tree(p.request));}
                source.record("COMPOSITION_CONTROL",purpose+"_DISPATCH_ADMITTED",Map.of("association",association));
                if(p!=null){p.association=association.deepCopy();p.dispatchReserved=true;}
                var delegate=new GrpcInvocationTransport(r.launch.port,metadata(association));calls.add(delegate);
                if(p!=null)p.wireCalled=true;
                source.record("TRANSPORT_ADAPTER","WIRE_INVOKE_REQUESTED",Map.of("associationDigest",ReferenceJson.digest(ReferenceJson.canonical(association)),"capturedPort",r.launch.port,"launchNonce",r.launch.nonce));
                return delegate.invoke(attempt,timeout);
            }
        }
        public void close(){probe.close();calls.forEach(GrpcInvocationTransport::close);}
    }
    private static ClientInterceptor metadata(JsonNode association){
        String value=new String(ReferenceJson.canonical(association),java.nio.charset.StandardCharsets.UTF_8);
        String expected=ReferenceJson.digest(ReferenceJson.canonical(association));
        var key=Metadata.Key.of("jpyxis-reference-association",Metadata.ASCII_STRING_MARSHALLER);
        var resultKey=Metadata.Key.of("jpyxis-reference-association-digest",Metadata.ASCII_STRING_MARSHALLER);
        return new ClientInterceptor(){public <ReqT,RespT> ClientCall<ReqT,RespT> interceptCall(MethodDescriptor<ReqT,RespT> method,CallOptions options,Channel next){
            return new ForwardingClientCall.SimpleForwardingClientCall<>(next.newCall(method,options)){
                public void start(Listener<RespT> listener,Metadata headers){headers.put(key,value);
                    super.start(new ForwardingClientCallListener.SimpleForwardingClientCallListener<>(listener){
                        public void onClose(Status status,Metadata trailers){
                            if(status.isOk()&&!expected.equals(trailers.get(resultKey)))status=Status.DATA_LOSS.withDescription("unbound outer response");
                            super.onClose(status,trailers);
                        }
                    },headers);
                }
            };
        }};
    }
    void release(Prepared p){synchronized(lock){
        ReferenceJson.require(!p.wireCalled||p.completionKnown,"unresolved physical execution obligation needs completion or explicit forced termination");
        deployments.releasePin(p.pin.pinId(),lc);outstandingPins.remove(p.pin.pinId());
    }}
    void retire(Candidate r){synchronized(lock){
        if(deployments.snapshot(r.deploymentId).state()==DeploymentState.ACTIVE)deployments.drain(r.deploymentId,lc);
        ReferenceJson.require(deployments.awaitDrain(r.deploymentId,Duration.ofMillis(1),lc),"pins still owed");deployments.unload(r.deploymentId,lc);
    }}
    void changeInstance(Candidate r){synchronized(lock){
        r.supervisor.observeFailure(r.workerId,"REFERENCE_REPLACEMENT","REFERENCE_INSTANCE_REPLACEMENT",rc);r.supervisor.start(r.workerId,rc);r.supervisor.probe(r.workerId,rc);
        source.record("COMPOSITION_CONTROL","INSTANCE_CHANGED_UNQUALIFIED",Map.of("oldRealization",r.realization,"currentWorker",r.supervisor.snapshot(r.workerId),"inheritsQualification",false));
    }}
    InvocationSnapshot recordLate(Prepared p) throws Exception {
        OwnedPythonWorkers.awaitFile(p.candidate.launch.root.resolve("release-execution"),p.candidate.launch.process,Duration.ofSeconds(1));
        Path reportPath=p.candidate.launch.root.resolve("retained-report-"+p.association.path("m2").path("coordinates").path("attemptId").asText()+".json");
        OwnedPythonWorkers.awaitFile(reportPath,p.candidate.launch.process,Duration.ofSeconds(5));
        JsonNode retained=ReferenceJson.read(reportPath);
        ReferenceJson.require(retained.path("details").path("association").equals(p.association),"complete late association");
        ReferenceJson.require(retained.path("pid").asLong()==p.candidate.launch.process.pid(),"late report owned process");
        try(var decoder=new GrpcInvocationTransport(p.candidate.launch.port)){
            var report=decoder.decodeRetainedReport(Base64.getDecoder().decode(retained.path("details").path("wireReportBase64").asText()));
            var coordinates=report.coordinates();var expected=p.association.path("m2");
            ReferenceJson.require(ReferenceJson.tree(coordinates.runtimeBinding()).equals(expected.path("runtimeBinding"))&&coordinates.contractDigest().equals(expected.path("contractDigest").asText())&&coordinates.definitionDigest().equals(expected.path("definitionDigest").asText()),"late operand/runtime coordinates");
            ReferenceJson.require(coordinates.invocationId().equals(expected.path("coordinates").path("invocationId").asText())&&coordinates.attemptId().equals(expected.path("coordinates").path("attemptId").asText())&&coordinates.traceId().equals(expected.path("coordinates").path("traceId").asText())&&coordinates.contractIdentity().equals(p.candidate.contract.identity())&&coordinates.definitionIdentity().equals(p.candidate.identity),"late invocation coordinates");
            var validator=new ValueValidator();var inputBindings=validator.validate(p.candidate.contract.operation().input(),p.input).bindings();
            ReferenceJson.require(report.failure()==null&&validator.validate(p.candidate.contract.operation().output(),report.canonicalOutput(),inputBindings).accepted()&&oracle(p.input,report.canonicalOutput()),"late typed output/oracle");
            var observation=AttemptObservation.succeeded(ReferenceJson.digest(ReferenceJson.canonical(report.canonicalOutput())));
            synchronized(lock){p.completionKnown=true;var before=p.candidate.supervisor.snapshot(p.candidate.workerId);
                var snapshot=p.candidate.invocations.recordObservation(p.plan,observation,rc);
                source.record("COMPOSITION_CONTROL","BOUND_LATE_OBSERVATION_RECORDED",Map.of("association",p.association,"lateSource",retained,"plan",p.plan,"snapshot",snapshot,"workerBefore",before,"workerAfter",p.candidate.supervisor.snapshot(p.candidate.workerId)));
                return snapshot;
            }
        }
    }
    void rejectedRetiredAlias(Candidate fresh,RuntimeHandle retired){synchronized(lock){
        requireQualified(fresh);var result=deployments.rollback(fresh.deploymentId,SLOT,fresh.artifact,new DeploymentRuntime(){
            public RuntimeHandle load(ArtifactPayload payload){source.record("EXECUTION_CAPABILITY","RETIRED_ALIAS_RETURNED",Map.of("handle",retired));return new RuntimeHandle(retired.providerIdentity(),retired.providerVersion(),retired.opaqueHandle());}
            public void warm(RuntimeHandle handle){throw new IllegalStateException("rejected alias must not warm");}
            public void unload(RuntimeHandle handle){throw new IllegalStateException("rejected alias must not unload");}
        },lc);
        source.record("COMPOSITION_CONTROL","RETIRED_ALIAS_RESULT",Map.of("snapshot",result,"binding",deployments.activeBindings()));
        ReferenceJson.require(result.state()==DeploymentState.FAILED,"retired alias accepted");fresh.workers.close();
    }}
    void demonstrateFalseCleanup(Candidate r){synchronized(lock){
        requireQualified(r);deployments.request(r.deploymentId,SLOT,r.artifact,runtime(r,true),lc);deployments.load(r.deploymentId,lc);deployments.warm(r.deploymentId,lc);deployments.activate(r.deploymentId,lc);r.admitted=true;
        deployments.drain(r.deploymentId,lc);
        try{deployments.unload(r.deploymentId,lc);throw new IllegalStateException("false cleanup accepted");}catch(LifecycleException expected){
            source.record("COMPOSITION_CONTROL","PHYSICAL_RELEASE_REJECTED",Map.of("snapshot",deployments.snapshot(r.deploymentId),"ownedProcess",r.workers.observation(r.launch),"cleanupKnowledge","UNKNOWN"));
        }
        ReferenceJson.require(r.launch.process.isAlive()&&deployments.snapshot(r.deploymentId).state()==DeploymentState.FAILED,"false release witness");
        r.workers.close();source.record("COMPOSITION_CONTROL","SEPARATE_CONTAINMENT_OBSERVED",r.workers.observation(r.launch));
    }}
    static boolean oracle(JsonNode input,JsonNode output){
        if(output==null||!output.path("values").path("shape").equals(input.path("values").path("shape"))||!output.path("values").path("dtype").asText().equals("float32")||!output.path("values").path("layout").asText().equals("ROW_MAJOR"))return false;
        JsonNode values=input.path("values").path("values"),actual=output.path("values").path("values");
        if(values.size()!=actual.size()||output.path("rows").asInt()!=input.path("values").path("shape").get(0).asInt())return false;
        for(int i=0;i<values.size();i++){float expected=(float)((float)values.get(i).asDouble()*(float)input.path("scale").asDouble()+(float)input.path("bias").asDouble());
            if(!Double.isFinite(actual.get(i).asDouble())||(float)actual.get(i).asDouble()!=expected)return false;}
        return true;
    }
    private static boolean matchesReport(Prepared p,JsonNode report){
        if(p.association==null)return false;var c=report.path("observedCoordinates");var m=p.association.path("m2");
        for(String key:List.of("contractIdentity","definitionIdentity","invocationId","attemptId","traceId"))if(!c.path(key).equals(m.path("coordinates").path(key)))return false;
        for(String key:List.of("contractDigest","definitionDigest"))if(!c.path(key).equals(m.path(key)))return false;
        var binding=m.path("runtimeBinding");
        return c.path("runtimeIdentity").equals(binding.path("runtimeIdentity"))&&c.path("runtimeVersion").equals(binding.path("runtimeVersion"))&&
                c.path("runtimeCapabilityIdentity").equals(binding.path("capabilityIdentity"))&&c.path("runtimeCapabilityVersion").equals(binding.path("capabilityVersion"))&&
                report.path("runtimeIdentity").equals(binding.path("runtimeIdentity"))&&report.path("runtimeVersion").equals(binding.path("runtimeVersion"));
    }
    @Override public void close() throws Exception {
        synchronized(lock){
            for(var snapshot:deployments.snapshots()){
                Candidate r=candidates.stream().filter(c->c.deploymentId.equals(snapshot.deploymentId())).findFirst().orElseThrow();
                if(snapshot.state()==DeploymentState.ACTIVE)deployments.drain(snapshot.deploymentId(),lc);
                if(deployments.snapshot(snapshot.deploymentId()).state()==DeploymentState.DRAINING){
                    if(deployments.snapshot(snapshot.deploymentId()).outstandingPins()>0)deployments.requireForcedTermination(snapshot.deploymentId(),lc);
                    deployments.unload(snapshot.deploymentId(),lc);
                }
            }
            for(Candidate r:candidates){r.supervisor.close();r.resilienceJournal.close();}
            ReferenceJson.write(root.resolve("m4-events.json"),lifecycleJournal.events());
            var observations=candidates.stream().flatMap(r->r.workers.finalObservations().stream()).toList();
            source.record("HOST_PROCESS_OBSERVER","ASSEMBLY_FINAL_PROCESSES",Map.of("processes",observations,"allStopped",observations.stream().noneMatch(o->Boolean.TRUE.equals(o.get("alive")))));
            ReferenceJson.write(root.resolve("final-state.json"),Map.of("deployments",deployments.snapshots(),"binding",deployments.activeBindings(),"processes",observations));source.close();
        }
    }
}
