import {rankedMode} from '../shared/ranking.mjs';
import type {Replay} from './replay';
import {cacheReplay,readReplay,removeReplay} from './replay-cache';
import {maps,selectedMap} from './map-catalog';
import {formatRunTime,readPersonalBest,type RunResult} from './run-results';
const staticDemo=import.meta.env?.VITE_STATIC_DEMO==='true';
interface User {steamId:string;name:string;banned:boolean;guest?:boolean}
interface Session {user:User|null;csrf:string|null;guestMode?:boolean}
interface Row {rank:number;steamId:string;name:string;time:number;teleports:number;replayId?:string|null}
interface Board {rows:Row[];own:Row|null;total:number}
interface Submission {mode?:'ckz'|'vnl';physics?:string;map:string;course:string;time:number;teleports:number;practice:false;runId:string}
interface Pending {steamId:string;run:Submission;created:number;hasReplay?:boolean}
interface CatalogMap {id:string;name:string;courses:{key:string;name:string}[]}
class ApiError extends Error {constructor(message:string,public status:number,public code=''){super(message);}}
export const queueKey='ckz-submission-queue-v1';
export function parseQueue(raw:string|null):Pending[]{
  try{const value=JSON.parse(raw??'[]');return Array.isArray(value)?value.filter(p=>p&&/^(?:7656119\d{10}|guest_[a-f0-9]{32})$/.test(p.steamId)&&Number.isFinite(p.created)&&Date.now()-p.created<7*86400000&&p.created<=Date.now()+60000&&p.run&&['ckz','vnl'].includes(p.run.mode??'ckz')&&rankedMode(p.run.physics)===(p.run.mode??'ckz')&&maps.some(m=>m.id===p.run.map)&&typeof p.run.course==='string'&&p.run.practice===false&&Number.isFinite(p.run.time)&&p.run.time>0&&p.run.time<=86400&&Number.isInteger(p.run.teleports)&&p.run.teleports>=0&&p.run.teleports<=100000&&typeof p.run.runId==='string'&&/^[0-9a-f-]{36}$/i.test(p.run.runId)).slice(-50):[];}catch{return [];}
}
/** Pending runs remain bound to the Steam account present at completion. */
export function enqueueRun(queue:Pending[],entry:Pending){
  const same=(p:Pending)=>p.steamId===entry.steamId&&(p.run.mode??'ckz')===(entry.run.mode??'ckz')&&p.run.map===entry.run.map&&p.run.course===entry.run.course&&(p.run.teleports===0)===(entry.run.teleports===0);
  const existing=queue.find(same);if(existing&&existing.run.time<=entry.run.time)return queue;
  return [...queue.filter(p=>!same(p)),entry].slice(-50);
}
export class Leaderboards {
  private session:Session={user:null,csrf:null};private sessionReady:Promise<void>;private queue:Pending[]=[];
  private catalog:CatalogMap[]=maps.map(m=>({...m,courses:[]}));private offset=0;private generation=0;private flushing=false;
  private statuses=new Map<string,(message:string)=>void>();
  private category:'Pro'|'TP'='Pro';private requestedCourse:string|undefined;
  onReplay?:(id:string,map:string,name:string)=>void;
  onGuestName?:()=>Promise<string|null>;
  private guestName?:{steamId:string;name:string};
  constructor(private root:HTMLElement,private ranked=true,private mode:'ckz'|'vnl'='ckz',private physics='ckz-browser-2026-10-12-takeoff'){
    try{this.queue=parseQueue(localStorage.getItem(queueKey));}catch{}
    try{const saved=JSON.parse(sessionStorage.getItem('ckz-guest-name-v1')??'null');if(saved&&typeof saved.name==='string'&&saved.name.trim()&&Array.from(saved.name).length<=24&&/^guest_[a-f0-9]{32}$/.test(saved.steamId))this.guestName=saved;}catch{}
    for(const id of ['leaderboard-course'])this.select(id).addEventListener('change',()=>{this.offset=0;this.requestedCourse=undefined;void this.refresh();});
    for(const button of Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-category]')))button.addEventListener('click',()=>{this.setCategory(button.dataset.category as 'Pro'|'TP');this.offset=0;void this.refresh();});
    this.root.querySelector('#leaderboard-refresh')!.addEventListener('click',()=>{void this.refreshSession().then(()=>this.flush());void this.refresh();});
    this.root.querySelector('#leaderboard-prev')!.addEventListener('click',()=>{this.offset=Math.max(0,this.offset-50);void this.refresh();});
    this.root.querySelector('#leaderboard-next')!.addEventListener('click',()=>{this.offset+=50;void this.refresh();});
    this.root.querySelector('[data-page="leaderboards"]')!.addEventListener('click',()=>{void this.refreshSession();void this.refresh();});
    if(staticDemo){
      this.sessionReady=Promise.resolve();this.account();
      this.text('leaderboard-status','Local Pro / TP personal bests · saved in this browser.');
      this.root.querySelector<HTMLButtonElement>('#leaderboard-prev')!.disabled=true;
      this.root.querySelector<HTMLButtonElement>('#leaderboard-next')!.disabled=true;
      return;
    }
    window.addEventListener('online',()=>{void this.refreshSession().then(()=>this.flush());void this.refresh();});
    window.addEventListener('focus',()=>{void this.refreshSession().then(()=>this.flush());});
    setInterval(()=>{if(this.queue.length)void this.flush();},30000);
    this.sessionReady=this.refreshSession();
    void this.loadCatalog();
  }
  private select(id:string){return this.root.querySelector<HTMLSelectElement>('#'+id)!;}
  private setCategory(category:'Pro'|'TP'){this.category=category;for(const button of Array.from(this.root.querySelectorAll('[data-category]')))button.setAttribute('aria-pressed',String((button as HTMLElement).dataset.category===category));}
  open(course?:string,category:'Pro'|'TP'='Pro'){
    this.requestedCourse=course;this.setCategory(category);this.offset=0;this.courses();void this.refreshSession().then(()=>this.refresh());
  }
  private text(id:string,value:string){this.root.querySelector('#'+id)!.textContent=value;}
  private async request<T>(path:string,options:RequestInit={}):Promise<T>{
    let response:Response;try{response=await fetch(path,{...options,credentials:'same-origin',signal:AbortSignal.timeout(options.method==='POST'?60000:12000)});}catch{throw new ApiError('Leaderboard server unavailable. Try again shortly.',0);}
    let data:any;try{data=await response.json();}catch{throw new ApiError('Leaderboard server unavailable.',0);}
    if(!response.ok)throw new ApiError(data.error||'Leaderboard request failed.',response.status,data.code||'');return data;
  }
  private account(message?:string){
    const host=this.root.querySelector('#steam-account')!;host.replaceChildren();
    if(staticDemo){host.textContent='Local play · PBs and replays';return;}
    const label=document.createElement('span'),user=this.session.user;label.textContent=message??(user?`${user.name}${user.banned?' · Banned':''}`:'Steam account');if(user)label.title=user.guest?'Guest browser identity':`SteamID ${user.steamId}`;host.append(label);
    if(user?.guest){const note=document.createElement('span');note.textContent=this.ranked?'Auto-submit on':'VNL local PBs';host.append(note);}
    else if(user){const button=document.createElement('button');button.type='button';button.textContent='Sign out';button.onclick=()=>{button.disabled=true;void this.request('/api/logout',{method:'POST',headers:{'x-csrf-token':this.session.csrf||''}}).then(()=>{this.session={user:null,csrf:null};this.account();void this.refresh();}).catch(e=>this.account(e.message));};host.append(button);}
    else{const link=document.createElement('a');link.textContent='Sign in with Steam';const back=new URL(location.href);back.searchParams.delete('auth');back.searchParams.set('page','leaderboards');link.href='/api/auth/steam?return='+encodeURIComponent(back.pathname+back.search);host.append(link);}
  }
  private async refreshSession(){
    if(staticDemo)return;
    try{this.session=await this.request<Session>('/api/session');this.account();
      const auth=new URLSearchParams(location.search).get('auth');if(auth)this.account(auth==='banned'?'Steam account banned':'Steam sign-in failed. Try again.');
      if(auth){const url=new URL(location.href);url.searchParams.delete('auth');history.replaceState(null,'',url);}
      void this.flush();
    }catch(e){this.account((e as Error).message);}
  }
  private async loadCatalog(){try{this.catalog=(await this.request<{maps:CatalogMap[]}>('/api/catalog')).maps;this.courses();void this.refresh();}catch(e){this.text('leaderboard-status',(e as Error).message);this.text('leaderboard-own','');this.root.querySelector<HTMLButtonElement>('#leaderboard-prev')!.disabled=true;this.root.querySelector<HTMLButtonElement>('#leaderboard-next')!.disabled=true;}}
  setCourses(courses:{key:string;name:string}[]){const current=this.catalog.find(m=>m.id===selectedMap.id);if(current)current.courses=courses;this.courses();if(staticDemo)void this.refresh();}
  mapChanged(){this.generation++;this.offset=0;this.requestedCourse=undefined;this.root.querySelector('#leaderboard-rows')!.replaceChildren();this.text('leaderboard-rank','—');this.text('leaderboard-own','');this.text('leaderboard-status','Loading map…');this.select('leaderboard-course').replaceChildren();}
  private courses(){const select=this.select('leaderboard-course'),prior=this.requestedCourse??select.value;select.replaceChildren();for(const c of this.catalog.find(m=>m.id===selectedMap.id)?.courses??[]){const option=document.createElement('option');option.value=c.key;option.textContent=c.name;select.append(option);}if(Array.from(select.options).some(o=>o.value===prior))select.value=prior;}
  async refresh(){
    if(staticDemo){this.refreshLocal();return;}
    const course=this.select('leaderboard-course').value;if(!course)return;
    const generation=++this.generation;this.text('leaderboard-status','Loading records…');this.text('leaderboard-rank','—');this.text('leaderboard-own','');
    try{
      const map=selectedMap.id,params=new URLSearchParams({map,course,mode:this.mode,category:this.category,offset:String(this.offset)}),board=await this.request<Board>('/api/leaderboards?'+params);
      if(generation!==this.generation)return;
      const body=this.root.querySelector('#leaderboard-rows')!;body.replaceChildren();
      for(const row of board.rows){const tr=document.createElement('tr');if(row.steamId===this.session.user?.steamId)tr.classList.add('own-record');
        const rank=document.createElement('td');rank.textContent=String(row.rank);tr.append(rank);
        const name=document.createElement('td');if(row.steamId.startsWith('guest_')){name.textContent=row.name;name.title='Guest submission';}else{const profile=document.createElement('a');profile.href='https://steamcommunity.com/profiles/'+row.steamId;profile.target='_blank';profile.rel='noopener noreferrer';profile.textContent=row.name;profile.title='SteamID '+row.steamId;name.append(profile);}tr.append(name);
        for(const value of [formatRunTime(row.time),String(row.teleports)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
        const cell=document.createElement('td'),replay=document.createElement('button');replay.type='button';replay.className='leaderboard-replay';replay.disabled=!row.replayId;replay.setAttribute('aria-label',row.replayId?`Watch replay by ${row.name}`:`Replay unavailable for ${row.name}`);replay.innerHTML='<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7 4.5v11l9-5.5z" fill="currentColor"/></svg>';replay.title=row.replayId?'Watch replay':'This time has no recorded replay';replay.onclick=()=>{if(row.replayId)this.onReplay?.(row.replayId,map,row.name);};cell.append(replay);tr.append(cell);body.append(tr);
      }
      this.text('leaderboard-status',board.total?`${board.total} ${board.total===1?'time':'times'}`:'No times yet.');
      this.text('leaderboard-rank',board.own?`#${board.own.rank} / ${board.total}`:'Unranked');
      this.text('leaderboard-own',board.own?`Your PB · #${board.own.rank} · ${formatRunTime(board.own.time)} · ${board.own.teleports} TP`:this.session.user?.banned?'This Steam account is banned from submissions.':this.session.user?(this.ranked?'Finish this course to post your first time.':'Choose standard 64-tick VNL to submit to this board.'):'Sign in with Steam to submit your finishes automatically.');
      this.root.querySelector<HTMLButtonElement>('#leaderboard-prev')!.disabled=this.offset===0;this.root.querySelector<HTMLButtonElement>('#leaderboard-next')!.disabled=this.offset+50>=board.total;
    }catch(e){if(generation===this.generation){this.root.querySelector('#leaderboard-rows')!.replaceChildren();this.text('leaderboard-status',(e as Error).message);this.text('leaderboard-own','');this.root.querySelector<HTMLButtonElement>('#leaderboard-prev')!.disabled=true;this.root.querySelector<HTMLButtonElement>('#leaderboard-next')!.disabled=true;}}
  }
  private saveQueue(){try{localStorage.setItem(queueKey,JSON.stringify(this.queue));}catch{}}
  private refreshLocal(){
    const course=this.select('leaderboard-course').value,body=this.root.querySelector('#leaderboard-rows')!;body.replaceChildren();
    let saved=null;try{saved=readPersonalBest(localStorage,this.physics,selectedMap.id,course,this.category);}catch{}
    this.text('leaderboard-status',`Local ${this.category} personal best · this browser only`);
    this.text('leaderboard-rank',saved?'#1':'—');this.text('leaderboard-own',saved?`Your ${this.category} PB · ${formatRunTime(saved.time)} · ${saved.teleports} TP`:`No ${this.category} finish saved for this course yet.`);
    if(saved){const tr=document.createElement('tr');tr.className='own-record';for(const value of ['1','You · local',formatRunTime(saved.time),String(saved.teleports),'—']){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
    this.root.querySelector<HTMLButtonElement>('#leaderboard-prev')!.disabled=true;this.root.querySelector<HTMLButtonElement>('#leaderboard-next')!.disabled=true;
  }
  async completed(result:RunResult,status:(message:string)=>void,replay?:Replay){
    if(staticDemo){
      let saved=null;try{saved=readPersonalBest(localStorage,this.physics,selectedMap.id,result.course,result.category);}catch{}
      status(result.practice?'Practice finish · personal best unchanged.':saved?.time===result.time?`${result.category} personal best saved in this browser.`:saved?`${result.category} finish · your personal best is unchanged.`:'Finish complete · browser storage unavailable; personal best could not be saved.');
      void this.refresh();return;
    }
    const completedMap=selectedMap.id;
    await this.sessionReady;
    const user=this.session.user;let nameWarning='';
    if(user?.guest&&!user.banned){
      if(this.guestName?.steamId!==user.steamId){
        const chosen=await this.onGuestName?.();
        this.guestName={steamId:user.steamId,name:chosen??('Guest '+user.steamId.slice(-6))};
        try{sessionStorage.setItem('ckz-guest-name-v1',JSON.stringify(this.guestName));}catch{}
      }
      // Reapply after map changes and before uploading, so the first row/replay has this name.
      if(user.name!==this.guestName!.name){try{const answer=await this.request<{name:string}>('/api/guest/name',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':this.session.csrf||''},body:JSON.stringify({name:this.guestName!.name})});user.name=answer.name;this.account();}catch{ nameWarning=' Name update pending.';}}
    }
    const mode=rankedMode(result.physics);
    if(!mode){status('Unranked movement settings · local PB/replay only.');return;}
    if(result.practice){status('Practice finish · not submitted.');return;}
    if(!user){status('Sign in with Steam under Leaderboards to submit future finishes automatically.');return;}
    if(user.banned){status('This Steam account is banned from leaderboard submissions.');return;}
    const run:Submission={...(mode==='vnl'?{mode,physics:result.physics}:{}),map:completedMap,course:result.course,time:result.time,teleports:result.teleports,practice:false,runId:crypto.randomUUID()};
    let replayWarning='',hasReplay=false;if(replay){try{await cacheReplay(run.runId,replay);hasReplay=true;}catch{replayWarning=' Replay storage unavailable; time only.';}}else replayWarning=' Replay unavailable (recording limit or incomplete run).';
    const next=enqueueRun(this.queue,{steamId:user.steamId,run,created:Date.now(),hasReplay});
    if(next===this.queue){void removeReplay(run.runId).catch(()=>{});status('A faster run is already waiting to submit.');return;}
    for(const old of this.queue)if(!next.includes(old))void removeReplay(old.run.runId).catch(()=>{});
    for(const id of this.statuses.keys())if(!next.some(p=>p.run.runId===id))this.statuses.delete(id);
    this.queue=next;this.statuses.set(run.runId,message=>status(message+nameWarning));this.saveQueue();status('Submitting to leaderboard…'+replayWarning+nameWarning);void this.flush();
  }
  private async flush(){
    if(this.flushing||!this.session.user||this.session.user.banned)return;this.flushing=true;
    try{
      while(this.session.user&&!this.session.user.banned){
        const pending=this.queue.find(p=>p.steamId===this.session.user!.steamId);if(!pending)break;
        const owner=this.session.user.steamId,csrf=this.session.csrf;
        try{
          const replay=pending.hasReplay?await readReplay(pending.run.runId):undefined;
          if(pending.hasReplay&&!replay)throw new ApiError('Saved replay is missing from browser storage.',0);
          const answer=await this.request<{improved:boolean;own:Row}>('/api/runs',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf||''},body:JSON.stringify({...pending.run,...(replay?{replay}:{})})});
          this.statuses.get(pending.run.runId)?.(answer.improved?`Leaderboard PB saved · #${answer.own.rank}${replay?' · Replay saved':' · No replay'}`:`Submitted · your leaderboard PB stays ${formatRunTime(answer.own.time)}.`);
          void removeReplay(pending.run.runId).catch(()=>{});
          this.queue=this.queue.filter(p=>p.run.runId!==pending.run.runId||p.steamId!==pending.steamId);this.statuses.delete(pending.run.runId);this.saveQueue();void this.refresh();
        }catch(e){
          const error=e as ApiError,permanent=[400,409,413].includes(error.status)||(error.status===403&&error.code==='banned');
          this.statuses.get(pending.run.runId)?.(permanent?`Not submitted: ${error.message}`:'Submission pending · retries automatically when connected.');
          if(permanent){void removeReplay(pending.run.runId).catch(()=>{});this.queue=this.queue.filter(p=>p.run.runId!==pending.run.runId||p.steamId!==pending.steamId);this.statuses.delete(pending.run.runId);this.saveQueue();}
          if(error.status===401&&this.session.user?.steamId===owner){this.session={user:null,csrf:null};this.account('Steam session expired. Sign in again to submit pending runs.');}
          if(error.code==='csrf')await this.refreshSession();
          if(!permanent||error.status===403)break;
        }
      }
    }finally{this.flushing=false;}
  }
}
