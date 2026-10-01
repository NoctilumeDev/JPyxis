package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.jpyxis.host.CancellationToken;
import io.jpyxis.host.InvocationOptions;
import io.jpyxis.resilience.api.LogicalInvocationState;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Serial actual-process journey, not a general algorithm API or product CLI. */
public final class ReferenceJourneyMain {
    private static final InvocationOptions NORMAL=InvocationOptions.withTimeout(Duration.ofSeconds(5));
    private static JsonNode config,input;
    private static Path root;
    private static byte[] v1,v2;
    private static EnvironmentSpec environment;
    public static void main(String[] args) throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("one retained journey configuration is required");
        config=ReferenceJson.read(Path.of(args[0]));root=Path.of(config.path("evidenceRoot").asText());input=config.path("representativeInput");
        v1=Base64.getDecoder().decode(config.path("definitions").path("v1").path("bytes").asText());
        v2=Base64.getDecoder().decode(config.path("definitions").path("v2").path("bytes").asText());environment=new EnvironmentSpec(config.path("environment"));
        run("lifecycle_journey",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);
            var first=control.prepare(input);check(control.invoke(first,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"typed success");control.release(first);
            var oldPin=control.prepare(input);var b=candidate(control,"v2",v2,"normal");control.activate(b);
            check(control.invoke(oldPin,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"old DRAINING pin result");control.release(oldPin);
            var newPin=control.prepare(input);check(newPin.candidate==b,"new pin cutover owner");check(control.invoke(newPin,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"new cutover result");control.release(newPin);
            control.retire(a);
            var rollback=candidate(control,"v1",v1,"normal");control.rollback(rollback);
            check(rollback.launch.process!=a.launch.process&&!rollback.launch.nonce.equals(a.launch.nonce)&&!rollback.runtimeHandle.equals(a.runtimeHandle),"fresh rollback launch/handle");
            var rolled=control.prepare(input);check(control.invoke(rolled,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"fresh rollback result");control.release(rolled);
            var alias=candidate(control,"v1",v1,"normal");control.rejectedRetiredAlias(alias,a.runtimeHandle);
            control.source.record("JOURNEY_DRIVER","LIFECYCLE_WITNESSES_OBSERVED",Map.of("old",a.realization,"cutover",b.realization,"rollback",rollback.realization,"binding",control.deployments.activeBindings()));
        });
        for(String fault:List.of("contract_mismatch","definition_mismatch","runtime_mismatch"))run("qualification_"+fault,control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);
            var bad=candidate(control,"v2",v2,fault);check(!bad.qualified,"operand mismatch must reject");
            check(control.deployments.activeBindings().get(ReferenceControl.SLOT).equals(a.deploymentId),"prior binding conserved");
        });
        run("qualification_environment_mismatch",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);
            ObjectNode changed=(ObjectNode)environment.value();changed.put("requirementsClosureDigest","sha256:"+"0".repeat(64));
            var bad=control.construct(identity("v1"),v1,new EnvironmentSpec(changed),"normal");check(!bad.qualified,"same artifact different Environment");
            check(control.deployments.activeBindings().get(ReferenceControl.SLOT).equals(a.deploymentId),"environment mismatch binding conservation");
        });
        run("pin_worker_substitution",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);
            var b=candidate(control,"v2",v2,"normal");check(b.qualified,"second actual worker qualification");
            check(control.invoke(p,b,NORMAL).state()==LogicalInvocationState.FAILED&&!p.wireCalled,"pin A must not dispatch to B");control.release(p);
        });
        run("instance_changes_before_dispatch",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);control.changeInstance(a);
            check(control.invoke(p,NORMAL).state()==LogicalInvocationState.FAILED&&!p.wireCalled,"stale instance must not dispatch");control.release(p);
        });
        run("deadline_before_dispatch",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);
            check(control.invoke(p,InvocationOptions.withTimeout(Duration.ZERO)).state()==LogicalInvocationState.FAILED&&!p.wireCalled,"known non-execution before dispatch");control.release(p);
        });
        for(String mode:List.of("deadline_continuation","cancellation_continuation","late_after_replacement"))run(mode,control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);
            Files.deleteIfExists(a.launch.root.resolve("runtime-entered.json"));
            ReferenceJson.write(a.launch.root.resolve("execution-control.json"),Map.of("mode","wait"));
            CancellationToken token=new CancellationToken();
            InvocationOptions options=new InvocationOptions(mode.equals("cancellation_continuation")?Duration.ofSeconds(5):Duration.ofMillis(500),token);
            var future=CompletableFuture.supplyAsync(()->{try{return control.invoke(p,options);}catch(Exception e){throw new IllegalStateException(e);}});
            OwnedPythonWorkers.awaitFile(a.launch.root.resolve("runtime-entered.json"),a.launch.process,Duration.ofSeconds(5));
            if(mode.equals("cancellation_continuation"))token.cancel();
            var unknown=future.get(8,TimeUnit.SECONDS);check(unknown.state()==LogicalInvocationState.OUTCOME_UNKNOWN,"uncertain dispatched terminal");
            control.source.record("HOST_PROCESS_OBSERVER","CONTINUATION_AFTER_CALLER_TERMINAL",Map.of("plan",p.plan,"m2",p.m2,"ownedProcess",a.workers.observation(a.launch),"runtimeEntered",ReferenceJson.read(a.launch.root.resolve("runtime-entered.json"))));
            check(a.launch.process.isAlive(),"actual worker continued after wait ended");
            if(mode.equals("late_after_replacement"))control.changeInstance(a);
            Files.writeString(a.launch.root.resolve("release-execution"),"release the bounded witness\n");
            var late=control.recordLate(p);check(late.state()==LogicalInvocationState.OUTCOME_UNKNOWN,"late result must not upgrade UNKNOWN");control.release(p);
        });
        run("worker_crash",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);
            ReferenceJson.write(a.launch.root.resolve("execution-control.json"),Map.of("mode","crash"));
            check(control.invoke(p,NORMAL).state()==LogicalInvocationState.OUTCOME_UNKNOWN,"actual crash without completion remains UNKNOWN");
            check(a.launch.process.waitFor(5,TimeUnit.SECONDS)&&a.launch.process.exitValue()==43,"actual owned worker crash");
            control.source.record("HOST_PROCESS_OBSERVER","CRASH_EXIT_OBSERVED",Map.of("launchNonce",a.launch.nonce,"pid",a.launch.process.pid(),"exitCode",a.launch.process.exitValue(),"alive",a.launch.process.isAlive()));
        });
        run("representative_failure",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var bad=candidate(control,"v2",v2,"wrong_result");
            check(!bad.qualified&&control.deployments.activeBindings().get(ReferenceControl.SLOT).equals(a.deploymentId),"health does not qualify wrong representative result");
        });
        run("early_activation",control->{
            var bad=candidate(control,"v1",v1,"wrong_result");
            try{control.activate(bad);throw new AssertionError("early activation accepted");}catch(IllegalStateException expected){check(control.deployments.activeBindings().isEmpty(),"early activation binding");}
        });
        run("false_cleanup",control->{var a=candidate(control,"v1",v1,"normal");control.demonstrateFalseCleanup(a);});
        run("required_record_failure",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);Files.createDirectory(control.requiredRecordPath(p));
            check(control.invoke(p,NORMAL).state()==LogicalInvocationState.FAILED&&!p.wireCalled,"missing required join record must not send");control.release(p);
        });
        run("duplicate_admission",control->{
            var a=candidate(control,"v1",v1,"normal");control.activate(a);var p=control.prepare(input);
            check(control.invoke(p,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"first dispatch");
            check(control.invoke(p,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"historical terminal remains authoritative after rejected duplicate");
            p.completionKnown=true;control.release(p);
        });
        run("snapshot_locator_mutation",control->{
            var a=candidate(control,"v1",v1,"locator_mutation");check(a.qualified,"compiled retained bytes survive changed locator");control.activate(a);
            ObjectNode fractional=(ObjectNode)input.deepCopy();var values=io.jpyxis.contract.JsonSupport.MAPPER.createArrayNode();
            for(int i=0;i<input.path("values").path("values").size();i++)values.add((i%2==0?1:-1)*(i+1)/10.0);
            ((ObjectNode)fractional.path("values")).set("values",values);fractional.put("scale",0.3);fractional.put("bias",0.1);
            var p=control.prepare(fractional);check(control.invoke(p,NORMAL).state()==LogicalInvocationState.SUCCEEDED,"retained snapshot fractional invocation");control.release(p);
        });
    }
    private static String identity(String version){return config.path("definitions").path(version).path("identity").asText();}
    private static ReferenceControl.Candidate candidate(ReferenceControl control,String version,byte[] bytes,String fault) throws Exception {
        return control.construct(identity(version),bytes,environment,fault);
    }
    private static void check(boolean condition,String message){ReferenceJson.require(condition,message);}
    @FunctionalInterface private interface Journey {void run(ReferenceControl control) throws Exception;}
    private static void run(String id,Journey journey) throws Exception {
        System.out.println("actual reference case: "+id);var caseRoot=root.resolve("cases").resolve(id);
        try(var control=new ReferenceControl(config,caseRoot)){
            control.source.record("JOURNEY_DRIVER","CASE_STARTED",Map.of("id",id));journey.run(control);
            control.source.record("JOURNEY_DRIVER","CASE_DRIVER_FINISHED",Map.of("id",id));
        }
    }
}
