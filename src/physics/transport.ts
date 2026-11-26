import {type V,dot,sub} from './math';
import type {Player} from './movement';
import {Prestrafe} from './ckz';
import {RampFix} from './ramp-fix';
export interface Transport {id:string;hulls:{normal:V;dist:number}[][];addPass:boolean;removePass:boolean;requiresPass:boolean|null;destination?:V;yaw?:number}
export class MapTransport {
  pass=false;touching=new Set<string>();teleports=0;
  pitch?:number;
  onEnter?: (id:string)=>void;
  constructor(public volumes:Transport[]){}
  clearContacts(){this.touching.clear();}
  reset(){this.pass=false;this.touching.clear();this.teleports=0;}
  blocksJump(_player:Player,_time:number){return false;}
  process(player:Player,_time=0,_dt=0,_wasGrounded=player.grounded,_yaw=0):number|undefined {
    if(player.noclip){this.clearContacts();return;}
    const contacts=this.volumes.flatMap(volume=>volume.hulls.map(planes=>{
      let enter=0,leave=1,endInside=true;
      for(const p of planes){const n=p.normal;const offset=(Math.abs(n[0])+Math.abs(n[1]))*15.96875+(n[2]<0?-n[2]*(player.height-.03125):-n[2]*.03125),d=p.dist+offset;
        const a=dot(player.previous,n)-d,b=dot(player.position,n)-d;
        if(b>0)endInside=false;
        if(a>0&&b>0)return null;
        if(a>b)enter=Math.max(enter,a/(a-b));else if(a<b)leave=Math.min(leave,a/(a-b));
        if(enter>leave)return null;
      }return {volume,enter,endInside};
    })).filter((v):v is NonNullable<typeof v>=>v!==null).sort((a,b)=>a.enter-b.enter);
    const touching=new Set<string>(),entered=new Set<string>();
    for(const {volume:v,endInside} of contacts){
      if(endInside)touching.add(v.id);
      if(this.touching.has(v.id)||entered.has(v.id)||(v.requiresPass!==null&&v.requiresPass!==this.pass))continue;
      entered.add(v.id);this.onEnter?.(v.id);
      if(v.addPass)this.pass=true;if(v.removePass)this.pass=false;
      if(v.destination){
        player.jumpLog.cancel();
        player.position=[...v.destination];player.previous=[...v.destination];player.velocity=[0,0,0];player.grounded=false;player.landingTime=-Infinity;player.landingVelocity=[0,0,0];player.pre=new Prestrafe();player.rampFix=new RampFix();player.surfaceFriction=1;
        this.touching.clear();this.teleports++;return v.yaw;
      }
    }
    this.touching=touching;return undefined;
  }
}
