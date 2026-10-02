package io.jpyxis.reference;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Loopback-only reference application, not a general web control plane. */
public final class RiskHostServer implements AutoCloseable {
    final RiskScoringSlot slot;
    final HttpServer server;
    final String token=UUID.randomUUID().toString();
    private final ExecutorService http=Executors.newFixedThreadPool(4);
    private final CountDownLatch stopped=new CountDownLatch(1);
    RiskHostServer(JsonNode config,Path root,int port) throws Exception {
        slot=new RiskScoringSlot(config,root);
        server=HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),port),0);
        server.createContext("/",this::handle);server.setExecutor(http);server.start();
        ReferenceJson.write(root.resolve("server.json"),Map.of("url",url(),"javaPid",ProcessHandle.current().pid()));
    }
    String url(){return "http://127.0.0.1:"+server.getAddress().getPort();}
    private void handle(HttpExchange exchange) throws java.io.IOException {
        try {
            String path=exchange.getRequestURI().getPath(),method=exchange.getRequestMethod();
            exchange.getResponseHeaders().set("Cache-Control","no-store");
            exchange.getResponseHeaders().set("X-Content-Type-Options","nosniff");
            exchange.getResponseHeaders().set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
            if(method.equals("GET")) {
                switch(path) {
                    case "/api/session" -> json(exchange,200,Map.of("token",token));
                    case "/api/state" -> json(exchange,200,slot.state());
                    case "/api/receipt" -> {
                        exchange.getResponseHeaders().set("Content-Disposition","attachment; filename=\"jpyxis-risk-receipt.json\"");
                        json(exchange,200,slot.receipt());
                    }
                    case "/","/index.html","/style.css","/app.js" -> asset(exchange,path);
                    default -> json(exchange,404,Map.of("error","Unknown reference route"));
                }
            } else if(method.equals("POST")&&path.equals("/api/action")) {
                if(!token.equals(exchange.getRequestHeaders().getFirst("X-Reference-Token"))) {json(exchange,403,Map.of("error","Local reference session required"));return;}
                byte[] bytes=exchange.getRequestBody().readNBytes(4097);
                if(bytes.length>4096)throw new IllegalArgumentException("bounded request size exceeded");
                JsonNode input=io.jpyxis.contract.JsonSupport.MAPPER.readTree(bytes);
                if(input==null||!input.isObject())throw new IllegalArgumentException("JSON object required");
                Set<String> allowed=Set.of("action","version","sample","mode","requestId");
                input.fieldNames().forEachRemaining(name->{if(!allowed.contains(name))throw new IllegalArgumentException("unknown request field");});
                JsonNode result;
                switch(input.path("action").asText()) {
                    case "install" -> {slot.install(input.path("version").asText());result=slot.state();}
                    case "activate" -> {slot.activate(input.path("version").asText());result=slot.state();}
                    case "invoke" -> result=slot.invoke(input.path("sample").asText("STANDARD"),input.path("mode").asText("normal"));
                    case "release" -> {slot.release(input.path("requestId").asText());result=slot.state();}
                    case "rollback" -> {slot.rollback();result=slot.state();}
                    case "close" -> {slot.close();result=slot.state();}
                    case "stop" -> {
                        if(!slot.state().path("closed").asBoolean())throw new IllegalStateException("Close owned workers before stopping the HTTP host");
                        json(exchange,200,Map.of("stopping",true));exchange.close();close();return;
                    }
                    default -> throw new IllegalArgumentException("unsupported explicit host action");
                }
                json(exchange,200,result);
            } else json(exchange,405,Map.of("error","Method not supported"));
        } catch(IllegalArgumentException error) {json(exchange,400,Map.of("error",error.getMessage()==null?"Invalid reference input":error.getMessage()));}
        catch(Exception error) {json(exchange,409,Map.of("error",error.getMessage()==null?"Operation rejected":error.getMessage()));}
        finally {exchange.close();}
    }
    private static void json(HttpExchange exchange,int status,Object data) throws java.io.IOException {
        byte[] bytes=ReferenceJson.canonical(ReferenceJson.tree(data));
        exchange.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");exchange.sendResponseHeaders(status,bytes.length);
        exchange.getResponseBody().write(bytes);
    }
    private static void asset(HttpExchange exchange,String path) throws java.io.IOException {
        String file=path.equals("/")?"index.html":path.substring(1);
        try(var input=RiskHostServer.class.getResourceAsStream("/observatory/"+file)) {
            if(input==null){json(exchange,404,Map.of("error","Missing application asset"));return;}
            byte[] bytes=input.readAllBytes();exchange.getResponseHeaders().set("Content-Type",file.endsWith("css")?"text/css; charset=utf-8":file.endsWith("js")?"text/javascript; charset=utf-8":"text/html; charset=utf-8");
            exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);
        }
    }
    @Override public void close() {
        try{slot.close();}catch(Exception error){slot.emergencyContainment();}
        server.stop(0);http.shutdownNow();stopped.countDown();
    }
    public static void main(String[] args) throws Exception {
        if(args.length<1||args.length>2)throw new IllegalArgumentException("retained config and optional loopback port required");
        JsonNode config=ReferenceJson.read(Path.of(args[0]));Path root=Path.of(config.path("evidenceRoot").asText());
        var app=new RiskHostServer(config,root,args.length==2?Integer.parseInt(args[1]):8765);
        Runtime.getRuntime().addShutdownHook(new Thread(app::close));
        System.out.println("Risk scoring reference host: "+app.url());System.out.println("Owned receipts: "+root);
        app.stopped.await();
    }
}
