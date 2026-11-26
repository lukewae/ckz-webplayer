import {type V,speed,sub} from './math';
import type {Collider} from './collision';
import {CKZ} from './ckz';
export interface JumpSample {
  airAccelerate?:number;airWish?:number;stepHz?:number;
  time:number;dt:number;position:V;velocity:V;yaw:number;pitch:number;
  forward:boolean;back:boolean;left:boolean;right:boolean;duck:boolean;
  duckAmount:number;duckSpeed:number;hullHeight:number;eyeHeight:number;
  wishSpeed:number;wishProjection:number;surfaceFriction:number;
  before:number;afterAcceleration:number;afterCollision:number;
}
export interface StrafeStats {number:number;turn:number;air:number;sync:number;gain:number;loss:number;max:number;ol:number;da:number;badAngle:number;width:number;avgGain:number;efficiency:number;maxEfficiency:number;contactLoss:number}
export const angleDelta=(a:number,b:number)=>((a-b)%360+540)%360-180;
/** Pinned CKZ AACall ideal-gain convention, not the unknown GC server's efficiency implementation. */
export function idealGain(s:JumpSample){
  const acceleration=(s.airAccelerate??CKZ.airAccelerate)*(s.wishSpeed||CKZ.run)*s.surfaceFriction*s.dt;
  const amount=Math.min(acceleration,s.airWish??CKZ.airWish),projection=Math.min(s.before,Math.max(0,(s.airWish??CKZ.airWish)-acceleration));
  return Math.sqrt(s.before*s.before+amount*amount+2*amount*projection)-s.before;
}
export function summarizeJump(samples:JumpSample[],takeoff:V,landing:V,takeoffYaw:number){
  const rows:StrafeStats[]=[];let previous=takeoffYaw,path=0,last=takeoff;
  for(const s of samples){
    const yawDelta=angleDelta(s.yaw,previous),turn=Math.abs(yawDelta)>1e-7?Math.sign(yawDelta):0;
    let row=rows.at(-1);
    if(!row||(turn&&row.turn&&turn!==row.turn)){
      row={number:rows.length+1,turn,air:0,sync:0,gain:0,loss:0,max:0,ol:0,da:0,badAngle:0,width:0,avgGain:0,efficiency:0,maxEfficiency:0,contactLoss:0};rows.push(row);
    }
    if(!row.turn)row.turn=turn;
    const units=s.dt*(s.stepHz??128),gain=s.afterAcceleration-s.before,ideal=idealGain(s),eff=ideal>1e-9?100*Math.max(0,gain)/ideal:0;
    row.air+=units;row.sync+=gain>1e-6?units:0;
    if(!s.wishSpeed){if((s.left&&s.right)||(s.forward&&s.back))row.ol+=units;else row.da+=units;}
    else if(Math.abs(gain)<=1e-6)row.badAngle+=units;
    row.gain+=Math.max(0,gain);row.loss+=Math.max(0,-gain);row.max=Math.max(row.max,s.before,s.afterAcceleration,s.afterCollision);
    row.contactLoss+=Math.max(0,s.afterAcceleration-s.afterCollision);
    row.width+=Math.abs(yawDelta);row.efficiency+=eff*units;row.maxEfficiency=Math.max(row.maxEfficiency,eff);
    path+=speed(sub(s.position,last));last=s.position;previous=s.yaw;
  }
  const total=rows.reduce((n,r)=>n+r.air,0),sync=total?100*rows.reduce((n,r)=>n+r.sync,0)/total:0;
  for(const row of rows){row.sync=row.air?100*row.sync/row.air:0;row.avgGain=row.air?row.gain/row.air:0;row.efficiency=row.air?row.efficiency/row.air:0;}
  const displacement=sub(landing,takeoff),axis=Math.abs(displacement[0])>=Math.abs(displacement[1])?0:1;
  const direction=Math.atan2(displacement[1],displacement[0])*180/Math.PI;
  const jumpOffAngle=angleDelta(takeoffYaw,direction),abs=Math.abs(jumpOffAngle);
  return {rows,sync,airtimeSteps:total,overlap:rows.reduce((n,r)=>n+r.ol,0),deadAir:rows.reduce((n,r)=>n+r.da,0),
    forwardSteps:samples.reduce((n,s)=>n+(s.forward?s.dt*(s.stepHz??128):0),0),veer:Math.abs(displacement[1-axis]),
    jumpOffAngle,direction:abs<=45?'Forwards':abs>=135?'Backwards':jumpOffAngle>0?'Sideways left':'Sideways right',
    airpath:speed(displacement)>1e-9?path/speed(displacement):null};
}
/** Optional estimate for one axis-aligned gap. No gap/ambiguous platforms => unavailable. */
export function measureBlock(world:Collider,takeoff:V,landing:V){
  const d=sub(landing,takeoff),axis=Math.abs(d[0])>=Math.abs(d[1])?0:1,sign=Math.sign(d[axis]);
  if(!sign||Math.abs(d[axis])<40)return null;
  const length=Math.abs(d[axis])+16;
  const supported=(distance:number)=>{
    const p:V=[...takeoff];p[axis]+=distance*sign;p[1-axis]+=d[1-axis]*Math.min(1,distance/Math.abs(d[axis]));p[2]+=1;
    const end:V=[p[0],p[1],takeoff[2]-1];const t=world.trace(p,end,0,0);
    return !t.startSolid&&t.fraction<1&&t.normal[2]>.999999;
  };
  if(!supported(0)||!supported(length))return null;
  const intervals=32;let previous=true,start=-1,finish=-1;
  const boundary=(lo:number,hi:number,initial:boolean)=>{for(let n=0;n<16;n++){const mid=(lo+hi)/2;if(supported(mid)===initial)lo=mid;else hi=mid;}return (lo+hi)/2;};
  for(let n=1;n<=intervals;n++){const at=length*n/intervals,now=supported(at);if(now!==previous){
    if(!now){if(start>=0)return null;start=boundary(at-length/intervals,at,true);}
    else finish=boundary(at-length/intervals,at,false);
  }previous=now;}
  if(start<0||finish<start)return null;
  return {block:finish-start,edge:start-16,landEdge:length-finish,method:'estimated axis gap from point probes; not native block tracking'};
}
