import io.jpyxis.lifecycle.api.*;
import io.jpyxis.lifecycle.core.*;
import io.jpyxis.lifecycle.evidence.*;
import io.jpyxis.lifecycle.port.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

/** Public, in-memory M4 model observations only. This emitter assigns no verdict. */
public final class HandleOwnershipProbe {
    private static final LifecycleContext CTX=new LifecycleContext("handle-audit","model-observation","trace-handle-audit");
    private static final class Model implements DeploymentRuntime {
        final Supplier<RuntimeHandle> returns;
        RuntimeHandle returned;
        boolean failWarm,failUnload;
        CountDownLatch loadEntered,loadRelease,warmEntered,warmRelease,unloadEntered,unloadRelease;
        int loads,warms,unloads;
        final List<RuntimeHandle> warmArguments=new ArrayList<>(),unloadArguments=new ArrayList<>();
        Model(RuntimeHandle h){returns=()->h;}
        Model(Supplier<RuntimeHandle> returns){this.returns=returns;}
        public RuntimeHandle load(ArtifactPayload payload) throws LifecycleCapabilityException {
            loads++;gate(loadEntered,loadRelease);returned=returns.get();return returned;
        }
        public void warm(RuntimeHandle h) throws LifecycleCapabilityException {
            warms++;warmArguments.add(h);gate(warmEntered,warmRelease);
            if(failWarm)throw new LifecycleCapabilityException("MODEL_WARM_FAILED","observed model warm failure");
        }
        public void unload(RuntimeHandle h) throws LifecycleCapabilityException {
            unloads++;unloadArguments.add(h);gate(unloadEntered,unloadRelease);
            if(failUnload)throw new LifecycleCapabilityException("MODEL_UNLOAD_FAILED","observed model unload failure");
        }
        Map<String,Object> observations(){
            Map<String,Object> m=new LinkedHashMap<>();m.put("returned",returned);m.put("loads",loads);
            m.put("warms",warms);m.put("unloads",unloads);m.put("warmArguments",warmArguments);m.put("unloadArguments",unloadArguments);return m;
        }
    }
    private static final class Fixture {
        final InMemoryLifecycleJournal journal=new InMemoryLifecycleJournal();
        final ArtifactRegistry registry=new ArtifactRegistry(journal);
        final ArtifactCoordinate artifact;
        final DeploymentManager manager;
        final Model active=new Model(new RuntimeHandle("provider","1","active-handle"));
        final InvocationPin retained;
        final Map<String,Object> row=new LinkedHashMap<>();
        Fixture(String id){
            var registered=registry.register("artifact","model-contract","immutable-model-definition".getBytes(StandardCharsets.UTF_8),CTX);
            registry.beginValidation("artifact",CTX);registry.acceptValidation("artifact","model-validation-observation",CTX);
            artifact=registered.coordinate();manager=new DeploymentManager(registry,journal);
            manager.request("active","slot",artifact,active,CTX);complete("active");
            retained=manager.pinInvocation("slot","retained-pin","retained-invocation",CTX);
            row.put("case",id);row.put("artifact",artifact);row.put("retainedPinBefore",retained);
            row.put("activeBefore",manager.activeBindings());
            row.put("activeBeforeCandidate",manager.activeBindings());
        }
        String load(String id){try{manager.load(id,CTX);return "";}catch(LifecycleException e){return e.code().name();}}
        String finishLoaded(String id){try{manager.warm(id,CTX);manager.activate(id,CTX);return "";}catch(LifecycleException e){return e.code().name();}}
        String complete(String id){String error=load(id);return error.isEmpty()?finishLoaded(id):error;}
        void emit(Model candidate) throws Exception {
            row.put("candidate",candidate.observations());row.put("snapshots",manager.snapshots());
            row.put("activeAfter",manager.activeBindings());row.put("activeSnapshotAfter",manager.snapshot("active"));
            row.put("retainedPinAfter",retained);row.put("retainedPinReleaseOutcome",manager.releasePin(retained.pinId(),CTX));
            row.put("events",journal.events());System.out.println(json(row));
        }
    }
    public static void main(String[] args) throws Exception {
        String id=args[0];Fixture f=new Fixture(id);
        if(id.equals("concurrent_duplicate_returns")){concurrent(f);return;}
        if(id.equals("separate_owner_lifetime")){
            InMemoryLifecycleJournal otherJournal=new InMemoryLifecycleJournal();
            DeploymentManager other=new DeploymentManager(f.registry,otherJournal);
            Model c=new Model(copy(f.retained.runtimeHandle()));
            other.request("other-owner-deployment","other-slot",f.artifact,c,CTX);
            other.load("other-owner-deployment",CTX);other.warm("other-owner-deployment",CTX);other.activate("other-owner-deployment",CTX);
            f.row.put("otherOwnerPin",other.pinInvocation("other-slot","other-pin","other-invocation",CTX));
            f.row.put("otherOwnerSnapshot",other.snapshot("other-owner-deployment"));f.row.put("otherOwnerEvents",otherJournal.events());f.emit(c);return;
        }
        if(id.startsWith("malformed_")){
            String[] tuple={"provider","1","new-handle"};String[] parts=id.substring(10).split("_");
            int field=switch(parts[0]){case "provider"->0;case "version"->1;default->2;};
            tuple[field]=parts[1].equals("null")?null:" ";
            f.row.put("submittedTuple",Arrays.asList(tuple));
            Model c=new Model(()->new RuntimeHandle(tuple[0],tuple[1],tuple[2]));
            f.manager.request("candidate","slot",f.artifact,c,CTX);f.row.put("candidateError",f.complete("candidate"));f.emit(c);return;
        }
        if(id.equals("null_return")){
            Model c=new Model(()->null);f.manager.request("candidate","slot",f.artifact,c,CTX);
            f.row.put("candidateError",f.complete("candidate"));f.emit(c);return;
        }
        RuntimeHandle original=f.active.returned;
        Model holder=null;Future<?> slow=null;ExecutorService executor=null;
        if(id.startsWith("retired_")||id.startsWith("warm_failed_")||id.equals("unload_failed_reentry")||id.startsWith("live_")&&!id.equals("live_alias_cleanup")){
            holder=new Model(new RuntimeHandle("provider","1","holder-handle"));
            f.manager.request("holder","holder-slot",f.artifact,holder,CTX);f.load("holder");
            if(id.startsWith("warm_failed_")){
                holder.failWarm=true;holder.failUnload=id.equals("warm_failed_cleanup_reentry");
                f.row.put("holderError",f.finishLoaded("holder"));
            }else if(id.equals("live_loaded")){
                // Keep the adopted handle in LOADING.
            }else if(id.equals("live_warming")){
                holder.warmEntered=new CountDownLatch(1);holder.warmRelease=new CountDownLatch(1);
                executor=Executors.newSingleThreadExecutor();Model h=holder;
                slow=executor.submit(()->f.manager.warm("holder",CTX));await(holder.warmEntered);
            }else{
                f.manager.warm("holder",CTX);
                if(!id.equals("live_standby")){
                    f.manager.activate("holder",CTX);
                    if(!id.equals("live_active")){
                        f.manager.drain("holder",CTX);
                        if(id.equals("live_unloading")){
                            holder.unloadEntered=new CountDownLatch(1);holder.unloadRelease=new CountDownLatch(1);
                            executor=Executors.newSingleThreadExecutor();slow=executor.submit(()->f.manager.unload("holder",CTX));await(holder.unloadEntered);
                        }else if(!id.equals("live_draining")){
                            holder.failUnload=id.equals("unload_failed_reentry");
                            try{f.manager.unload("holder",CTX);}catch(LifecycleException e){f.row.put("holderError",e.code().name());}
                        }
                    }
                }
            }
            original=holder.returned;f.row.put("holderBeforeCandidate",f.manager.snapshot("holder"));
        }
        RuntimeHandle returned=copy(original);
        if(id.equals("retired_same_object"))returned=original;
        if(id.equals("fresh_rollback"))returned=new RuntimeHandle("provider","1","fresh-handle");
        if(id.equals("different_provider"))returned=new RuntimeHandle("Provider","1",original.opaqueHandle());
        if(id.equals("different_version"))returned=new RuntimeHandle("provider","01",original.opaqueHandle());
        if(id.equals("different_opaque"))returned=new RuntimeHandle("provider","1",original.opaqueHandle()+" ");
        Model c=new Model(returned);c.failWarm=id.equals("live_alias_cleanup");
        f.row.put("activeBeforeCandidate",f.manager.activeBindings());
        f.row.put("originalHandle",original);f.row.put("sameReturnedObject",returned==original);
        f.row.put("sameReturnedTuple",returned.equals(original));
        try{
            if(id.startsWith("retired_")||id.equals("fresh_rollback"))f.row.put("rollbackResult",f.manager.rollback("candidate","slot",f.artifact,c,CTX));
            else{f.manager.request("candidate","slot",f.artifact,c,CTX);f.row.put("candidateError",f.complete("candidate"));}
        }finally{
            if(slow!=null){if(holder.warmRelease!=null)holder.warmRelease.countDown();if(holder.unloadRelease!=null)holder.unloadRelease.countDown();slow.get(5,TimeUnit.SECONDS);executor.shutdown();}
        }
        if(holder!=null){f.row.put("holderAfterCandidate",f.manager.snapshot("holder"));f.row.put("holder",holder.observations());}
        if(f.manager.snapshot("candidate").state()==DeploymentState.ACTIVE)f.row.put("candidatePin",f.manager.pinInvocation("slot","candidate-pin","candidate-invocation",CTX));
        f.emit(c);
    }
    private static void concurrent(Fixture f) throws Exception {
        RuntimeHandle tuple=new RuntimeHandle("provider","1","concurrent-handle");
        Model a=new Model(tuple),b=new Model(copy(tuple));CountDownLatch entered=new CountDownLatch(2),release=new CountDownLatch(1);
        a.loadEntered=entered;b.loadEntered=entered;a.loadRelease=release;b.loadRelease=release;
        f.manager.request("candidate-a","slot-a",f.artifact,a,CTX);f.manager.request("candidate-b","slot-b",f.artifact,b,CTX);
        var executor=Executors.newFixedThreadPool(2);
        try{
            var left=executor.submit(()->f.load("candidate-a"));var right=executor.submit(()->f.load("candidate-b"));
            await(entered);f.row.put("duringLoadPin",f.manager.pinInvocation("slot","during-load-pin","during-load-invocation",CTX));
            release.countDown();f.row.put("loadErrors",List.of(left.get(5,TimeUnit.SECONDS),right.get(5,TimeUnit.SECONDS)));
            var pins=new ArrayList<InvocationPin>();
            for(String name:List.of("a","b")){String candidate="candidate-"+name;
                if(f.manager.snapshot(candidate).state()==DeploymentState.LOADING){f.finishLoaded(candidate);pins.add(f.manager.pinInvocation("slot-"+name,"pin-"+name,"inv-"+name,CTX));}}
            f.row.put("candidatePins",pins);f.row.put("secondCandidate",b.observations());f.row.put("sameReturnedObject",a.returned==b.returned);
            f.emit(a);
        }finally{release.countDown();executor.shutdown();}
    }
    private static RuntimeHandle copy(RuntimeHandle h){return new RuntimeHandle(h.providerIdentity(),h.providerVersion(),h.opaqueHandle());}
    private static void await(CountDownLatch latch) throws Exception {if(!latch.await(5,TimeUnit.SECONDS))throw new IllegalStateException("model barrier timed out");}
    private static void gate(CountDownLatch entered,CountDownLatch release) throws LifecycleCapabilityException {
        if(entered==null)return;entered.countDown();try{await(release);}catch(Exception e){throw new LifecycleCapabilityException("MODEL_BARRIER_FAILED",e.toString());}
    }
    private static String json(Object value) throws Exception {
        if(value==null)return "null";
        if(value instanceof String text)return "\""+text.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r")+"\"";
        if(value instanceof Enum<?> kind)return json(kind.name());
        if(value instanceof Map<?,?> map){var pairs=new ArrayList<String>();for(var e:map.entrySet())pairs.add(json(e.getKey().toString())+":"+json(e.getValue()));return "{"+String.join(",",pairs)+"}";}
        if(value instanceof List<?> list){var items=new ArrayList<String>();for(Object item:list)items.add(json(item));return "["+String.join(",",items)+"]";}
        if(value.getClass().isRecord()){Map<String,Object> record=new LinkedHashMap<>();for(var c:value.getClass().getRecordComponents())record.put(c.getName(),c.getAccessor().invoke(value));return json(record);}
        return value.toString();
    }
}
