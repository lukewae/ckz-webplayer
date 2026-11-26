import {type V,speed,sub} from './math';
import {summarizeJump,measureBlock,type JumpSample} from './jump-diagnostics';
import type {Collider} from './collision';
export interface FlatJump {
  rawDistance?:number;landingAdjustment?:number;rawDuration?:number;
  id:number;distance:number;originDistance:number;takeoff:V;landing:V;heightDifference:number;maxHeight:number;
  takeoffSpeed:number;maxSpeed:number;duration:number;strafes:number;airGain:number;airLoss:number;contactLoss:number;
  classification:string; samples:JumpSample[]; diagnostics?:ReturnType<typeof summarizeJump>; geometry?:ReturnType<typeof measureBlock>;
}
type Flight={samples:JumpSample[];takeoffYaw:number;maxHeight:number;takeoff:V;time:number;takeoffSpeed:number;maxSpeed:number;strafes:number;lastSide:number;airGain:number;airLoss:number;contactLoss:number;classification:string};
export class JumpLog {
  enabled=true;records:FlatJump[]=[];pending:Flight|undefined;nextId=1;
  cancel(){this.pending=undefined;}
  clear(){this.cancel();this.records=[];this.nextId=1;}
  begin(position:V,normal:V,time:number,velocity:V,classification:string,takeoffYaw=0){
    this.cancel();if(!this.enabled||normal[2]<.999999)return;
    this.pending={samples:[],takeoffYaw,maxHeight:0,takeoff:[...position],time,takeoffSpeed:speed(velocity),maxSpeed:speed(velocity),strafes:0,lastSide:0,airGain:0,airLoss:0,contactLoss:0,classification};
  }
  update(position:V,velocity:V,grounded:boolean,normal:V,contacts:V[],time:number,side:number,air?:{before:number;afterAcceleration:number;afterCollision:number},sample?:JumpSample,world?:Collider,measuredLanding?:{position:V;time:number}){
    const jump=this.pending;if(!jump)return;
    if(time-jump.time>8){this.cancel();return;}
    if(sample)jump.samples.push(sample);
    if(!this.enabled||contacts.some(n=>n[2]<.999999)){this.cancel();return;}
    jump.maxHeight=Math.max(jump.maxHeight,position[2]-jump.takeoff[2]);
    jump.maxSpeed=Math.max(jump.maxSpeed,speed(velocity),air?.before??0,air?.afterAcceleration??0);
    if(side&&side!==jump.lastSide){jump.strafes++;jump.lastSide=side;}
    if(air){const gain=air.afterAcceleration-air.before;jump.airGain+=Math.max(0,gain);jump.airLoss+=Math.max(0,-gain);jump.contactLoss+=Math.max(0,air.afterAcceleration-air.afterCollision);}
    if(!grounded)return;
    this.cancel();const heightDifference=position[2]-jump.takeoff[2];
    if(normal[2]<.999999||Math.abs(heightDifference)>.125)return;
    const rawDistance=speed(sub(position,jump.takeoff))+32;
    const landing=measuredLanding?.position??position,landingTime=measuredLanding?.time??time;
    const originDistance=speed(sub(landing,jump.takeoff));
    const diagnostics=jump.samples.length?summarizeJump(jump.samples,jump.takeoff,landing,jump.takeoffYaw):undefined;
    this.records.push({samples:jump.samples,diagnostics,geometry:world?measureBlock(world,jump.takeoff,landing):undefined,id:this.nextId++,distance:originDistance+32,rawDistance,landingAdjustment:originDistance+32-rawDistance,originDistance,takeoff:jump.takeoff,landing:[...landing],heightDifference,maxHeight:jump.maxHeight,takeoffSpeed:jump.takeoffSpeed,maxSpeed:jump.maxSpeed,duration:landingTime-jump.time,rawDuration:time-jump.time,strafes:diagnostics?.rows.length??jump.strafes,airGain:jump.airGain,airLoss:jump.airLoss,contactLoss:jump.contactLoss,classification:jump.classification});
    if(this.records.length>100)this.records.shift();
  }
}

