import {MAX_REPLAY_SECONDS,type Replay} from '../shared/replay.mjs';
import {movementProfile,type MovementProfile} from './physics/profile';
import type {Player,Input} from './physics/movement';
import type {CourseTimer} from './physics/timer';
export type {Replay};
export const buttons=(i:Input)=>['forward','back','left','right','duck','jump','walk'].reduce((n,k,b)=>n|(i[k as keyof Input]?1<<b:0),0);
export function pose(p:Player,yaw:number,pitch:number):number[]{return [0,...p.position,p.eye,yaw,pitch,...p.velocity,0,0,Number(p.grounded),p.duckAmount,p.duckSpeed,yaw,pitch,0];}
/** State-track playback deliberately does not rerun today's physics on older runs. */
export function sampleReplay(replay:Replay,time:number):number[]{
  const frames=replay.frames,t=Math.max(replay.preRoll?-replay.preRoll:0,Math.min(time,replay.duration));let lo=0,hi=frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid][0]<=t)lo=mid;else hi=mid-1;}
  const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],f=b[0]>a[0]?(t-a[0])/(b[0]-a[0]):0,result=[...a];result[0]=t;
  if(b[17]&&t<b[0])return result;
  for(const k of [1,2,3,4,6,7,8,9,13,14])result[k]=a[k]+(b[k]-a[k])*f;
  result[5]=a[5]+(((b[5]-a[5])%360+540)%360-180)*f;return result;
}
export class RunRecorder {
  private serial=-1;private recording?:Replay;private done=false;private overflow=false;private last?:number[];
  private lead:number[][]=[];private previousTime?:number;
  constructor(private metadata:Pick<Replay,'map'|'mapHash'|'collisionHash'>,private profile:Readonly<MovementProfile>=movementProfile()){}
  private get interval(){return this.profile.step;}
  private clearRun(){this.recording=undefined;this.serial=-1;this.done=false;this.overflow=false;}
  reset(){this.clearRun();this.last=undefined;this.lead=[];this.previousTime=undefined;}
  step(timer:CourseTimer,before:number[],after:number[],input:Input,jumps:number,time:number,teleported=false){
    if(this.previousTime!==undefined&&(time<=this.previousTime||time-this.previousTime>this.interval+.00001))this.reset();
    this.previousTime=time;
    const frame=[...after];frame[0]=time;frame[10]=buttons(input);frame[11]=jumps;frame[15]=input.yaw;frame[16]=input.pitch;
    frame[17]=Number(teleported||(this.last&&[1,2,3].some(k=>Math.abs(this.last![k]-before[k])>.001))||Math.hypot(after[1]-before[1],after[2]-before[2],after[3]-before[3])>64);
    if(!this.lead.length){const initial=[...before];initial[0]=time-this.interval;initial[10]=buttons(input);initial[15]=input.yaw;initial[16]=input.pitch;this.lead.push(initial);}
    const history=this.lead;
    this.lead=[...history,[...frame]].filter(f=>f[0]>=time-1-this.interval);this.last=[...after];
    if(timer.state!=='running'&&timer.state!=='finished'){this.clearRun();return;}
    if(this.serial!==timer.startSerial){
      this.clearRun();this.serial=timer.startSerial;
      const start=[...before];start[0]=0;start[10]=buttons(input);start[11]=jumps;start[15]=input.yaw;start[16]=input.pitch;
      // The timer starts partway through this step. Interpolate the initial pose to that crossing.
      const f=Math.max(0,Math.min(1,(timer.startedAt-(time-this.interval))/this.interval));
      if(!frame[17])for(const k of [1,2,3,4,5,6,7,8,9])start[k]+= (after[k]-before[k])*f;
      start[17]=frame[17];
      const lead=history.filter(f=>f[0]>=timer.startedAt-1&&f[0]<timer.startedAt).map(f=>{const copy=[...f];copy[0]-=timer.startedAt;return copy;});
      this.recording={...this.metadata,version:1,hz:(1/this.interval) as 64|128,physics:this.profile.id,...(this.profile.mode==='vnl'?{movement:{mode:'vnl' as const,timing:this.profile.timing,airAccelerate:this.profile.airAccelerate}}:{}),course:timer.course,duration:0,...(lead.length?{preRoll:-lead[0][0]}:{}),frames:[...lead,start]};
    }
    if(this.done||this.overflow||!this.recording)return;
    const elapsed=time-timer.startedAt;
    if(elapsed>MAX_REPLAY_SECONDS){this.overflow=true;this.recording=undefined;return;}
    frame[0]=elapsed;
    if(timer.state==='finished'){
      const duration=timer.elapsed,last=this.recording.frames.at(-1)!;
      if(duration>last[0]){const f=Math.max(0,Math.min(1,(duration-last[0])/(elapsed-last[0])));if(!frame[17])for(const k of [1,2,3,4,5,6,7,8,9])frame[k]=last[k]+(frame[k]-last[k])*f;frame[0]=duration;this.recording.frames.push(frame);}
      this.recording.duration=duration;this.done=true;
    }else if(elapsed>this.recording.frames.at(-1)![0])this.recording.frames.push(frame);
  }
  finish(){return this.done&&!this.overflow?this.recording:undefined;}
}
