import { parseScreenshotTsv } from './screenshot-import.js';

const APP_VERSION = '0.2.1';
const STORAGE = 'star-intersection-data-v1';
const AUTH_STORAGE = 'star-intersection-auth-v1';
const OWNER_STORAGE = 'star-intersection-sync-owner-v1';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CATEGORIES = ['study', 'work', 'personal', 'health', 'other'];
const ICONS = {today:'◉', week:'▦', calendar:'▦', inbox:'☰', settings:'⚙'};
const app = document.querySelector('#app');

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE));
    return Array.isArray(parsed) ? parsed.map(entry => {
      if (entry.kind === 'event' && (!entry.date && entry.weekdays?.length || entry.notes?.startsWith('Transcribed from the shared timetable'))) {
        return {...entry, kind:'activity', dirty:true, updatedAt:Date.now()};
      }
      return entry;
    }) : [];
  } catch { return []; }
}
const state = {
  entries: loadData(), view: 'today', selectedDate: localDate(new Date()),
  weekStart: startOfWeek(new Date()), monthDate: firstOfMonth(new Date()),
  calendarMode: 'month', inboxFilter: 'open', modal: null, syncStatus: '',
  auth: JSON.parse(localStorage.getItem(AUTH_STORAGE) || 'null'), syncing: false,
  mascotOpen: false, planWeekStart: startOfWeek(addDays(new Date(),7)), planDraft: null,
  planOriginalIds: [], planEditing: null, planAddDate:'', planTab:'week', templateEditing:null, planDirty:false,
  importStatus:''
};

function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseDate(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(d,n) { const out = new Date(d); out.setDate(out.getDate()+n); return out; }
function startOfWeek(d) { const out = new Date(d); out.setDate(out.getDate() - ((out.getDay()+6)%7)); out.setHours(0,0,0,0); return out; }
function firstOfMonth(d) { return new Date(d.getFullYear(),d.getMonth(),1); }
function prettyDate(d, options={weekday:'long',month:'long',day:'numeric'}) { return new Intl.DateTimeFormat('en-US', options).format(d); }
function monthLabel(d) { return prettyDate(d,{month:'long',year:'numeric'}); }
function shortTime(t) { if(!t) return ''; const [h,m]=t.split(':').map(Number); return `${(h%12)||12}${m?':'+String(m).padStart(2,'0'):''} ${h<12?'AM':'PM'}`; }
function esc(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function id() { return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function activeEntries() { return state.entries.filter(e=>!e.deleted); }
function byDate(date) { return activeEntries().filter(e=>e.kind==='event'&&e.date===date || e.kind==='task'&&e.dueDate===date); }
function eventsOn(date) { return byDate(date).filter(e=>e.kind==='event').sort((a,b)=>(a.start||'').localeCompare(b.start||'')); }
function activitiesOn(date) { const day=parseDate(date).getDay();return activeEntries().filter(e=>e.kind==='activity'&&(e.date===date||!e.date&&e.weekdays?.includes(day))).sort((a,b)=>(a.start||'').localeCompare(b.start||'')); }
function scheduleOn(date) { return [...eventsOn(date),...activitiesOn(date)].sort((a,b)=>(a.start||'').localeCompare(b.start||'')); }
function tasksOn(date) { return byDate(date).filter(e=>e.kind==='task').sort((a,b)=>Number(a.done)-Number(b.done)); }
function save() { localStorage.setItem(STORAGE,JSON.stringify(state.entries)); render(); }
function upsert(entry) { const at=state.entries.findIndex(e=>e.id===entry.id); const next={...entry,updatedAt:Date.now(),dirty:true}; if(at<0) state.entries.push(next); else state.entries[at]=next; save(); queueSync(); }
function removeEntry(entry) { if(!confirm(`Delete “${entry.title}”?`)) return; upsert({...entry,deleted:true}); toast('Deleted'); }
function toast(message) { document.querySelector('.toast')?.remove(); const el=document.createElement('div'); el.className='toast'; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),3000); }
function titleForView() { return ({today:'Today',week:'Week',planner:'Plan week',calendar:'Calendar',inbox:'Inbox',settings:'Settings'})[state.view]; }
function navButton(view) { return `<button class="nav-btn ${state.view===view?'active':''}" data-view="${view}"><span class="icon">${ICONS[view]}</span>${view[0].toUpperCase()+view.slice(1)}</button>`; }
function mobileButton(view) { return `<button class="${state.view===view?'active':''}" data-view="${view}"><span>${ICONS[view]}</span>${view[0].toUpperCase()+view.slice(1)}</button>`; }

function render() {
  const today=localDate(new Date());
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">✳</span> Star Intersection</div><nav class="sidebar-nav">${['today','week','calendar','inbox','settings'].map(navButton).join('')}</nav><div class="sidebar-bottom"><div class="side-card"><strong>Everything in its place.</strong><p>Capture a thought now. Give it a date when you're ready.</p><button data-action="new-task">+ Add to Inbox</button></div><div class="side-meta">${syncLabel()}<br>Saved on this device</div></div></aside><main class="main"><header class="topbar"><div class="crumb">YOUR SPACE / ${titleForView()}</div><div class="top-actions"><span class="date-chip">${prettyDate(new Date(),{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span><button class="secondary-button" data-view="settings" title="Settings">⚙</button><button class="primary-button" data-action="new-event">+ New event</button></div></header>${viewContent(today)}</main><nav class="mobile-nav">${['today','week','calendar','inbox','settings'].map(mobileButton).join('')}</nav></div>${state.modal?renderModal():''}`;
  app.insertAdjacentHTML('beforeend',mascotMarkup());
  if(state.view==='settings')document.querySelector('.settings-grid').insertAdjacentHTML('beforeend',reminderCard());
  if(state.view==='week'){
    document.querySelector('.week-toolbar .toolbar-left').insertAdjacentHTML('beforeend','<button class="pill-button" data-action="jump-now">◉ Now</button>');
    const index=Array.from({length:7},(_,i)=>localDate(addDays(state.weekStart,i))).indexOf(today);
    if(index>=0){const line=document.createElement('div');line.className='week-now-line';line.style.top=`${(new Date().getHours()+new Date().getMinutes()/60)*56}px`;document.querySelectorAll('.week-day-column')[index].appendChild(line);}
  }
}
function syncLabel(){if(!configured())return 'Local mode';if(!state.auth)return 'Sync ready · sign in';return state.syncing?'Syncing…':state.syncStatus||'Sync on';}
function viewContent(today){switch(state.view){case 'today':return todayView(today);case 'week':return weekView(today);case 'planner':return plannerView();case 'calendar':return calendarView(today);case 'inbox':return inboxView();case 'settings':return settingsView();}}
function hero(kicker,title,subtitle,actions=''){
  const count=state.view==='today'?`<div class="pulse-strip" aria-label="Today's overview"><button data-view="week"><strong>${eventsOn(localDate(new Date())).length}</strong><span>events today</span><i>↗</i></button><button data-view="inbox"><strong>${activeEntries().filter(e=>e.kind==='task'&&!e.done&&e.dueDate&&e.dueDate<=localDate(new Date())).length}</strong><span>need attention</span><i>↗</i></button><button data-view="inbox"><strong>${activeEntries().filter(e=>e.kind==='task'&&!e.done&&!e.dueDate).length}</strong><span>in your Inbox</span><i>↗</i></button></div>`:'';
  return `<section class="hero"><div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="hero-star">✳</span></div><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-line"></span>${kicker}</div><h1>${title}</h1><p>${subtitle}</p><div class="hero-actions">${actions}</div></div></section>${count}`;
}

function mascotMarkup(){
  const today=localDate(new Date()),now=new Date(),minute=now.getHours()*60+now.getMinutes();
  const due=activeEntries().filter(e=>e.kind==='task'&&!e.done&&e.dueDate&&e.dueDate<=today).length;
  const inbox=activeEntries().filter(e=>e.kind==='task'&&!e.done&&!e.dueDate).length;
  const next=scheduleOn(today).find(e=>{const [h,m]=(e.end||e.start||'23:59').split(':').map(Number);return h*60+m>minute;});
  const start=localDate(startOfWeek(addDays(new Date(),7))),end=localDate(addDays(parseDate(start),6));
  const planned=activeEntries().filter(e=>e.kind==='activity'&&e.date>=start&&e.date<=end).length;
  const templateCount=templates().length;
  const mood=due?'alert':!planned||state.planDirty?'ready':next||inbox?'ready':'calm';
  const title=due?`${due} ${due===1?'task needs':'tasks need'} your attention`:state.planDirty?'Your week draft is waiting':!planned?'Next week needs a first draft':next?`Next: ${esc(next.title)}`:inbox?`${inbox} ${inbox===1?'thought is':'thoughts are'} waiting`:'Your next week has a shape';
  const detail=due?'Review what is due, then return to the week plan.':state.planDirty?'Save the draft when the activities feel right.':!planned?`Start with ${templateCount?templateCount+' reusable activities':'an empty week'}, then edit the hours or import a screenshot.`:next?`Starts ${shortTime(next.start)}. See it in today’s timeline.`:inbox?'Your Inbox keeps them safe until you are ready.':`${planned} scheduled activities are ready for next week. You can still adjust them.`;
  const primaryAction=due?'mascot-inbox':state.planDirty||!planned||!next&&!inbox?'mascot-plan':next?'mascot-today':'mascot-inbox';
  const primaryLabel=due?'Review tasks':state.planDirty?'Finish week draft':!planned?'Plan next week':next?'Open Today':inbox?'Open Inbox':'Review week';
  return `<aside class="mascot-dock ${state.mascotOpen?'is-open':''}" aria-label="Orbit, your planning companion">${state.mascotOpen?`<div class="mascot-panel" id="mascot-panel"><div class="mascot-panel-top"><span class="mascot-kicker">✦ ORBIT SAYS</span><button type="button" class="mascot-close" data-action="mascot-toggle" aria-label="Close Orbit panel">×</button></div><strong>${title}</strong><p>${detail}</p><div class="mascot-actions"><button type="button" data-action="${primaryAction}">${primaryLabel}</button>${primaryAction!=='mascot-plan'?'<button type="button" data-action="mascot-plan">Plan next week</button>':''}<button type="button" data-action="mascot-capture">Capture thought</button></div></div>`:''}<button type="button" class="mascot-trigger mood-${mood}" data-action="mascot-toggle" aria-label="${state.mascotOpen?'Close':'Open'} Orbit planning companion" aria-controls="mascot-panel" aria-expanded="${state.mascotOpen}"><span class="mascot-ring" aria-hidden="true"></span><svg viewBox="0 0 120 120" aria-hidden="true"><path class="mascot-body" d="M60 8 74 39 108 47 84 70 90 107 60 90 30 107 36 70 12 47 46 39Z"/><circle class="mascot-cheek" cx="43" cy="70" r="5"/><circle class="mascot-cheek" cx="77" cy="70" r="5"/><circle class="mascot-eye" cx="50" cy="56" r="3.8"/><circle class="mascot-eye" cx="70" cy="56" r="3.8"/><path class="mascot-mouth" d="M52 68 Q60 77 68 68"/></svg><span class="mascot-spark" aria-hidden="true">✦</span><span class="mascot-label">Orbit</span></button></aside>`;
}

function todayView(today){
  const events=scheduleOn(today); const now=new Date(); const current=now.getHours()*60+now.getMinutes();
  const next=events.find(e=>{const [h,m]=(e.end||e.start||'23:59').split(':').map(Number);return h*60+m>current;});
  const due=activeEntries().filter(e=>e.kind==='task'&&!e.done&&e.dueDate&&e.dueDate<=today).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const inbox=activeEntries().filter(e=>e.kind==='task'&&!e.done&&!e.dueDate).sort((a,b)=>b.updatedAt-a.updatedAt);
  const greeting=now.getHours()<12?'Good morning':now.getHours()<17?'Good afternoon':'Good evening';
  return `${hero(prettyDate(now,{weekday:'long',month:'long',day:'numeric'}),`${greeting}.`,'A clear look at what matters today.',`<button class="secondary-button" data-action="new-task">+ Capture a thought</button>`)}<div class="grid-main"><div class="section-stack"><section class="card next-card"><div class="next-label">${next?'UP NEXT':'SPACE TO BREATHE'}</div>${next?`<div class="next-title">${esc(next.title)}</div><div class="next-meta">◷ ${shortTime(next.start)}${next.end?' – '+shortTime(next.end):''} · ${esc(cap(next.category))}</div>`:`<div class="next-empty">No more timed plans today.</div><p>Use this space for something important to you.</p>`}</section><section class="card card-pad"><div class="card-header"><div><h2>Today's timeline</h2><p>${events.length} timed ${events.length===1?'block':'blocks'}</p></div><button class="text-button" data-view="week">See week →</button></div>${events.length?`<div class="list">${events.map(eventRow).join('')}</div>`:`<div class="empty">Nothing scheduled yet. Add an activity in Week or an important event on Calendar.</div>`}</section></div><div class="section-stack"><section class="card card-pad"><div class="card-header"><div><h2>Needs attention</h2><p>Due today or overdue</p></div><button class="text-button" data-view="inbox">All tasks →</button></div>${due.length?`<div class="list">${due.slice(0,6).map(taskRow).join('')}</div>`:'<div class="empty">All clear. Your deadlines are handled.</div>'}</section><section class="card card-pad"><div class="card-header"><div><h2>Quick capture</h2><p>Save it now, sort it later</p></div></div><form class="quick-form" id="quick-form"><input name="title" placeholder="Something I need to remember…" required autocomplete="off"><button aria-label="Add to Inbox">+</button></form><p style="font-size:12px;color:#89958a;margin:14px 0 0">${inbox.length} ${inbox.length===1?'thought':'thoughts'} in your Inbox</p></section></div></div>`;
}
function eventRow(e){return `<div class="list-row"><span class="time-badge">${shortTime(e.start)}</span><span class="category-dot cat-${esc(e.category||'other')}"></span><div class="item-main"><strong>${esc(e.title)}</strong><small>${e.kind==='event'?'Important event':'Weekly activity'} · ${e.end?shortTime(e.start)+' – '+shortTime(e.end):'All day'}${e.notes?' · '+esc(e.notes):''}</small></div><div class="item-actions"><button class="mini-btn" data-edit="${esc(e.id)}" title="Edit">✎</button></div></div>`;}
function taskRow(e){return `<div class="list-row"><input class="checkbox" type="checkbox" data-toggle="${esc(e.id)}" ${e.done?'checked':''} aria-label="Complete ${esc(e.title)}"><div class="item-main"><strong class="${e.done?'done':''}">${esc(e.title)}</strong><small class="${e.dueDate&&e.dueDate<localDate(new Date())&&!e.done?'overdue':''}">${e.dueDate?prettyDate(parseDate(e.dueDate),{month:'short',day:'numeric',year:'numeric'}):'No date'}${e.notes?' · '+esc(e.notes):''}</small></div><div class="item-actions"><button class="mini-btn" data-edit="${esc(e.id)}" title="Edit">✎</button></div></div>`;}

function weekView(today){
  const start=state.weekStart; const end=addDays(start,6); const dates=Array.from({length:7},(_,i)=>localDate(addDays(start,i)));
  const heads=dates.map(d=>`<div class="week-head ${d===today?'today':''}">${DAYS[parseDate(d).getDay()]}<strong>${parseDate(d).getDate()}</strong></div>`).join('');
  const hours=Array.from({length:24},(_,h)=>`<div class="week-time">${String(h).padStart(2,'0')}:00</div>`).join('');
  const columns=dates.map(d=>`<div class="week-day-column"><div class="week-cell-grid">${Array.from({length:24},(_,h)=>`<div class="week-slot" data-add-date="${d}" data-add-time="${String(h).padStart(2,'0')}:00"></div>`).join('')}</div><div class="week-events-layer">${layoutWeekEvents(scheduleOn(d).filter(e=>e.start))}</div></div>`).join('');
  const tasks=dates.flatMap(d=>tasksOn(d).map(e=>({date:d,entry:e}))).filter(x=>!x.entry.done);
  return `${hero('TIME, AT A GLANCE','Your week.','Activities and important events, together by the hour.',`<button class="secondary-button" data-action="plan-week">✦ Plan shown week</button><button class="secondary-button" data-action="plan-upcoming">Plan upcoming week →</button>`)}<section class="card card-pad"><div class="week-toolbar"><div class="toolbar-left"><button class="icon-button" data-action="prev-week" aria-label="Previous week">←</button><button class="icon-button" data-action="next-week" aria-label="Next week">→</button><button class="pill-button" data-action="this-week">This week</button></div><div class="toolbar-title">${prettyDate(start,{month:'short',day:'numeric'})} – ${prettyDate(end,{month:'short',day:'numeric',year:'numeric'})}</div></div><div class="week-scroll"><div class="week-grid"><div class="week-head">TIME</div>${heads}<div class="week-hours">${hours}</div>${columns}</div></div></section>${tasks.length?`<section class="card card-pad" style="margin-top:18px"><div class="card-header"><h2>Due this week</h2></div><div class="list">${tasks.map(x=>taskRow(x.entry)).join('')}</div></section>`:''}`;
}
function minutes(time){const [hour,minute]=(time||'00:00').split(':').map(Number);return hour*60+minute;}
function layoutWeekEvents(entries){
  const groups=[];let group=[],groupEnd=0;
  for(const entry of entries){const start=minutes(entry.start),end=minutes(entry.end||entry.start)+1;if(group.length&&start>=groupEnd){groups.push(group);group=[];}group.push(entry);groupEnd=Math.max(groupEnd,end);}
  if(group.length)groups.push(group);
  return groups.map(items=>{const lanes=[];const laid=items.map(entry=>{const start=minutes(entry.start),end=minutes(entry.end||entry.start)+1;let lane=lanes.findIndex(until=>until<=start);if(lane<0)lane=lanes.length;lanes[lane]=end;return {entry,lane};});return laid.map(({entry,lane})=>weekEvent(entry,lane,lanes.length)).join('');}).join('');
}
function weekEvent(e,lane=0,count=1){const [h,m]=e.start.split(':').map(Number);const [eh,em]=(e.end||e.start).split(':').map(Number);const top=h*56+m/60*56;const height=Math.max(27,(eh*60+em-h*60-m)/60*56-3);return `<button class="week-event ${e.kind==='event'?'important-event':''} cat-${esc(e.category||'other')}" style="top:${top}px;height:${height}px;left:calc(${lane*100/count}% + 3px);width:calc(${100/count}% - 6px);right:auto" data-edit="${esc(e.id)}" title="${esc(e.title)}">${e.kind==='event'?'✦ ':''}${esc(e.title)}<br><span style="font-weight:500">${shortTime(e.start)}${e.end?'–'+shortTime(e.end):''}</span></button>`;}

function templates(){return activeEntries().filter(e=>e.kind==='template').sort((a,b)=>((a.weekday+6)%7)-((b.weekday+6)%7)||(a.start||'').localeCompare(b.start||''));}
function openPlanner(start=state.planWeekStart){
  if(state.planDraft&&localDate(startOfWeek(start))===localDate(state.planWeekStart)){state.view='planner';state.mascotOpen=false;render();return;}
  if(state.planDirty&&!confirm('Discard the unsaved week draft?'))return;
  state.planWeekStart=startOfWeek(start);
  const first=localDate(state.planWeekStart),last=localDate(addDays(state.planWeekStart,6));
  const current=activeEntries().filter(e=>e.kind==='activity'&&e.date>=first&&e.date<=last);
  state.planDraft=current.map(e=>({id:e.id,date:e.date,title:e.title,start:e.start,end:e.end,category:e.category||'personal',notes:e.notes||'',templateId:e.templateId||''}));
  state.planOriginalIds=current.map(e=>e.id);
  state.planEditing=null;state.planAddDate=first;state.planDirty=false;state.planTab='week';state.importStatus='';state.view='planner';state.mascotOpen=false;render();
}
function planDays(){return Array.from({length:7},(_,i)=>localDate(addDays(state.planWeekStart,i)));}
function planActivityForm(){
  const draft=state.planEditing==null?{}:state.planDraft[state.planEditing]||{};
  const first=state.planAddDate||planDays()[0];
  return `<form id="plan-form" class="form-stack"><div class="card-header"><div><h2>${state.planEditing==null?'Add an activity':'Edit activity'}</h2><p>Shape the week one block at a time</p></div></div><label class="field">Activity<input name="title" value="${esc(draft.title||'')}" placeholder="Laundry, study, lunch…" required maxlength="120"></label><label class="field">Day<select name="date">${planDays().map(d=>`<option value="${d}" ${(draft.date||first)===d?'selected':''}>${prettyDate(parseDate(d),{weekday:'long',month:'short',day:'numeric'})}</option>`).join('')}</select></label><div class="field-row"><label class="field">From<input type="time" name="start" value="${esc(draft.start||'09:00')}" required></label><label class="field">To<input type="time" name="end" value="${esc(draft.end||'10:00')}" required></label></div><label class="field">Category<select name="category">${CATEGORIES.map(c=>`<option value="${c}" ${(draft.category||'personal')===c?'selected':''}>${cap(c)}</option>`).join('')}</select></label><label class="field">Notes<textarea name="notes" placeholder="Optional detail">${esc(draft.notes||'')}</textarea></label><div class="settings-actions"><button class="primary-button" type="submit">${state.planEditing==null?'Add to draft':'Update draft'}</button>${state.planEditing!=null?'<button class="secondary-button" type="button" data-action="plan-cancel-edit">Cancel</button>':''}</div></form>`;
}
function templateForm(){
  const e=state.templateEditing?state.entries.find(x=>x.id===state.templateEditing)||{}:{};
  return `<form id="template-form" class="form-stack"><h2>${e.id?'Edit template activity':'New template activity'}</h2><p class="muted">A template is a reusable starting point. Applying it creates editable blocks for the selected week.</p><label class="field">Activity<input name="title" value="${esc(e.title||'')}" placeholder="A regular chore or routine" required maxlength="120"></label><label class="field">Usual day<select name="weekday">${[1,2,3,4,5,6,0].map(d=>`<option value="${d}" ${Number(e.weekday??1)===d?'selected':''}>${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]}</option>`).join('')}</select></label><div class="field-row"><label class="field">From<input type="time" name="start" value="${esc(e.start||'09:00')}" required></label><label class="field">To<input type="time" name="end" value="${esc(e.end||'10:00')}" required></label></div><label class="field">Category<select name="category">${CATEGORIES.map(c=>`<option value="${c}" ${(e.category||'personal')===c?'selected':''}>${cap(c)}</option>`).join('')}</select></label><label class="field">Notes<textarea name="notes">${esc(e.notes||'')}</textarea></label><div class="settings-actions"><button class="primary-button" type="submit">Save template</button>${e.id?'<button class="secondary-button" type="button" data-action="template-cancel">Cancel edit</button>':''}</div></form>`;
}
function plannerView(){
  const first=state.planWeekStart,last=addDays(first,6),days=planDays();
  const eventCount=days.reduce((sum,d)=>sum+eventsOn(d).length,0);
  const count=state.planDraft.length;
  const top=`${hero('THE WEEK STUDIO','Make next week yours.','Build an hourly plan, then keep the important events in view.',`<button class="secondary-button" data-view="week">View hourly week →</button>`)}<div class="planner-top card card-pad"><div class="planner-week-picker"><button class="icon-button" data-action="plan-prev" aria-label="Previous planning week">←</button><div><strong>${prettyDate(first,{month:'short',day:'numeric'})} – ${prettyDate(last,{month:'short',day:'numeric',year:'numeric'})}</strong><small>${count} activities in draft · ${eventCount} important events already on Calendar</small></div><button class="icon-button" data-action="plan-next" aria-label="Next planning week">→</button><button class="pill-button" data-action="plan-upcoming">Upcoming week</button></div><div class="planner-tabs"><button class="${state.planTab==='week'?'active':''}" data-plan-tab="week">Week draft</button><button class="${state.planTab==='template'?'active':''}" data-plan-tab="template">Reusable template <span>${templates().length}</span></button></div></div>`;
  if(state.planTab==='template')return `${top}<div class="planner-layout"><section class="card card-pad"><div class="card-header"><div><h2>Your regular activities</h2><p>Edit them here; planned weeks stay as they were saved.</p></div><button class="secondary-button" data-action="apply-template">+ Add template to draft</button></div>${templates().length?`<div class="planner-list">${templates().map(e=>`<div class="planner-item"><div><small>${DAYS[e.weekday]} · ${shortTime(e.start)}–${shortTime(e.end)}</small><strong>${esc(e.title)}</strong><span>${esc(cap(e.category||'personal'))}</span></div><button class="mini-btn" data-template-edit="${esc(e.id)}" aria-label="Edit ${esc(e.title)}">✎</button><button class="mini-btn" data-template-remove="${esc(e.id)}" aria-label="Delete ${esc(e.title)}">×</button></div>`).join('')}</div>`:'<div class="empty">Add a regular chore, class, or routine to reuse it each week.</div>'}</section><aside class="card card-pad planner-editor">${templateForm()}</aside></div>`;
  return `${top}<div class="planner-layout"><section class="card card-pad"><div class="planner-intro"><div><h2>Week draft</h2><p>Calendar events are included below automatically. Your draft activities can be changed before saving.</p></div><div class="planner-toolbox"><button class="secondary-button" data-action="apply-template">✦ Add template</button><button class="secondary-button" data-action="choose-screenshot">▧ Import screenshot</button><input id="screenshot-file" type="file" accept="image/*" hidden></div></div>${state.importStatus?`<div class="status">${esc(state.importStatus)}</div>`:''}<div class="planner-days">${days.map(d=>{const blocks=state.planDraft.map((item,index)=>({...item,index})).filter(item=>item.date===d).sort((a,b)=>a.start.localeCompare(b.start));const events=eventsOn(d);return `<section class="planner-day"><div class="planner-day-heading"><strong>${prettyDate(parseDate(d),{weekday:'long',month:'short',day:'numeric'})}</strong><button class="text-button" data-plan-add="${d}">+ Activity</button></div>${events.map(e=>`<div class="planner-item planner-calendar"><div><small>✦ Important event · ${shortTime(e.start)}–${shortTime(e.end)}</small><strong>${esc(e.title)}</strong></div><button class="mini-btn" data-edit="${esc(e.id)}" aria-label="Edit event">✎</button></div>`).join('')}${blocks.map(e=>`<div class="planner-item ${state.planEditing===e.index?'selected':''}"><div><small>${shortTime(e.start)}–${shortTime(e.end)} · ${esc(cap(e.category))}${e.source==='screenshot'?' · from screenshot':''}</small><strong>${esc(e.title)}</strong></div><button class="mini-btn" data-plan-edit="${e.index}" aria-label="Edit ${esc(e.title)}">✎</button><button class="mini-btn" data-plan-remove="${e.index}" aria-label="Remove ${esc(e.title)}">×</button></div>`).join('')}${!events.length&&!blocks.length?'<div class="planner-blank">An open day. Add something when you are ready.</div>':''}</section>`}).join('')}</div><div class="planner-save"><span>${state.planDirty?'Unsaved changes':'Draft matches saved schedule'}</span><button class="primary-button" data-action="save-plan" ${!state.planDirty?'disabled':''}>Save this week</button></div></section><aside class="card card-pad planner-editor">${planActivityForm()}</aside></div>`;
}
function applyTemplate(){
  const list=templates(),days=planDays();
  let added=0;
  for(const t of list){if(state.planDraft.some(e=>e.templateId===t.id))continue;const date=days.find(d=>parseDate(d).getDay()===t.weekday);if(!date)continue;state.planDraft.push({id:id(),kind:'activity',title:t.title,date,start:t.start,end:t.end,category:t.category,notes:t.notes||'',templateId:t.id});added++;}
  if(added)state.planDirty=true;state.planTab='week';render();toast(added?`Added ${added} template activities to draft`:'Template activities are already in this draft');
}
let tesseractPromise;
function loadScreenshotImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);image.naturalWidth&&image.naturalHeight?resolve(image):reject(Error('Image has no readable pixels.'));};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image could not be opened. Try exporting it as PNG or JPEG.'));};
    image.src=url;
  });
}
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(!tesseractPromise)tesseractPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>resolve(window.Tesseract);script.onerror=()=>reject(Error('OCR could not load. Connect to the internet and try again.'));document.head.appendChild(script);}).catch(err=>{tesseractPromise=null;throw err;});
  return tesseractPromise;
}
async function importScreenshot(file){
  if(!file.type.startsWith('image/')){toast('Choose an image screenshot');return;}
  if(file.size>12_000_000){toast('Choose an image smaller than 12 MB');return;}
  const week=localDate(state.planWeekStart);
  state.importStatus='Reading screenshot in this browser…';render();
  let worker;
  try{
    const Tesseract=await loadTesseract();
    const image=await loadScreenshotImage(file);
    const gridCanvas=document.createElement('canvas');gridCanvas.width=image.naturalWidth;gridCanvas.height=image.naturalHeight;
    const gridContext=gridCanvas.getContext('2d',{willReadFrequently:true});if(!gridContext)throw Error('Canvas is unavailable in this browser.');
    gridContext.drawImage(image,0,0);
    const gridImage=gridContext.getImageData(0,0,gridCanvas.width,gridCanvas.height);
    const scale=Math.min(3,3000/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    const context=canvas.getContext('2d');if(!context)throw Error('Canvas is unavailable in this browser.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    worker=await Tesseract.createWorker('eng');
    const result=await worker.recognize(canvas,{}, {tsv:true});
    const {activities,warning}=parseScreenshotTsv(result.data.tsv||'',week,image.naturalWidth,gridImage,canvas.width/image.naturalWidth);
    if(localDate(state.planWeekStart)!==week)return;
    let added=0;
    for(const item of activities){if(state.planDraft.some(e=>e.date===item.date&&e.start===item.start&&e.title.toLowerCase()===item.title.toLowerCase()))continue;state.planDraft.push({id:id(),kind:'activity',...item});added++;}
    if(added)state.planDirty=true;
    state.importStatus=`Suggested ${added} activities from the screenshot. ${warning}`;
    render();
  }catch(err){state.importStatus=`Screenshot import failed: ${err.message}`;render();}
  finally{if(worker)await worker.terminate();}
}
function savePlanWeek(){
  if(!state.planDirty){toast('No changes to save');return;}
  const ids=new Set(state.planDraft.map(e=>e.id)),now=Date.now();
  for(const oldId of state.planOriginalIds){if(ids.has(oldId))continue;const at=state.entries.findIndex(e=>e.id===oldId);if(at>=0)state.entries[at]={...state.entries[at],deleted:true,updatedAt:now,dirty:true};}
  for(const draft of state.planDraft){const at=state.entries.findIndex(e=>e.id===draft.id);const next={...draft,kind:'activity',deleted:false,updatedAt:now,dirty:true};delete next.source;if(at<0)state.entries.push(next);else state.entries[at]=next;}
  state.planOriginalIds=[...ids];state.planDirty=false;save();queueSync();toast('Week schedule saved');
}

function calendarView(today){
  const month=state.monthDate; const selected=state.selectedDate; const chosen=byDate(selected);
  return `${hero('THE BIG PICTURE','Make room for what’s ahead.','Choose a day to see its events, deadlines, and details.',`<button class="secondary-button" data-action="new-task">+ Add task</button>`)}<div class="calendar-toolbar"><div class="toolbar-left"><button class="icon-button" data-action="prev-month">←</button><button class="icon-button" data-action="next-month">→</button><button class="pill-button" data-action="this-month">Today</button><span class="toolbar-title">${state.calendarMode==='year'?month.getFullYear():monthLabel(month)}</span></div><div class="segmented"><button data-calendar-mode="month" class="${state.calendarMode==='month'?'active':''}">Month</button><button data-calendar-mode="year" class="${state.calendarMode==='year'?'active':''}">Year</button></div></div>${state.calendarMode==='year'?yearView(today):`<div class="calendar-layout"><section class="card card-pad">${monthGrid(month,today)}</section><section class="card card-pad"><div class="card-header"><div><h2>${prettyDate(parseDate(selected),{weekday:'long',month:'long',day:'numeric'})}</h2><p>${chosen.length} ${chosen.length===1?'item':'items'} on this day</p></div><button class="text-button" data-add-date="${selected}">+ Add</button></div>${chosen.length?`<div class="list">${eventsOn(selected).map(eventRow).join('')}${tasksOn(selected).map(taskRow).join('')}</div>`:'<div class="empty">A blank day is yours to shape.</div>'}</section></div>`}`;
}
function monthGrid(month,today){const first=new Date(month.getFullYear(),month.getMonth(),1);const start=addDays(first,-((first.getDay()+6)%7));const cells=Array.from({length:42},(_,i)=>{const d=addDays(start,i),key=localDate(d),items=byDate(key);return `<button class="day-cell ${key===today?'today':''} ${key===state.selectedDate?'selected':''} ${d.getMonth()!==month.getMonth()?'outside':''}" data-date="${key}"><span class="day-num">${d.getDate()}</span><span class="day-dots">${items.slice(0,3).map(()=>'<i></i>').join('')}</span>${items.length?`<span class="day-count">${items.length} ${items.length===1?'item':'items'}</span>`:''}</button>`}).join('');return `<div class="calendar-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('')}${cells}</div>`;}
function yearView(today){const year=state.monthDate.getFullYear();return `<section class="card card-pad"><div class="year-grid">${Array.from({length:12},(_,i)=>miniMonth(new Date(year,i,1),today)).join('')}</div></section>`;}
function miniMonth(month,today){const first=new Date(month.getFullYear(),month.getMonth(),1),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),offset=(first.getDay()+6)%7;return `<div class="mini-month"><h3>${prettyDate(month,{month:'long'})}</h3><div class="mini-grid">${['M','T','W','T','F','S','S'].map(d=>`<span>${d}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:days},(_,i)=>{const d=localDate(new Date(month.getFullYear(),month.getMonth(),i+1));return `<button class="${byDate(d).length?'has-items':''} ${d===today?'today':''}" data-date="${d}" title="${byDate(d).length} items">${i+1}</button>`}).join('')}</div></div>`;}

function inboxView(){const all=activeEntries().filter(e=>e.kind==='task');const visible=all.filter(e=>state.inboxFilter==='all'||(state.inboxFilter==='open'&&!e.done)||(state.inboxFilter==='done'&&e.done)||(state.inboxFilter==='undated'&&!e.dueDate&&!e.done)).sort((a,b)=>Number(a.done)-Number(b.done)||String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))||b.updatedAt-a.updatedAt);return `${hero('A HOME FOR EVERY THOUGHT','Your Inbox.','Write it down before it slips away. You can organize it later.',`<button class="secondary-button" data-action="new-task">+ Add a task</button>`)}<div class="inbox-layout"><section class="card card-pad"><div class="card-header"><div><h2>Tasks & notes</h2><p>${all.filter(e=>!e.done).length} open · ${all.filter(e=>e.done).length} completed</p></div></div><div class="filter-row">${['open','undated','done','all'].map(f=>`<button class="filter-chip ${state.inboxFilter===f?'active':''}" data-filter="${f}">${({open:'Open',undated:'Undated',done:'Done',all:'All'})[f]}</button>`).join('')}</div>${visible.length?`<div class="list">${visible.map(taskRow).join('')}</div>`:'<div class="empty">Nothing here yet. A clear mind starts with a quick note.</div>'}</section><section class="inbox-hero"><h2>Catch the small things.</h2><p>That idea, errand, question, or promise to yourself belongs here. A date is optional.</p><form class="quick-form" id="quick-form"><input name="title" placeholder="I'll do this later…" required autocomplete="off"><button aria-label="Add to Inbox">+</button></form></section></div>`;}

function configured(){const c=window.STAR_FIREBASE;return !!(c?.apiKey&&c?.projectId&&!c.apiKey.includes('YOUR_')&&!c.projectId.includes('YOUR_'));}
function reminderCard(){const supported='Notification' in window;const enabled=localStorage.getItem('star-reminder-enabled')==='yes';const time=localStorage.getItem('star-reminder-time')||'19:00';return `<section class="card card-pad"><div class="card-header"><div><h2>Daily review reminder</h2><p>A small nudge to check tomorrow and your Inbox</p></div></div>${supported?`<div class="form-stack"><label class="field">Reminder time<input id="reminder-time" type="time" value="${time}"></label><div class="settings-actions"><button class="${enabled?'secondary-button':'primary-button'}" data-action="${enabled?'disable-reminder':'enable-reminder'}">${enabled?'Turn off reminder':'Enable reminder'}</button></div><p class="muted" style="font-size:12px;margin:0">Works while this app is open. Browser notification permission is required.</p></div>`:'<div class="status warn">This browser does not support notifications.</div>'}</section>`;}
function settingsView(){return `${hero('MAKE IT YOURS','Settings.','Your data stays available on this device. Connect sync whenever you’re ready.')}<div class="settings-grid"><section class="card card-pad"><div class="card-header"><div><h2>Data & backup</h2><p>Keep a copy you control</p></div></div><div class="form-stack"><p class="muted" style="font-size:13px">${activeEntries().length} items stored in this browser. Export includes events, activities, templates, tasks, and notes.</p><div class="settings-actions"><button class="secondary-button" data-action="export">↓ Export JSON</button><label class="secondary-button" style="cursor:pointer">↑ Import JSON<input id="import-file" type="file" accept="application/json,.json" hidden></label></div><div class="status warn">Import merges by item ID. Keep your export file somewhere safe.</div></div></section><section class="card card-pad"><div class="card-header"><div><h2>Cross-device sync</h2><p>Personal Firebase project</p></div></div>${!configured()?`<div class="status warn">Sync is not configured. Fill <code>.env.local</code>, run <code>node scripts/generate-config.mjs</code>, then reload.</div><p class="muted" style="font-size:12px;margin:13px 0 0">The setup steps and security rules are in README.md.</p>`:state.auth?`<div class="form-stack"><div class="status">Signed in as ${esc(state.auth.email)}. ${esc(syncLabel())}</div><div class="settings-actions"><button class="primary-button" data-action="sync">↻ Sync now</button><button class="secondary-button" data-action="sign-out">Sign out</button></div></div>`:`<form id="auth-form" class="form-stack"><label class="field">Email<input type="email" name="email" required autocomplete="email"></label><label class="field">Password<input type="password" name="password" required minlength="6" autocomplete="current-password"></label><div class="settings-actions"><button class="primary-button" name="mode" value="login">Sign in</button><button class="secondary-button" name="mode" value="signup">Create account</button></div></form>`}${state.syncStatus&&state.syncStatus.startsWith('Error')?`<div class="status error" style="margin-top:12px">${esc(state.syncStatus)}</div>`:''}</section><section class="card card-pad"><div class="card-header"><div><h2>How this works</h2></div></div><p class="muted" style="font-size:13px">Important events appear on Calendar and in Week. Activities fill the hourly Week schedule; reusable templates help you plan. Tasks can have a deadline or stay undated in the Inbox. Your changes save instantly, including when offline.</p><button class="text-button" data-action="install">Install app on this device →</button><p class="muted" style="font-size:11px;margin:12px 0 0">Version ${APP_VERSION}</p></section></div>`;}

function renderModal(){
  const e=state.modal.entry||{}, kind=state.modal.kind||e.kind||'event', weekdays=e.weekdays||[];
  const timed=kind==='event'||kind==='activity';
  const dateHelp=kind==='event'?'Calendar events have a specific date':'Choose a date for this week, or repeat on selected days';
  const title=kind==='event'?'important event':kind==='activity'?'activity':'task';
  return `<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${e.id?'Edit':'New'} ${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">✕</button></div><div class="kind-switch"><button class="${kind==='event'?'active':''}" data-kind="event">Important event</button><button class="${kind==='activity'?'active':''}" data-kind="activity">Activity</button><button class="${kind==='task'?'active':''}" data-kind="task">Task / note</button></div><form id="item-form" class="form-stack"><label class="field">Title<input name="title" value="${esc(e.title||'')}" placeholder="What is it?" required autofocus maxlength="120"></label>${timed?`<div class="field-row"><label class="field">Date <span class="field-help">${dateHelp}</span><input name="date" type="date" value="${esc(e.date??state.modal.date??'')}" ${kind==='event'?'required':''}></label><label class="field">Category<select name="category">${CATEGORIES.map(c=>`<option value="${c}" ${e.category===c?'selected':''}>${cap(c)}</option>`).join('')}</select></label></div><div class="field-row"><label class="field">Starts<input name="start" type="time" value="${esc(e.start??state.modal.time??'09:00')}" required></label><label class="field">Ends<input name="end" type="time" value="${esc(e.end||'10:00')}" required></label></div>${kind==='activity'?`<div class="field">Repeat on <span class="field-help">Used when no date is set</span><span class="weekday-picks">${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="weekday" value="${d}" ${weekdays.includes(d)?'checked':''}>${DAYS[d].slice(0,2)}</label>`).join('')}</span></div>`:''}`:`<div class="field-row"><label class="field">Due date <span class="field-help">Optional</span><input name="dueDate" type="date" value="${esc(e.dueDate||state.modal.date||'')}"></label><label class="field">Category<select name="category">${CATEGORIES.map(c=>`<option value="${c}" ${e.category===c?'selected':''}>${cap(c)}</option>`).join('')}</select></label></div>`}<label class="field">Notes <span class="field-help">Optional</span><textarea name="notes" placeholder="Anything else to remember…">${esc(e.notes||'')}</textarea></label><div class="modal-footer"><div>${e.id?`<button type="button" class="secondary-button" data-action="delete-entry">Delete</button>`:''}</div><div><button type="button" class="secondary-button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit">Save ${title}</button></div></div></form></div></div>`;
}
function cap(s){return s?s[0].toUpperCase()+s.slice(1):'';}
function scrollWeekToNow(){requestAnimationFrame(()=>{const el=document.querySelector('.week-scroll');if(!el)return;const now=new Date(),day=(now.getDay()+6)%7;el.scrollTop=Math.max(0,(now.getHours()-2)*56);el.scrollLeft=Math.max(0,(day-1)*122);});}

document.addEventListener('click',e=>{
  const button=e.target.closest('button,[data-action],[data-add-date]'); if(!button)return;
  if(button.dataset.view){const fromPlanner=state.view==='planner';state.view=button.dataset.view;state.modal=null;if(state.view==='week')state.weekStart=fromPlanner?new Date(state.planWeekStart):startOfWeek(new Date());render();if(state.view==='week')scrollWeekToNow();return;}
  if(button.dataset.planTab){state.planTab=button.dataset.planTab;state.planEditing=null;render();return;}
  if(button.dataset.planAdd){state.planEditing=null;state.planAddDate=button.dataset.planAdd;render();document.querySelector('#plan-form input[name="title"]')?.focus();return;}
  if(button.dataset.planEdit!=null){state.planEditing=Number(button.dataset.planEdit);render();document.querySelector('#plan-form input[name="title"]')?.focus();return;}
  if(button.dataset.planRemove!=null){state.planDraft.splice(Number(button.dataset.planRemove),1);state.planEditing=null;state.planDirty=true;render();return;}
  if(button.dataset.templateEdit){state.templateEditing=button.dataset.templateEdit;render();document.querySelector('#template-form input[name="title"]')?.focus();return;}
  if(button.dataset.templateRemove){const item=state.entries.find(x=>x.id===button.dataset.templateRemove);if(item&&confirm(`Delete template activity “${item.title}”?`)){upsert({...item,deleted:true});if(state.templateEditing===item.id)state.templateEditing=null;}return;}
  if(button.dataset.edit){const entry=state.entries.find(x=>x.id===button.dataset.edit);if(entry){state.modal={entry,kind:entry.kind};render();}return;}
  if(button.dataset.date){state.selectedDate=button.dataset.date;state.monthDate=firstOfMonth(parseDate(state.selectedDate));state.calendarMode='month';render();return;}
  if(button.dataset.addDate){state.modal={kind:button.dataset.addTime?'activity':'event',date:button.dataset.addDate,time:button.dataset.addTime||'09:00'};render();return;}
  if(button.dataset.kind){const old=state.modal;state.modal={...old,kind:button.dataset.kind};render();return;}
  if(button.dataset.filter){state.inboxFilter=button.dataset.filter;render();return;}
  if(button.dataset.calendarMode){state.calendarMode=button.dataset.calendarMode;render();return;}
  const action=button.dataset.action;
  if(action==='new-task'||action==='new-event'){state.modal={kind:action==='new-task'?'task':'event'};render();}
  if(action==='plan-week')openPlanner(state.weekStart);
  if(action==='plan-upcoming')openPlanner(startOfWeek(addDays(new Date(),7)));
  if(action==='plan-prev'||action==='plan-next')openPlanner(addDays(state.planWeekStart,action==='plan-next'?7:-7));
  if(action==='apply-template')applyTemplate();
  if(action==='choose-screenshot')document.querySelector('#screenshot-file')?.click();
  if(action==='save-plan')savePlanWeek();
  if(action==='plan-cancel-edit'){state.planEditing=null;render();}
  if(action==='template-cancel'){state.templateEditing=null;render();}
  if(action==='mascot-toggle'){state.mascotOpen=!state.mascotOpen;render();}
  if(action==='mascot-today'){state.view='today';state.mascotOpen=false;render();window.scrollTo({top:0,behavior:'smooth'});}
  if(action==='mascot-inbox'){state.view='inbox';state.mascotOpen=false;render();window.scrollTo({top:0,behavior:'smooth'});}
  if(action==='mascot-plan')openPlanner(state.planDirty?state.planWeekStart:startOfWeek(addDays(new Date(),7)));
  if(action==='mascot-capture'){state.mascotOpen=false;state.modal={kind:'task'};render();document.querySelector('#item-form input[name="title"]')?.focus();}
  if(action==='close-modal'){state.modal=null;render();}
  if(action==='delete-entry'){removeEntry(state.modal.entry);state.modal=null;render();}
  if(action==='prev-week'||action==='next-week'||action==='this-week'){state.weekStart=action==='this-week'?startOfWeek(new Date()):addDays(state.weekStart,action==='next-week'?7:-7);render();if(action==='this-week')scrollWeekToNow();}
  if(action==='jump-now'){state.weekStart=startOfWeek(new Date());render();scrollWeekToNow();}
  if(action==='prev-month'||action==='next-month'||action==='this-month'){state.monthDate=action==='this-month'?firstOfMonth(new Date()):new Date(state.monthDate.getFullYear(),state.monthDate.getMonth()+(action==='next-month'?(state.calendarMode==='year'?12:1):-(state.calendarMode==='year'?12:1)),1);render();}
  if(action==='export')exportData();
  if(action==='sync')sync();
  if(action==='sign-out'){localStorage.removeItem(AUTH_STORAGE);state.auth=null;state.syncStatus='';render();}
  if(action==='enable-reminder')enableReminder();
  if(action==='disable-reminder'){localStorage.setItem('star-reminder-enabled','no');render();toast('Reminder turned off');}
  if(action==='install'){if(installPrompt)installPrompt.prompt();else toast('Use your browser’s Install or Add to Home Screen menu.');}
});
document.addEventListener('submit',async e=>{
  if(e.target.id==='plan-form'){e.preventDefault();const f=new FormData(e.target),start=f.get('start'),end=f.get('end');if(end<=start){toast('End time must be after start time');return;}const old=state.planEditing==null?{}:state.planDraft[state.planEditing];const entry={...old,id:old.id||id(),kind:'activity',title:f.get('title').trim(),date:f.get('date'),start,end,category:f.get('category'),notes:f.get('notes').trim()};if(!entry.title)return;if(state.planEditing==null)state.planDraft.push(entry);else state.planDraft[state.planEditing]=entry;state.planEditing=null;state.planDirty=true;render();toast('Added to week draft');return;}
  if(e.target.id==='template-form'){e.preventDefault();const f=new FormData(e.target),start=f.get('start'),end=f.get('end');if(end<=start){toast('End time must be after start time');return;}const old=state.templateEditing?state.entries.find(x=>x.id===state.templateEditing)||{}:{};upsert({...old,id:old.id||id(),kind:'template',title:f.get('title').trim(),weekday:Number(f.get('weekday')),start,end,category:f.get('category'),notes:f.get('notes').trim(),deleted:false});state.templateEditing=null;render();toast('Template saved');return;}
  if(e.target.id==='quick-form'){e.preventDefault();const title=new FormData(e.target).get('title').trim();if(title){upsert({id:id(),kind:'task',title,notes:'',category:'personal',dueDate:'',done:false,deleted:false});toast('Added to Inbox');}return;}
  if(e.target.id==='item-form'){e.preventDefault();const f=new FormData(e.target);const kind=state.modal.kind;const old=state.modal.entry||{};const title=f.get('title').trim();if(!title)return;
    if(kind==='event'||kind==='activity'){const date=f.get('date');const start=f.get('start'),end=f.get('end');const weekdays=kind==='activity'?f.getAll('weekday').map(Number):[];if(end<=start){toast('End time must be after start time');return;}if(!date&&(!weekdays.length||kind==='event')){toast(kind==='event'?'Choose an event date':'Choose a date or repeat days');return;}upsert({...old,id:old.id||id(),kind,title,date,start,end,weekdays,category:f.get('category'),notes:f.get('notes').trim(),deleted:false});}
    else upsert({...old,id:old.id||id(),kind,title,dueDate:f.get('dueDate'),category:f.get('category'),notes:f.get('notes').trim(),done:old.done||false,deleted:false});
    state.modal=null;render();toast('Saved');return;}
  if(e.target.id==='auth-form'){e.preventDefault();const f=new FormData(e.target);const submitter=e.submitter;await signIn(f.get('email'),f.get('password'),submitter?.value==='signup');}
});
document.addEventListener('change',async e=>{
  if(e.target.dataset.toggle){const old=state.entries.find(x=>x.id===e.target.dataset.toggle);if(old)upsert({...old,done:e.target.checked});}
  if(e.target.id==='import-file'){const file=e.target.files?.[0];if(file)await importData(file);}
  if(e.target.id==='screenshot-file'){const file=e.target.files?.[0];if(file)await importScreenshot(file);}
  if(e.target.id==='reminder-time')localStorage.setItem('star-reminder-time',e.target.value);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&state.modal){state.modal=null;render();return;}
  if(e.key==='Escape'&&state.mascotOpen){state.mascotOpen=false;render();return;}
  if(e.key==='/'&&!state.modal&&!e.metaKey&&!e.ctrlKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
    e.preventDefault();const input=document.querySelector('#quick-form input');if(input)input.focus();else{state.modal={kind:'task'};render();document.querySelector('#item-form input[name="title"]')?.focus();}
  }
});
document.addEventListener('pointermove',e=>{
  const trigger=e.target.closest?.('.mascot-trigger');if(!trigger)return;
  const box=trigger.getBoundingClientRect();
  trigger.style.setProperty('--look-x',`${Math.max(-2,Math.min(2,(e.clientX-box.left-box.width/2)/10))}px`);
  trigger.style.setProperty('--look-y',`${Math.max(-2,Math.min(2,(e.clientY-box.top-box.height/2)/10))}px`);
});

function exportData(){const payload={app:'Star Intersection',version:1,exportedAt:new Date().toISOString(),entries:state.entries};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`star-intersection-${localDate(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function importData(file){try{const payload=JSON.parse(await file.text());if(!Array.isArray(payload.entries)||payload.app!=='Star Intersection')throw Error('Not a Star Intersection export');let count=0;for(const item of payload.entries){if(!item.id||!['event','activity','template','task'].includes(item.kind))continue;const existing=state.entries.findIndex(x=>x.id===item.id);if(existing<0){state.entries.push({...item,dirty:true});count++;}else if((item.updatedAt||0)>(state.entries[existing].updatedAt||0)){state.entries[existing]={...item,dirty:true};count++;}}save();queueSync();toast(`Imported ${count} items`);}catch(err){toast(`Import failed: ${err.message}`);}}

// Sync uses Firebase Authentication and Firestore's REST APIs so the app has no runtime dependencies.
// Each item is one document. Last edited timestamp wins when two devices changed the same item offline.
function authUrl(method){return `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${encodeURIComponent(window.STAR_FIREBASE.apiKey)}`;}
async function signIn(email,password,signup){try{const owner=localStorage.getItem(OWNER_STORAGE);if(owner&&signup)throw Error('This browser is already linked to an account. Use a separate browser profile to create another.');const r=await fetch(authUrl(signup?'signUp':'signInWithPassword'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const data=await r.json();if(!r.ok)throw Error(data.error?.message||'Sign-in failed');if(owner&&owner!==data.localId)throw Error('This browser has local data for another account. Use a separate browser profile.');localStorage.setItem(OWNER_STORAGE,data.localId);state.auth={email:data.email,uid:data.localId,idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:Date.now()+Number(data.expiresIn)*1000};localStorage.setItem(AUTH_STORAGE,JSON.stringify(state.auth));state.syncStatus='Signed in';render();await sync();}catch(err){state.syncStatus=`Error: ${err.message}`;render();}}
async function token(){if(!state.auth)throw Error('Sign in first');if(state.auth.expiresAt>Date.now()+60000)return state.auth.idToken;const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(window.STAR_FIREBASE.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:state.auth.refreshToken})});const data=await r.json();if(!r.ok)throw Error('Session expired. Sign in again.');state.auth={...state.auth,idToken:data.id_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in)*1000};localStorage.setItem(AUTH_STORAGE,JSON.stringify(state.auth));return state.auth.idToken;}
function docsUrl(){return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(window.STAR_FIREBASE.projectId)}/databases/(default)/documents/users/${encodeURIComponent(state.auth.uid)}/items`;}
async function firebaseRequest(url,options={}){const bearer=await token();const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',...(options.headers||{})}});const data=await r.json();if(!r.ok)throw Error(data.error?.message||`Firebase error ${r.status}`);return data;}
async function remoteEntries(){const out=[];let page='';do{const url=`${docsUrl()}?pageSize=100${page?'&pageToken='+encodeURIComponent(page):''}`;const data=await firebaseRequest(url);for(const doc of data.documents||[]){try{out.push(JSON.parse(doc.fields.payload.stringValue));}catch{}}page=data.nextPageToken||'';}while(page);return out;}
async function sync(){if(!configured()||!state.auth||state.syncing||!navigator.onLine)return;state.syncing=true;state.syncStatus='Syncing…';if(!state.modal)render();try{const remote=await remoteEntries();const remoteMap=new Map(remote.map(e=>[e.id,e]));const localMap=new Map(state.entries.map(e=>[e.id,e]));let changed=false;
    for(const other of remote){const mine=localMap.get(other.id);if(!mine||(other.updatedAt||0)>(mine.updatedAt||0)){const at=state.entries.findIndex(e=>e.id===other.id);const clean={...other,dirty:false};if(at<0)state.entries.push(clean);else state.entries[at]=clean;changed=true;}}
    for(const mine of [...state.entries]){const other=remoteMap.get(mine.id);if(!other||(mine.dirty&&(mine.updatedAt||0)>(other.updatedAt||0))){const clean={...mine,dirty:false};await firebaseRequest(`${docsUrl()}/${encodeURIComponent(mine.id)}`,{method:'PATCH',body:JSON.stringify({fields:{payload:{stringValue:JSON.stringify(clean)}}})});const at=state.entries.findIndex(e=>e.id===mine.id);if(at>=0&&state.entries[at].updatedAt===mine.updatedAt)state.entries[at]=clean;changed=true;}}
    if(changed)localStorage.setItem(STORAGE,JSON.stringify(state.entries));state.syncStatus=`Synced ${new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date())}`;
  }catch(err){state.syncStatus=`Error: ${err.message}`;}finally{state.syncing=false;if(!state.modal)render();}}
let syncTimer;function queueSync(){if(!configured()||!state.auth)return;clearTimeout(syncTimer);syncTimer=setTimeout(sync,1000);}
window.addEventListener('online',sync);setInterval(sync,60000);
async function enableReminder(){if(!('Notification' in window))return;const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Notification permission was not granted');return;}localStorage.setItem('star-reminder-enabled','yes');render();toast('Daily reminder enabled');checkReminder();}
function checkReminder(){if(localStorage.getItem('star-reminder-enabled')!=='yes'||!('Notification' in window)||Notification.permission!=='granted')return;const now=new Date(),today=localDate(now),time=localStorage.getItem('star-reminder-time')||'19:00';if(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`<time||localStorage.getItem('star-reminder-sent')===today)return;const tomorrow=localDate(addDays(now,1)),due=activeEntries().filter(e=>e.kind==='task'&&!e.done&&e.dueDate===tomorrow).length,inbox=activeEntries().filter(e=>e.kind==='task'&&!e.done&&!e.dueDate).length;const parts=[due?`${due} ${due===1?'task':'tasks'} due tomorrow`:null,inbox?`${inbox} ${inbox===1?'thought':'thoughts'} in your Inbox`:null].filter(Boolean);const note=new Notification('Take a moment to plan tomorrow',{body:parts.length?parts.join(' · '):'A quick review can make tomorrow feel lighter.',icon:'/icon.svg'});note.onclick=()=>{window.focus();state.view='today';render();};localStorage.setItem('star-reminder-sent',today);}
setInterval(checkReminder,60000);checkReminder();
setInterval(()=>{if(!state.modal&&!state.mascotOpen){const dock=document.querySelector('.mascot-dock');if(dock)dock.outerHTML=mascotMarkup();}},60000);
let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
render();if(configured()&&state.auth)sync();
