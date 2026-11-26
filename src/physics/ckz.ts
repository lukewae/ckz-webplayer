// CKZ calculations adapted from KZGlobalTeam/cs2kz-metamod (AGPL-3.0-only).
// See THIRD_PARTY.md for the pinned revision and port limitations.
import { type V, speed, clamp } from './math';
export const CKZ = { tick:1/64, step:1/128, gravity:800, jump:302, friction:5.2, stopSpeed:80, accelerate:6.5, airAccelerate:100, airWish:30, run:250, groundSpeedCap:275, perfWindow:0.02, maxVelocity:3500, stepHeight:18 } as const;
export const snapInputTime = (t: number) => Math.floor((t+1e-10)/CKZ.step)*CKZ.step;
export const isPerf = (timeOnGround: number) => timeOnGround>=-1e-9 && timeOnGround<=CKZ.perfWindow+1e-9;
export function perfSpeed(landing: number,takeoff: number,timeOnGround: number,pre: number) {
  let s=Math.max(landing,takeoff);
  if(s>250+pre){s=Math.min(s,(51.5-timeOnGround*75)*Math.log(s)-(51.5*Math.log(276)-276));s=Math.max(s,250+pre);}
  return s;
}
export class Prestrafe {
  left=0;right=0;bonus=0;history:{when:number;duration:number;rate:number}[]=[];
  activelyStrafing=false;
  get gain(){return 26*Math.sqrt(Math.max(this.left,this.right)/0.5);}
  // Requested local policy, not upstream CalcPrestrafe: stored air/perf pre
  // is not permission to accelerate straight W back to 276.
  get groundGain(){return this.activelyStrafing?this.gain:0;}
  update(now:number,dt:number,grounded:boolean,landingTime:number,velocity:V,wish:V){
    this.history=this.history.filter(h=>h.when+0.02>=now);
    if(grounded){
      let rate=0;
      if(speed(velocity)>0&&speed(wish)>0){rate=(Math.atan2(wish[1],wish[0])-Math.atan2(velocity[1],velocity[0]))*180/Math.PI;rate=((rate+540)%360)-180;}
      this.history.push({when:now,duration:dt,rate});
    }
    const duration=this.history.reduce((s,h)=>s+h.duration,0);
    const average=duration?this.history.reduce((s,h)=>s+h.rate*h.duration,0)/duration:0;
    this.activelyStrafing=grounded&&speed(wish)>0&&Math.abs(average)>2;
    const reward=clamp(Math.abs(average)/15.5,0,1)*dt,punish=landingTime+0.25<now?dt*3:0;
    if(grounded && now-dt-landingTime>0.02){
      const s=clamp(speed(velocity),0,250),current=s>0?Math.pow(this.bonus/26*250/s,2)*0.5:0;
      this.left=clamp(Math.min(this.left,current)+(average>2?reward:-punish),0,0.5);
      this.right=clamp(Math.min(this.right,current)+(average<-2?reward:-punish),0,0.5);
      this.bonus=this.gain/250*s;
    }else if(this.left<this.right)this.left=clamp(this.left+dt,0,this.right);
    else this.right=clamp(this.right+dt,0,this.left);
  }
}
