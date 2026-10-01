import io.jpyxis.lifecycle.api.*;
import io.jpyxis.lifecycle.core.*;
import io.jpyxis.lifecycle.evidence.*;
import io.jpyxis.lifecycle.port.DeploymentRuntime;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Public M4 model only: no Python, real Runtime, process, durability or product verdict. */
public final class RetiredHandleProbe {
    public static void main(String[] args) throws Exception {
        String testCase=args[0];
        boolean reuse=testCase.equals("retired_handle_rollback");
        LifecycleContext context=new LifecycleContext("rollback-audit",testCase,"trace-rollback-audit");
        InMemoryLifecycleJournal journal=new InMemoryLifecycleJournal();
        ArtifactRegistry registry=new ArtifactRegistry(journal);
        ArtifactCoordinate v1=validated(registry,"artifact-v1","definition-v1",context);
        ArtifactCoordinate v2=validated(registry,"artifact-v2","definition-v2",context);
        DeploymentManager manager=new DeploymentManager(registry,journal);
        ModelRuntime first=new ModelRuntime(new RuntimeHandle("model-provider","1","old-realization"));
        manager.request("deployment-v1","slot",v1,first,context);
        manager.load("deployment-v1",context);manager.warm("deployment-v1",context);manager.activate("deployment-v1",context);
        InvocationPin original=manager.pinInvocation("slot","pin-original","invocation-original",context);
        manager.releasePin("pin-original",context);
        ModelRuntime second=new ModelRuntime(new RuntimeHandle("model-provider","1","current-realization"));
        manager.request("deployment-v2","slot",v2,second,context);
        manager.load("deployment-v2",context);manager.warm("deployment-v2",context);manager.activate("deployment-v2",context);
        manager.unload("deployment-v1",context);
        DeploymentSnapshot retired=manager.snapshot("deployment-v1");
        Map<String,String> activeBefore=manager.activeBindings();
        ModelRuntime rollback=new ModelRuntime(reuse?original.runtimeHandle():new RuntimeHandle("model-provider","1","fresh-rollback-realization"));
        int boundary=journal.events().size();
        DeploymentSnapshot result=manager.rollback("deployment-rollback","slot",v1,rollback,context);
        InvocationPin after=manager.pinInvocation("slot","pin-after","invocation-after",context);
        Map<String,Object> output=new LinkedHashMap<>();
        output.put("case",testCase);
        output.put("scope","M4 public model only; synthetic Runtime capability and in-memory journal");
        output.put("retiredBeforeRollback",retired);
        output.put("retiredAfterRollback",manager.snapshot("deployment-v1"));
        output.put("oldHandle",original.runtimeHandle());output.put("returnedHandle",rollback.handle);
        output.put("newPin",after);output.put("rollbackSnapshot",result);
        output.put("activeBefore",activeBefore);output.put("activeAfter",manager.activeBindings());
        output.put("oldUnloadCalls",first.unloads);output.put("newLoadCalls",rollback.loads);output.put("newWarmCalls",rollback.warms);
        output.put("sameReturnedObjectAsRetired",rollback.handle==original.runtimeHandle());
        output.put("samePinnedObjectAsRetired",after.runtimeHandle()==original.runtimeHandle());
        output.put("samePinnedTupleAsRetired",after.runtimeHandle().equals(original.runtimeHandle()));
        output.put("eventsAfterRollbackRequest",journal.events().subList(boundary,journal.events().size()));
        System.out.println(json(output));
        if(reuse&&result.state()==DeploymentState.ACTIVE&&after.runtimeHandle().equals(original.runtimeHandle()))System.exit(2);
    }
    private static ArtifactCoordinate validated(ArtifactRegistry registry,String identity,String content,LifecycleContext context){
        ArtifactSnapshot registered=registry.register(identity,"model-contract",content.getBytes(StandardCharsets.UTF_8),context);
        registry.beginValidation(identity,context);registry.acceptValidation(identity,"model-validation-observation",context);
        return registered.coordinate();
    }
    private static final class ModelRuntime implements DeploymentRuntime {
        private final RuntimeHandle handle;private int loads,warms,unloads;
        private ModelRuntime(RuntimeHandle handle){this.handle=handle;}
        public RuntimeHandle load(ArtifactPayload payload){loads++;return handle;}
        public void warm(RuntimeHandle supplied){if(supplied!=handle)throw new IllegalStateException("different model handle");warms++;}
        public void unload(RuntimeHandle supplied){if(supplied!=handle)throw new IllegalStateException("different model handle");unloads++;}
    }
    private static String json(Object value) throws Exception {
        if(value==null)return "null";
        if(value instanceof String text)return "\""+text.replace("\\","\\\\").replace("\"","\\\"")+"\"";
        if(value instanceof Enum<?> kind)return json(kind.name());
        if(value instanceof Map<?,?> map){var pairs=new java.util.ArrayList<String>();for(var entry:map.entrySet())pairs.add(json(entry.getKey().toString())+":"+json(entry.getValue()));return "{"+String.join(",",pairs)+"}";}
        if(value instanceof List<?> list){var items=new java.util.ArrayList<String>();for(Object item:list)items.add(json(item));return "["+String.join(",",items)+"]";}
        if(value.getClass().isRecord()){Map<String,Object> record=new LinkedHashMap<>();for(var component:value.getClass().getRecordComponents())record.put(component.getName(),component.getAccessor().invoke(value));return json(record);}
        return value.toString();
    }
}
