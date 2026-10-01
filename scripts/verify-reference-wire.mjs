import assert from 'node:assert/strict';

// Independent bounded decoder for the retained frozen M2 report profile.
// It does not import generated bindings or the runtime transport conversion.
function varint(bytes,cursor){
  let value=0n;
  for(let i=0;i<10;i++){
    assert.ok(cursor.offset<bytes.length,'truncated protobuf varint');
    const byte=bytes[cursor.offset++];value|=BigInt(byte&127)<<BigInt(7*i);
    if(!(byte&128)){assert.ok(value<=BigInt(Number.MAX_SAFE_INTEGER),'unbounded protobuf integer');return Number(value);}
  }
  assert.fail('oversized protobuf varint');
}
function fields(bytes,allowed){
  assert.ok(bytes.length<=16*1024*1024,'bounded retained report');const result=new Map(),cursor={offset:0};
  while(cursor.offset<bytes.length){
    const tag=varint(bytes,cursor),id=Math.floor(tag/8),wire=tag%8;
    assert.ok(allowed[id]?.includes(wire),`unexpected frozen field/wire ${id}/${wire}`);
    let value;
    if(wire===0)value=varint(bytes,cursor);
    else if(wire===2){const size=varint(bytes,cursor);assert.ok(cursor.offset+size<=bytes.length,'truncated protobuf bytes');value=bytes.subarray(cursor.offset,cursor.offset+size);cursor.offset+=size;}
    else {assert.ok(cursor.offset+4<=bytes.length,'truncated protobuf float');value=bytes.readFloatLE(cursor.offset);cursor.offset+=4;}
    if(!result.has(id))result.set(id,[]);result.get(id).push(value);
  }
  return result;
}
function single(map,id,fallback){const values=map.get(id)??[];assert.ok(values.length<=1,`duplicate singular field ${id}`);return values[0]??fallback;}
const string=(map,id)=>single(map,id,Buffer.alloc(0)).toString('utf8');
function tensor(bytes){
  const f=fields(bytes,{1:[0],2:[0,2],3:[0],4:[2,5],5:[0,2]});
  assert.equal(single(f,1,0),1,'float32 frozen output');assert.equal(single(f,3,0),1,'row-major frozen output');assert.equal((f.get(5)??[]).length,0,'foreign output storage');
  const shape=[];for(const value of f.get(2)??[]){if(typeof value==='number')shape.push(value);else{const c={offset:0};while(c.offset<value.length)shape.push(varint(value,c));}}
  const values=[];for(const value of f.get(4)??[]){if(typeof value==='number')values.push(value);else{assert.equal(value.length%4,0);for(let i=0;i<value.length;i+=4)values.push(value.readFloatLE(i));}}
  assert.ok(shape.length>0&&shape.every(n=>Number.isSafeInteger(n)&&n>0));assert.ok(values.every(Number.isFinite));
  return {dtype:'DTYPE_FLOAT32',shape,layout:'LAYOUT_ROW_MAJOR',float_values:values};
}
export function verifyRetainedWireReport(base64,projection){
  assert.equal(typeof base64,'string');const bytes=Buffer.from(base64,'base64');assert.equal(bytes.toString('base64'),base64,'canonical retained report bytes');
  const f=fields(bytes,{1:[2],2:[2],3:[2],4:[2],5:[2],10:[2],11:[2]});
  const coordinates=fields(single(f,1,Buffer.alloc(0)),Object.fromEntries(Array.from({length:11},(_,i)=>[i+1,[2]])));
  const names=['contract_identity','contract_digest','definition_identity','definition_digest','invocation_id','attempt_id','trace_id','runtime_identity','runtime_version','runtime_capability_identity','runtime_capability_version'];
  const observed=Object.fromEntries(names.map((name,i)=>[name,string(coordinates,i+1)]));
  assert.deepEqual(observed,projection.observed_coordinates,'binary report coordinates differ from JSON projection');
  for(const [id,name] of [[2,'worker_identity'],[3,'worker_version'],[4,'runtime_identity'],[5,'runtime_version']])assert.equal(string(f,id),projection[name]??'',`binary ${name}`);
  assert.notEqual(f.has(10),f.has(11),'one complete frozen report observation');
  if(f.has(10)){
    const output=fields(single(f,10),{1:[2],2:[0]});
    const decoded={values:tensor(single(output,1)),rows:single(output,2,0)};
    const projected={values:{...projection.output.values,float_values:projection.output.values.float_values.map(Math.fround)},rows:Number(projection.output.rows)};
    assert.deepEqual(decoded,projected,'binary typed output differs from JSON projection');assert.equal(projection.failure,undefined);
  }else{
    const failure=fields(single(f,11),{1:[0],2:[2],3:[2],4:[0],5:[2],6:[2]});
    const category=['WORKER_FAILURE_CATEGORY_UNSPECIFIED','WORKER_FAILURE_CATEGORY_CONTRACT','WORKER_FAILURE_CATEGORY_DEFINITION','WORKER_FAILURE_CATEGORY_RUNTIME'][single(failure,1,0)];
    assert.ok(category);const p=projection.failure;assert.ok(p);assert.equal(category,p.category??'WORKER_FAILURE_CATEGORY_UNSPECIFIED');
    for(const [id,name] of [[2,'code'],[3,'summary'],[5,'origin_layer'],[6,'causal_reference']])assert.equal(string(failure,id),p[name]??'');
    assert.equal(Boolean(single(failure,4,0)),p.retryable??false);assert.equal(projection.output,undefined);
  }
}
