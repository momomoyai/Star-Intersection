import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScreenshotTsv} from '../screenshot-import.js';

const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
function word(x,y,text,confidence=95){return `5\t1\t1\t1\t1\t1\t${x}\t${y}\t45\t10\t${confidence}\t${text}`;}
function sample(){
  const lines=[header];
  ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Ahad'].forEach((day,i)=>lines.push(word(150+i*100,35,day)));
  for(let h=0;h<24;h++)lines.push(word(20,60+h*25,`${String(h).padStart(2,'0')}.00`));
  lines.push(word(150,60+9*25,'Laundry'));
  lines.push(word(250,60+13*25,'Study'));
  lines.push(word(150,60+9*25,'|'));
  return lines.join('\n');
}
test('maps recognized table cells to the selected week',()=>{
  const result=parseScreenshotTsv(sample(),'2026-11-23',854);
  assert.deepEqual(result.activities.map(({date,title,start,end})=>({date,title,start,end})),[
    {date:'2026-11-23',title:'Laundry',start:'09:00',end:'10:00'},
    {date:'2026-11-24',title:'Study',start:'13:00',end:'14:00'}
  ]);
});
test('asks for a clearer image when hourly labels are absent',()=>{
  const result=parseScreenshotTsv([header,word(150,35,'Senin'),word(150,100,'Laundry')].join('\n'),'2026-11-23',854);
  assert.equal(result.activities.length,0);
  assert.match(result.warning,/hourly labels/);
});
test('finds a merged activity in a table with wide image margins',()=>{
  const width=700,height=280,data=new Uint8ClampedArray(width*height*4).fill(255);
  function line(y,left,right){for(let x=left;x<=right;x++){const at=(y*width+x)*4;data[at]=0;data[at+1]=0;data[at+2]=0;}}
  for(let hour=0;hour<=24;hour++){
    const y=30+hour*10;
    line(y,10,110);
    for(let day=0;day<7;day++)if(day!==0||hour===0||hour>=5)line(y,110+day*80,190+day*80);
  }
  const lines=[header];
  for(let hour=0;hour<24;hour++){
    lines.push(word(20,33+hour*10,`${String(hour).padStart(2,'0')}.00`));
    lines.push(word(70,33+hour*10,`${String((hour+1)%24).padStart(2,'0')}.00`));
  }
  lines.push(word(135,55,'Laundry'));
  lines.push(word(620,95,'Rest'));
  const result=parseScreenshotTsv(lines.join('\n'),'2026-11-23',width,{data,width,height});
  assert.deepEqual(result.activities.find(item=>item.title==='Laundry')?.start,'00:00');
  assert.deepEqual(result.activities.find(item=>item.title==='Laundry')?.end,'05:00');
  assert.deepEqual(result.activities.find(item=>item.title==='Rest')?.date,'2026-11-29');
});
