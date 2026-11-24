import test from 'node:test';
import assert from 'node:assert/strict';

test('calendar keeps important events while week planning saves template activities',async()=>{
  const today=new Date();
  const day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const storage=new Map([['star-intersection-data-v1',JSON.stringify([
    {id:'event-1',kind:'event',title:'Important appointment',date:day,start:'10:00',end:'11:00',category:'personal'},
    {id:'activity-1',kind:'activity',title:'Ordinary chore',date:day,start:'08:00',end:'09:00',category:'personal'},
    {id:'template-1',kind:'template',title:'Weekly laundry',weekday:1,start:'14:00',end:'15:00',category:'personal'}
  ])]]);
  const app={innerHTML:'',insertAdjacentHTML(_position,markup){this.innerHTML+=markup;}};
  const listeners={};
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  globalThis.window={STAR_FIREBASE:{},addEventListener(){},scrollTo(){}};
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  globalThis.document={
    body:{appendChild(){}},
    querySelector(selector){return selector==='#app'?app:null;},
    querySelectorAll(){return [];},
    createElement(){return {remove(){}};},
    addEventListener(type,listener){listeners[type]=listener;}
  };
  globalThis.setInterval=()=>0;
  await import('../app.js');
  assert.match(app.innerHTML,/Ordinary chore/);
  listeners.click({target:{closest:()=>({dataset:{view:'calendar'}})}});
  assert.match(app.innerHTML,/Important appointment/);
  assert.doesNotMatch(app.innerHTML,/Ordinary chore/);
  listeners.click({target:{closest:()=>({dataset:{action:'mascot-plan'}})}});
  assert.match(app.innerHTML,/Week draft/);
  listeners.click({target:{closest:()=>({dataset:{action:'apply-template'}})}});
  assert.match(app.innerHTML,/Weekly laundry/);
  listeners.click({target:{closest:()=>({dataset:{action:'save-plan'}})}});
  const saved=JSON.parse(storage.get('star-intersection-data-v1'));
  assert.equal(saved.filter(entry=>entry.kind==='activity'&&entry.title==='Weekly laundry').length,1);
  assert.equal(saved.find(entry=>entry.id==='event-1').kind,'event');
});
