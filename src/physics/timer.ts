import type {Player} from './movement';
import {type Hull,zoneIntervals} from './zones';
export interface TimerZone {id:string;kind:'start'|'end';course:string;hulls:Hull[]}
export class CourseTimer {
  state:'idle'|'ready'|'running'|'finished'='idle';course='';startedAt=0;elapsed=0;teleports=0;practice=false;
  touching=new Set<string>();groundedInStart=false;startSerial=0;
  constructor(public zones:TimerZone[]){}
  onUpdate?: (player:Player,time:number,dt:number)=>void;
  reset(){this.state='idle';this.course='';this.elapsed=0;this.teleports=0;this.practice=false;this.touching.clear();this.groundedInStart=false;}
  stop(){this.state='idle';this.groundedInStart=false;}
  teleport(){if(this.state==='running')this.teleports++;this.touching.clear();this.groundedInStart=false;}
  update(player:Player,time:number,dt:number,wasGrounded:boolean){
    if(player.noclip){this.reset();this.onUpdate?.(player,time,dt);return;}
    const events:{fraction:number;kind:'enter'|'exit';zone:TimerZone}[]=[];
    const touching=new Set<string>();
    for(const zone of this.zones){
      const intervals=zoneIntervals(zone.hulls,player.previous,player.position,player.height);
      const wasInside=this.touching.has(zone.id);
      if(wasInside&&(!intervals.length||intervals[0].enter>0))events.push({fraction:0,kind:'exit',zone});
      for(const interval of intervals){
        if(interval.enter>0||!wasInside)events.push({fraction:interval.enter,kind:'enter',zone});
        if(interval.leave<1)events.push({fraction:interval.leave,kind:'exit',zone});
        else touching.add(zone.id);
      }
    }
    events.sort((a,b)=>a.fraction-b.fraction);
    for(const event of events){const {zone,kind,fraction}=event,at=time+dt*fraction;
      if(zone.kind==='start'){
        if(kind==='enter'){
          this.state='ready';this.course=zone.course;this.elapsed=0;this.teleports=0;this.practice=false;this.groundedInStart=player.grounded||(wasGrounded&&player.velocity[2]<=0);this.startSerial++;
        }else if(this.state==='ready'&&this.course===zone.course){
          this.startSerial++;
          if(this.groundedInStart){this.state='running';this.startedAt=at;this.elapsed=0;}else this.state='idle';
        }
      }else if(kind==='enter'&&this.state==='running'&&zone.course===this.course){this.elapsed=at-this.startedAt;this.state='finished';}
    }
    if(this.state==='ready'&&player.grounded&&this.zones.some(z=>z.kind==='start'&&z.course===this.course&&touching.has(z.id)))this.groundedInStart=true;
    if(this.state==='running')this.elapsed=time+dt-this.startedAt;
    this.touching=touching;
    this.onUpdate?.(player,time,dt);
  }
}
