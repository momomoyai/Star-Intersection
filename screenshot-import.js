const DAY_NAMES = [
  ['mon','monday','senin'],
  ['tue','tuesday','selasa'],
  ['wed','wednesday','rabu'],
  ['thu','thursday','kamis'],
  ['fri','friday','jumat',"jum'at"],
  ['sat','saturday','sabtu'],
  ['sun','sunday','ahad','minggu']
];

function dateAt(start, offset) {
  const date = new Date(start+'T12:00:00');
  date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function cleanTitle(value) {
  return value.replace(/[|¦\[\]{}]/g,' ').replace(/\s+/g,' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu,'').trim();
}

function hourFrom(value) {
  const match=value.replace(/[Oo]/g,'0').match(/(?:^|[^0-9])(\d{1,2})[.,:]\s*00(?:\D|$)/);
  if(!match)return null;
  const hour=Number(match[1]);
  return hour>=0&&hour<24?hour:null;
}

/**
 * Reads word locations from Tesseract's TSV result. A table screenshot can
 * contain merged cells, so each recognized row becomes a one-hour suggestion.
 * The user reviews and edits these suggestions before saving.
 */
function darkPixel(image,x,y){
  const at=(y*image.width+x)*4;
  return image.data[at+3]>100&&image.data[at]<120&&image.data[at+1]<120&&image.data[at+2]<120;
}

function horizontalRule(image,y,left,right){
  if(y<0||y>=image.height)return false;
  let dark=0,total=0;
  const from=Math.max(0,Math.round(left)),to=Math.min(image.width-1,Math.round(right));
  for(let x=from;x<=to;x+=2){dark+=Number(darkPixel(image,x,y));total++;}
  return total>8&&dark/total>.72;
}

function tableGrid(image,firstHourY,timeLeft,leftEdge,centers,columnStep){
  const rules=[];
  for(let y=0;y<image.height;y++)if(horizontalRule(image,y,timeLeft+5,leftEdge-5)){
    if(!rules.length||y-rules.at(-1)>2)rules.push(y);
  }
  const top=rules.filter(y=>y<firstHourY).at(-1);
  const index=rules.indexOf(top);
  const lines=rules.slice(index,index+25);
  if(index<0||lines.length!==25)return null;
  const columns=Array.from({length:7},(_,day)=>{
    const left=centers[day]-columnStep*.35,right=centers[day]+columnStep*.35;
    const segments=[];let start=0;
    for(let hour=1;hour<24;hour++)if(horizontalRule(image,lines[hour],left,right)){
      segments.push([start,hour]);start=hour;
    }
    segments.push([start,24]);
    return segments;
  });
  return {lines,columns};
}

function activity(date,title,startHour,endHour){
  return {date,title,start:`${String(startHour).padStart(2,'0')}:00`,end:endHour===24?'23:59':`${String(endHour).padStart(2,'0')}:00`,category:'personal',notes:'Suggested from screenshot. Review the title and time.',source:'screenshot'};
}

function validTitle(title){
  return title.length>=3&&!/^\d{1,2}[.:]\d{2}/.test(title)&&!/^time$/i.test(title);
}

export function parseScreenshotTsv(tsv, weekStart, imageWidth, gridImage=null, ocrScale=1) {
  const words=tsv.split(/\r?\n/).slice(1).map(line=>{
    const parts=line.split('\t');
    if(parts.length<12||parts[0]!=='5')return null;
    return {x:Number(parts[6])/ocrScale,y:Number(parts[7])/ocrScale,w:Number(parts[8])/ocrScale,h:Number(parts[9])/ocrScale,confidence:Number(parts[10]),text:parts.slice(11).join(' ').trim()};
  }).filter(w=>w&&w.text&&Number.isFinite(w.x)&&Number.isFinite(w.y));
  const width=imageWidth||Math.max(1,...words.map(w=>w.x+w.w));
  const timeWords=words.map(w=>({...w,hour:hourFrom(w.text)})).filter(w=>w.hour!=null&&w.x<width*.35);
  const timeLeft=Math.min(...timeWords.map(w=>w.x));
  const labelWords=timeWords.filter(w=>w.x<=timeLeft+width*.035);
  const timeColumns=timeWords.filter(w=>w.x<=timeLeft+width*.1);
  const inferredLeft=timeColumns.length?Math.max(...timeColumns.map(w=>w.x+w.w))+width*.012:width*.145;
  const contentWords=words.filter(w=>w.x>=inferredLeft&&w.y>width*.05);
  const inferredRight=contentWords.length?Math.min(width,Math.max(...contentWords.map(w=>w.x+w.w))+width*.012):width*.975;
  const headers=words.filter(w=>w.y<Math.max(90,width*.12)).map(w=>{
    const label=w.text.toLowerCase().replace(/[^a-z']/g,'');
    return {day:DAY_NAMES.findIndex(names=>names.includes(label)),x:w.x+w.w/2,y:w.y};
  }).filter(h=>h.day>=0);
  let centers=Array.from({length:7},(_,day)=>headers.find(h=>h.day===day)?.x);
  if(centers.filter(Number.isFinite).length<5)centers=Array.from({length:7},(_,day)=>inferredLeft+(inferredRight-inferredLeft)/7*(day+.5));
  else{
    const found=centers.map((x,i)=>Number.isFinite(x)?{x,i}:null).filter(Boolean);
    const step=(found[found.length-1].x-found[0].x)/(found[found.length-1].i-found[0].i);
    centers=centers.map((x,i)=>Number.isFinite(x)?x:found[0].x+(i-found[0].i)*step);
  }
  const columnStep=(centers[6]-centers[0])/6;
  const leftEdge=centers[0]-columnStep*.5;
  const hourCandidates=labelWords.map(w=>({hour:w.hour,y:w.y}));
  const rows=new Map();
  for(const item of hourCandidates)if(!rows.has(item.hour))rows.set(item.hour,item.y);
  const known=[...rows].sort((a,b)=>a[0]-b[0]);
  if(known.length<8)return {activities:[],warning:'Could not find enough hourly labels. Try a clearer screenshot with the time column visible.'};
  const grid=gridImage&&tableGrid(gridImage,rows.get(0)??known[0][1],timeLeft,leftEdge,centers,columnStep);
  if(grid){
    const activities=[];
    for(let day=0;day<7;day++)for(const [start,end] of grid.columns[day]){
      const list=words.filter(w=>w.confidence>=25&&w.x+w.w/2>=centers[day]-columnStep*.48&&w.x+w.w/2<=centers[day]+columnStep*.48&&w.y+w.h/2>=grid.lines[start]&&w.y+w.h/2<grid.lines[end]);
      const title=cleanTitle(list.sort((a,b)=>a.y-b.y||a.x-b.x).map(w=>w.text).filter(text=>!/^[-|+~—–.:]+$/.test(text)).join(' '));
      if(validTitle(title))activities.push(activity(dateAt(weekStart,day),title,start,end));
    }
    activities.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
    return {activities:activities.slice(0,150),warning:activities.length?'Grid boundaries were detected; review text and any unusual times before saving.':'No activities recognized. Try a sharper screenshot.'};
  }
  const hours=Array.from({length:24},(_,hour)=>{
    if(rows.has(hour))return rows.get(hour);
    const before=known.filter(([h])=>h<hour).at(-1),after=known.find(([h])=>h>hour);
    if(before&&after)return before[1]+(after[1]-before[1])*(hour-before[0])/(after[0]-before[0]);
    if(before)return before[1]+(hour-before[0])*((known.at(-1)[1]-known[0][1])/(known.at(-1)[0]-known[0][0]));
    return after[1]-(after[0]-hour)*((known.at(-1)[1]-known[0][1])/(known.at(-1)[0]-known[0][0]));
  });
  const step=(hours[23]-hours[0])/23;
  const cells=new Map();
  for(const word of words){
    if(word.confidence<25||word.x<leftEdge||word.y<hours[0]-5||word.y>hours[23]+step)continue;
    const day=Math.round((word.x+word.w/2-centers[0])/columnStep);
    if(day<0||day>6||Math.abs(word.x+word.w/2-centers[day])>columnStep*.52)continue;
    const mid=word.y+Math.min(word.h,20)/2;
    let hour=0;while(hour<23&&mid>=(hours[hour]+hours[hour+1])/2)hour++;
    if(/^[|+~—–.\-:]+$/.test(word.text))continue;
    const key=`${day}:${hour}`;
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(word);
  }
  const activities=[];
  for(const [key,list] of cells){
    const [day,hour]=key.split(':').map(Number);
    const title=cleanTitle(list.sort((a,b)=>a.y-b.y||a.x-b.x).map(w=>w.text).join(' '));
    if(!validTitle(title))continue;
    const start=`${String(hour).padStart(2,'0')}:00`,end=`${String(Math.min(hour+1,23)).padStart(2,'0')}:${hour===23?'59':'00'}`;
    activities.push({date:dateAt(weekStart,day),title,start,end,category:'personal',notes:'Suggested from screenshot. Review the title and time.',source:'screenshot'});
  }
  activities.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  return {activities:activities.slice(0,150),warning:activities.length?'Merged cells and OCR can shift titles or times. Review every suggestion.':'No activities recognized. Try a sharper screenshot with day names and hourly labels visible.'};
}
