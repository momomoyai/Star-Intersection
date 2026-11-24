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
    createElement(tag){return tag==='canvas'?{width:0,height:0,getContext(){return {drawImage(){},getImageData:()=>({width:this.width,height:this.height,data:new Uint8ClampedArray(0)})};}}:{remove(){}};},
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
  globalThis.Image=class{naturalWidth=854;naturalHeight=722;set src(_value){queueMicrotask(()=>this.onload());}};
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const word=(x,y,text)=>`5\t1\t1\t1\t1\t1\t${x*3}\t${y*3}\t135\t30\t95\t${text}`;
  const tsv=[header,...Array.from({length:24},(_,h)=>word(20,60+h*25,`${String(h).padStart(2,'0')}.00`)),word(150,35,'Senin'),word(150,60+9*25,'Laundry')].join('\n');
  window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{tsv}}),terminate:async()=>{}})};
  await listeners.change({target:{id:'screenshot-file',dataset:{},files:[new Blob(['image'],{type:'image/png'})]}});
  assert.match(app.innerHTML,/Suggested 1 activities from the screenshot/);
  assert.match(app.innerHTML,/Laundry/);
});
