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
