import test from 'node:test';
import assert from 'node:assert/strict';

test('sync uploads local edits and refreshes remote changes on focus',async()=>{
  const key='star-intersection-data-v1',authKey='star-intersection-auth-v1';
  const initial={id:'task-1',kind:'task',title:'Prepare notes',done:false,dueDate:'',updatedAt:1000,dirty:true};
  const storage=new Map([[key,JSON.stringify([initial])],[authKey,JSON.stringify({uid:'owner-1',idToken:'test-token',refreshToken:'test-refresh',expiresAt:Date.now()+3_600_000})]]);
  const remote=new Map(),windowHandlers={},documentHandlers={};
  const app={innerHTML:'',insertAdjacentHTML(_position,html){this.innerHTML+=html;}};
  globalThis.localStorage={getItem:name=>storage.get(name)||null,setItem:(name,value)=>storage.set(name,value),removeItem:name=>storage.delete(name)};
  globalThis.window={STAR_FIREBASE:{apiKey:'test-key',projectId:'test-project'},addEventListener:(name,fn)=>{windowHandlers[name]=fn;}};
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  globalThis.document={hidden:false,body:{appendChild(){}},querySelector:selector=>selector==='#app'?app:null,addEventListener:(name,fn)=>{documentHandlers[name]=fn;},createElement:()=>({remove(){}})};
  globalThis.setInterval=()=>0;
  globalThis.fetch=async(url,options={})=>{
    assert.match(url,/firestore.googleapis.com/);
    assert.equal(options.headers.Authorization,'Bearer test-token');
    if(options.method==='PATCH'){
      const item=JSON.parse(JSON.parse(options.body).fields.payload.stringValue);
      remote.set(item.id,item);
      return {ok:true,json:async()=>({})};
    }
    return {ok:true,json:async()=>({documents:[...remote.values()].map(item=>({fields:{payload:{stringValue:JSON.stringify(item)}}}))})};
  };
  await import('../app.js?sync-flow');
  const waitFor=async(predicate)=>{for(let i=0;i<50;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('Timed out waiting for sync');};
  await waitFor(()=>remote.has('task-1'));
  await waitFor(()=>JSON.parse(storage.get(key))[0].dirty===false);
  assert.equal(remote.get('task-1').done,false);
  remote.set('task-1',{...remote.get('task-1'),done:true,updatedAt:Date.now()-500,dirty:false});
  await windowHandlers.focus();
  assert.equal(JSON.parse(storage.get(key))[0].done,true);
  documentHandlers.change({target:{dataset:{toggle:'task-1'},checked:false}});
  await waitFor(()=>remote.get('task-1').done===false);
});
