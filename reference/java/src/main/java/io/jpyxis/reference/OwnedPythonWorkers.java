package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.resilience.api.WorkerHandle;
import io.jpyxis.resilience.port.WorkerControl;
import io.jpyxis.resilience.port.WorkerControlException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/** Actual capability adapter. Ownership comes from ProcessBuilder.start, never a returned PID. */
final class OwnedPythonWorkers implements WorkerControl {
    static final class Launch {
        final Process process;
        final String nonce;
        final Path root;
        final WorkerHandle handle;
        final JsonNode descriptor;
        final String birth;
        int port;
        JsonNode facts;
        JsonNode independentProbe;
        Launch(Process p,String nonce,Path root,WorkerHandle handle,JsonNode descriptor){
            this.process=p;this.nonce=nonce;this.root=root;this.handle=handle;this.descriptor=descriptor.deepCopy();
            this.birth=p.info().startInstant().map(Instant::toString).orElse("");
        }
    }
    private final JsonNode config;
    private final ObjectNode baseDescriptor;
    private final Path root;
    private final String fault;
    private final SourceJournal journal;
    private final List<Launch> launches=new ArrayList<>();
    private final List<Process> probeProcesses=new ArrayList<>();
    private Launch current;

    OwnedPythonWorkers(JsonNode config,JsonNode descriptor,Path root,String fault,SourceJournal journal){
        this.config=config.deepCopy();this.baseDescriptor=(ObjectNode)descriptor.deepCopy();
        this.root=root;this.fault=fault;this.journal=journal;
    }
    @Override public synchronized WorkerHandle start(String workerId,String instanceId,String controlEpoch) throws WorkerControlException {
        try {
            String nonce=UUID.randomUUID().toString();Path launchRoot=root.resolve("launch-"+launches.size());Files.createDirectories(launchRoot);
            ObjectNode descriptor=baseDescriptor.deepCopy();descriptor.put("workerId",workerId);descriptor.put("instanceId",instanceId);
            descriptor.put("controlEpoch",controlEpoch);descriptor.put("launchNonce",nonce);
            if(fault.equals("definition_mismatch"))descriptor.put("definitionBytes",Base64.getEncoder().encodeToString("DEFINITION_IDENTITY='wrong'\n".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            if(fault.equals("contract_mismatch")){
                var contract=(ObjectNode)io.jpyxis.contract.JsonSupport.MAPPER.readTree(Base64.getDecoder().decode(descriptor.path("contractBytes").asText()));
                ((ObjectNode)contract.path("metadata")).put("version","9.0.0");
                descriptor.put("contractBytes",Base64.getEncoder().encodeToString(ReferenceJson.canonical(contract)));
            }
            if(fault.equals("runtime_mismatch"))descriptor.put("runtimeProvider","python.reference");
            ReferenceJson.write(launchRoot.resolve("descriptor.json"),descriptor);
            Files.writeString(launchRoot.resolve("definition.py"),fault.equals("locator_mutation")?"raise RuntimeError('unbound locator')\n":"# locator only\n");
            if(fault.equals("wrong_result"))ReferenceJson.write(launchRoot.resolve("execution-control.json"),Map.of("mode","wrong_result"));
            Process probe=builder(launchRoot,true).redirectOutput(launchRoot.resolve("probe.stdout.bin").toFile())
                    .redirectError(launchRoot.resolve("probe.stderr.bin").toFile()).start();
            probeProcesses.add(probe);
            journal.record("HOST_LAUNCH","INDEPENDENT_INTERPRETER_STARTED",Map.of("pid",probe.pid(),"root",launchRoot.toString(),"birth",probe.info().startInstant().map(Instant::toString).orElse("")));
            if(!probe.waitFor(10,TimeUnit.SECONDS)){probe.destroyForcibly();probe.waitFor(5,TimeUnit.SECONDS);throw new IllegalStateException("independent interpreter timeout");}
            journal.record("HOST_LAUNCH","INDEPENDENT_INTERPRETER_EXITED",Map.of("pid",probe.pid(),"exitCode",probe.exitValue(),"alive",probe.isAlive()));
            ReferenceJson.require(probe.exitValue()==0,"independent interpreter failed");
            JsonNode probeFacts=ReferenceJson.read(launchRoot.resolve("independent-probe/worker-facts.json"));
            ReferenceJson.require(probeFacts.path("pid").asLong()==probe.pid(),"independent native interpreter launch association");
            Process process=builder(launchRoot,false).redirectOutput(launchRoot.resolve("worker.stdout.bin").toFile())
                    .redirectError(launchRoot.resolve("worker.stderr.bin").toFile()).start();
            WorkerHandle handle=new WorkerHandle(workerId,instanceId,controlEpoch,process.pid());
            Launch launch=new Launch(process,nonce,launchRoot,handle,descriptor);launches.add(launch);current=launch;
            journal.record("HOST_LAUNCH","ACTUAL_WORKER_STARTED",Map.of("handle",handle,"launchNonce",nonce,"birth",launch.birth,"root",launchRoot.toString(),"descriptor",descriptor));
            awaitFile(launchRoot.resolve("transport-address.json"),process,Duration.ofSeconds(10));
            launch.port=ReferenceJson.read(launchRoot.resolve("transport-address.json")).path("port").asInt();
            launch.facts=ReferenceJson.read(launchRoot.resolve("worker-facts.json"));
            launch.independentProbe=probeFacts;
            ReferenceJson.require(launch.facts.path("pid").asLong()==process.pid()&&launch.facts.path("launchNonce").asText().equals(nonce),"host/worker birth association");
            journal.record("HOST_LAUNCH","ACTUAL_WORKER_OBSERVED",observation(launch));return handle;
        } catch(Exception failure){journal.record("EXECUTION_CAPABILITY","ACTUAL_LAUNCH_FAILURE_OBSERVED",Map.of("failureType",failure.getClass().getName(),"reason",failure.toString()));throw new WorkerControlException("REFERENCE_LAUNCH_FAILED",failure.toString(),failure);}
    }
    private ProcessBuilder builder(Path launchRoot,boolean probe){
        var args=new ArrayList<String>();args.add(config.path("pythonExecutable").asText());
        config.path("pythonFlags").forEach(flag->args.add(flag.asText()));
        args.add(config.path("workerScript").asText());args.add(launchRoot.resolve("descriptor.json").toString());if(probe)args.add("--probe");
        var builder=new ProcessBuilder(args);builder.environment().clear();
        config.path("launchEnvironment").fields().forEachRemaining(e->builder.environment().put(e.getKey(),e.getValue().asText()));
        return builder;
    }
    @Override public synchronized boolean isHealthy(WorkerHandle handle){
        Launch launch=find(handle);return launch.process.isAlive()&&launch.port>0;
    }
    @Override public synchronized void stop(WorkerHandle handle) throws WorkerControlException {
        try {stopOwned(find(handle),false);}catch(Exception e){throw new WorkerControlException("REFERENCE_STOP_FAILED",e.toString(),e);}
    }
    synchronized Launch current(){return current;}
    private Launch find(WorkerHandle handle){
        return launches.stream().filter(l->l.handle.equals(handle)).findFirst().orElseThrow(()->new IllegalArgumentException("unowned worker tuple"));
    }
    synchronized Map<String,Object> observation(Launch launch){
        ReferenceJson.require(launches.contains(launch),"unowned launch reference");
        return Map.of("pid",launch.process.pid(),"birth",launch.birth,"launchNonce",launch.nonce,"alive",launch.process.isAlive(),"handle",launch.handle);
    }
    synchronized boolean stopOwned(Launch launch,boolean falseSuccess) throws Exception {
        ReferenceJson.require(launches.contains(launch),"cleanup needs original host launch reference");
        RuntimeException recordFailure=null;
        try{journal.record("EXECUTION_CAPABILITY","STOP_REQUEST_OBSERVED",Map.of("launchNonce",launch.nonce,"pid",launch.process.pid(),"requestSkipped",falseSuccess));}
        catch(RuntimeException failure){recordFailure=failure;}
        if(!falseSuccess&&launch.process.isAlive()){
            launch.process.destroy();if(!launch.process.waitFor(3,TimeUnit.SECONDS)){launch.process.destroyForcibly();launch.process.waitFor(3,TimeUnit.SECONDS);}
        }
        boolean alive=launch.process.isAlive();
        try{
            journal.record("EXECUTION_CAPABILITY","RELEASE_REPORTED",Map.of("launchNonce",launch.nonce,"pid",launch.process.pid(),"reportedStopped",falseSuccess||!alive));
            journal.record("HOST_PROCESS_OBSERVER","POST_STOP_PROCESS_OBSERVED",observation(launch));
        }catch(RuntimeException failure){if(recordFailure==null)recordFailure=failure;else recordFailure.addSuppressed(failure);}
        if(recordFailure!=null)throw recordFailure;
        return !alive;
    }
    static void awaitFile(Path file,Process process,Duration timeout) throws Exception {
        long until=System.nanoTime()+timeout.toNanos();
        while(!Files.exists(file)){
            if(!process.isAlive())throw new IllegalStateException("owned worker exited before "+file.getFileName());
            if(System.nanoTime()>=until)throw new IllegalStateException("bounded observation timeout: "+file);
            Thread.sleep(10);
        }
    }
    synchronized List<Map<String,Object>> finalObservations(){
        return launches.stream().map(this::observation).toList();
    }
    @Override public synchronized void close(){
        IllegalStateException failure=null;
        for(Launch launch:launches)try{stopOwned(launch,false);}catch(Exception e){if(failure==null)failure=new IllegalStateException(e);else failure.addSuppressed(e);}
        for(Process process:probeProcesses)if(process.isAlive()){process.destroyForcibly();try{process.waitFor(3,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}}
        if(failure!=null)throw failure;
    }
}
