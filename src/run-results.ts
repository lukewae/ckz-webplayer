import type {CourseTimer} from './physics/timer';
import type {Player} from './physics/movement';
import {zoneIntervals,type Hull} from './physics/zones';
export interface SplitZone {id:string;kind:'split'|'checkpoint'|'stage';number:number;course:string;hulls:Hull[]}
export interface RunSplit {key:string;label:string;time:number}
export interface SavedRun {time:number;teleports:number;splits:RunSplit[]}
export interface RunResult extends SavedRun {course:string;practice:boolean;previous:SavedRun|null;newBest:boolean;category:'Pro'|'TP';physics?:string}
type Store=Pick<Storage,'getItem'|'setItem'>;
const validRun=(r:any):r is SavedRun=>r&&Number.isFinite(r.time)&&r.time>0&&Number.isInteger(r.teleports)&&r.teleports>=0&&Array.isArray(r.splits)&&r.splits.every((s:any)=>typeof s.key==='string'&&typeof s.label==='string'&&Number.isFinite(s.time)&&s.time>=0&&s.time<=r.time);
export function personalBestKey(physics:string,map:string,course:string,category:'Pro'|'TP'){
  return `${physics==='ckz-browser-2026-10-12-takeoff'?'ckz-pb-v1':physics}:${map}:${course}:${category}`;
}
export function readPersonalBest(storage:Pick<Storage,'getItem'>|undefined,physics:string,map:string,course:string,category:'Pro'|'TP'):SavedRun|null{
  try{const saved=JSON.parse(storage?.getItem(personalBestKey(physics,map,course,category))??'null');return validRun(saved)&&(saved.teleports===0)===(category==='Pro')?saved:null;}catch{return null;}
}
export function formatRunTime(seconds:number){const ms=Math.round(seconds*1000),minutes=Math.floor(ms/60000);return `${minutes}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
export function formatDelta(seconds:number){return `${seconds<0?'−':seconds>0?'+':'±'}${Math.abs(seconds).toFixed(3)}s`;}
/** Observes native timer updates; never writes player, timer or trigger state. */
export class RunResults {
  private serial=-1;private completed=false;private splits:RunSplit[]=[];private seen=new Set<string>();
  constructor(private map:string,public zones:SplitZone[],private storage?:Store,private physics='ckz-browser-2026-10-12-takeoff'){}
  reset(){this.serial=-1;this.completed=false;this.splits=[];this.seen.clear();}
  observe(timer:CourseTimer,player:Player,time:number,dt:number):RunResult|null {
    if(this.serial!==timer.startSerial||timer.state==='idle'||timer.state==='ready'){
      this.serial=timer.startSerial;this.completed=false;this.splits=[];this.seen.clear();
    }
    if(this.completed||(timer.state!=='running'&&timer.state!=='finished'))return null;
    const limit=timer.state==='finished'?timer.elapsed:time+dt-timer.startedAt,events:RunSplit[]=[];
    for(const zone of this.zones){
      const key=`${zone.kind}:${zone.number}`;
      if(zone.course!==timer.course||this.seen.has(key))continue;
      const entry=zoneIntervals(zone.hulls,player.previous,player.position,player.height)[0];
      if(!entry)continue;
      const elapsed=time+dt*entry.enter-timer.startedAt;
      if(elapsed<0||elapsed>limit+1e-9)continue;
      events.push({key,label:`${zone.kind[0].toUpperCase()+zone.kind.slice(1)} ${zone.number}`,time:Math.max(0,elapsed)});
    }
    for(const split of events.sort((a,b)=>a.time-b.time)){if(!this.seen.has(split.key)){this.seen.add(split.key);this.splits.push(split);}}
    if(timer.state!=='finished')return null;
    this.completed=true;
    const category=timer.teleports===0?'Pro':'TP',key=personalBestKey(this.physics,this.map,timer.course,category);
    const previous=readPersonalBest(this.storage,this.physics,this.map,timer.course,category);
    const run:SavedRun={time:timer.elapsed,teleports:timer.teleports,splits:this.splits.map(s=>({...s}))};
    const newBest=!timer.practice&&run.time>0&&(!previous||run.time<previous.time);
    if(newBest)try{this.storage?.setItem(key,JSON.stringify(run));}catch{}
    return {...run,physics:this.physics,course:timer.course,practice:timer.practice,previous,newBest,category};
  }
}
