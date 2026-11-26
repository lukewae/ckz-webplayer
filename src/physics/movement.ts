import { type V, add, sub, mul, dot, cross, unit, speed, len, clamp, clip } from './math';
import { type Collider } from './collision';
import { CKZ, Prestrafe, perfSpeed, isPerf } from './ckz';
import {movementProfile,type MovementProfile} from './profile';
import {RampFix,fixGround} from './ramp-fix';
import {ladderWish,ladderVelocity} from './ladder';
import {JumpLog} from './jump-log';
export interface Input { forward:boolean;back:boolean;left:boolean;right:boolean;duck:boolean;jump:boolean;walk:boolean;yaw:number;pitch:number }
export const emptyInput=():Input=>({forward:false,back:false,left:false,right:false,duck:false,jump:false,walk:false,yaw:0,pitch:0});
export function friction(v:V,dt:number,config:Readonly<MovementProfile>=movementProfile()):V {const s=speed(v);return s>0?[v[0]*Math.max(0,s-Math.max(s,config.stopSpeed)*config.friction*dt)/s,v[1]*Math.max(0,s-Math.max(s,config.stopSpeed)*config.friction*dt)/s,v[2]]:[...v];}
export function accelerate(v:V,wish:V,wishSpeed:number,dt:number,air:boolean,config:Readonly<MovementProfile>=movementProfile()):V {
  const addSpeed=(air?Math.min(config.airWish,wishSpeed):wishSpeed)-dot(v,wish);
  return addSpeed>0?add(v,mul(wish,Math.min(addSpeed,(air?config.airAccelerate:config.accelerate)*wishSpeed*dt))):v;
}
/** Source-style movement base; plugin formulas live in ckz.ts. No engine-parity claim. */
export class Player {
  duckInput=false;stamina=0;lastDuckTime=-Infinity;duckRecoveryPosition:V=[0,0,0];
  position:V;previous:V;velocity:V=[0,0,0];grounded=false;ducked=false;duckAmount=0;
  ducking=false;duckSpeed=8;rawDuck=false;previousEye=64;
  pre=new Prestrafe();landingTime=-Infinity;landingVelocity:V=[0,0,0];lastTakeoff=0;
  lastPerf:'—'|'PERF'|'NORMAL'='—';lastJumpbug=false;jumps=0;oldDuck=false;noclip=false;contacts:V[]=[];
  ladders?:Collider;onLadder=false;ladderNormal:V=[0,0,0];ignoreLadderJumpUntil=-Infinity;
  rampFix=new RampFix();surfaceFriction=1;
  groundNormal:V=[0,0,1];
  landingContact?:{position:V;fraction:number};
  jumpLog=new JumpLog();
  airDebug:{wishProjection:number;surfaceFriction:number;before:number;afterAcceleration:number;afterCollision:number}|undefined;
  constructor(public world:Collider,public spawn:V,public readonly profile:Readonly<MovementProfile>=movementProfile()){this.position=[...spawn];this.previous=[...spawn];this.duckRecoveryPosition=[...spawn];}
  get height(){return this.ducked?54:72;}
  get eye(){return 64-18*this.duckAmount;}
  reset(){const w=this.world,s=this.spawn,l=this.ladders,log=this.jumpLog;log.cancel();Object.assign(this,new Player(w,s,this.profile));this.ladders=l;this.jumpLog=log;}
  /** CKZ input/slowdown rules over a CS-style fractional duck transition.
   * ducked selects the collision hull; duckAmount also drives view and wish speed.
   * Engine transition details are a compatibility model, not public CS2 source. */
  updateDuck(held:boolean,dt:number,now=0){
    const wasDucked=this.ducked;
    if(this.profile.mode==='ckz'&&!this.ducking)this.duckSpeed=8;
    if(held!==this.rawDuck)this.duckSpeed-=2;
    this.rawDuck=held;
    if(this.profile.mode==='vnl'){
      this.duckSpeed=Math.max(0,this.duckSpeed);
      if(this.duckSpeed<1.5||(!this.ducked&&now<this.lastDuckTime+.4))held=false;
    }
    this.duckSpeed=clamp(this.duckSpeed+3*dt,this.profile.mode==='ckz'?6.0234375:0,8);
    if(this.profile.mode==='vnl'){
      if(this.duckSpeed===8)this.duckRecoveryPosition=[...this.position];
      else if((this.duckAmount===0||this.duckAmount===1)&&speed(sub(this.position,this.duckRecoveryPosition))>64)this.duckSpeed=Math.min(8,this.duckSpeed+6*dt);
    }
    this.duckInput=held;
    const airborne=!this.grounded&&!this.onLadder;
    if(held){
      this.duckAmount=Math.min(1,this.duckAmount+this.duckSpeed*.8*dt);
      if(airborne||this.onLadder||this.duckAmount>=1){
        // The smaller airborne hull keeps its centre: feet rise by 9, head drops by 9.
        // Shrinking stays inside the old hull and adds no velocity.
        if(!this.ducked&&airborne)this.position[2]+=9;
        this.ducked=true;this.duckAmount=1;
      }
    }else if(this.duckAmount>0||this.ducked){
      const proposed:V=[...this.position];
      if(this.ducked&&airborne)proposed[2]-=9;
      const clearance=this.world.trace(this.position,proposed,72);
      if(clearance.startSolid||clearance.fraction<1){
        this.duckAmount=1;this.ducked=true;this.ducking=false;return;
      }
      this.duckAmount=Math.max(0,this.duckAmount-Math.max(this.profile.mode==='vnl'?1.5:0,this.duckSpeed)*dt);
      if(airborne||this.onLadder){this.position=proposed;this.duckAmount=0;}
      // Ground expansion begins partway through the visual transition, after clearance.
      if(this.duckAmount<=.75)this.ducked=false;
    }
    if(this.profile.mode==='vnl'&&!wasDucked&&this.ducked)this.lastDuckTime=now;
    this.ducking=this.duckAmount>0&&this.duckAmount<1;
  }
  jump(now:number,yaw=0,dt:number=this.profile.step,ladderHop=false,jumpbug=false){
    if(!this.grounded)return;
    this.lastJumpbug=jumpbug;
    const elapsed=now-this.landingTime;
    // VNL perf is the first grounded movement step, before ground friction.
    this.lastPerf=!ladderHop&&(this.profile.mode==='ckz'?isPerf(elapsed):elapsed>=-1e-9&&elapsed<=1e-9)?'PERF':'NORMAL';
    if(this.profile.mode==='ckz'&&this.lastPerf==='PERF'){
      const s=perfSpeed(speed(this.landingVelocity),speed(this.velocity),elapsed,this.pre.gain), d=unit([this.landingVelocity[0],this.landingVelocity[1],0]);
      this.velocity[0]=s*d[0];this.velocity[1]=s*d[1];
    }else if(this.profile.mode==='ckz'&&!ladderHop&&speed(this.velocity)>CKZ.groundSpeedCap){
      // Jump runs before ground movement. At the first step outside the perf
      // window, the prior step still exempted ground speed from cropping.
      // Apply the existing local ground cap here too, or this takeoff skips
      // both perf attenuation and the ground cap (e.g. 23.4375 ms after landing).
      const scale=CKZ.groundSpeedCap/speed(this.velocity);
      this.velocity[0]*=scale;this.velocity[1]*=scale;
    }
    // Compatibility model matching recorded CKZ legacy takeoff, not a VNL rule.
    // At 1/128: first displacement is 2.310546875 and final VZ is 292.625.
    // Keep the configured 302 impulse; do not alter gravity on later air steps.
    if(this.profile.mode==='vnl'){
      // StartGravity precedes jumping: standing adds impulse, crouching sets it.
      const half=this.profile.gravity*dt/2;
      this.velocity[2]=-half;
      const total=len(this.velocity),limit=1.1*this.profile.run;
      if(total>limit)this.velocity=mul(this.velocity,limit/total);
      const before=this.velocity[2];
      this.velocity[2]=((this.ducked||this.ducking)?this.profile.jump:before+this.profile.jump)*Math.max(0,1-this.stamina/100)-half;
      this.stamina=clamp(this.stamina+this.profile.staminaJump*(this.velocity[2]-before),0,this.profile.staminaMax);
    }else {
      // Legacy jumping adds impulse to standing VZ, but sets it while ducking.
      // A pre-duck therefore replaces the initial half-gravity debit. Native
      // kuu record 689 ends a crouched takeoff half-step at 295.75 (302 - 6.25).
      this.velocity[2]=this.profile.jump-((this.ducked||this.ducking)?0:this.profile.gravity*dt/2);
    }
    this.grounded=false;this.lastTakeoff=speed(this.velocity);this.jumps++;
    this.jumpLog.begin(this.position,this.groundNormal,now,this.velocity,this.lastPerf,yaw);
  }
  tick(input:Input,now:number,dt:number,jumpRequests:number){
    this.previous=[...this.position];this.previousEye=this.eye;this.contacts=[];this.airDebug=undefined;this.landingContact=undefined;
    const yaw=input.yaw*Math.PI/180, f=Number(input.forward)-Number(input.back),r=Number(input.right)-Number(input.left);
    const wish=unit([Math.cos(yaw)*f+Math.sin(yaw)*r,Math.sin(yaw)*f-Math.cos(yaw)*r,0]);
    if(this.noclip){
      this.jumpLog.cancel();
      const pitch=input.pitch*Math.PI/180;
      this.velocity=mul(unit([Math.cos(pitch)*Math.cos(yaw)*f+Math.sin(yaw)*r,Math.cos(pitch)*Math.sin(yaw)*f-Math.cos(yaw)*r,-Math.sin(pitch)*f]),input.walk?250:900);
      this.position=add(this.position,mul(this.velocity,dt));this.grounded=false;return;
    }
    // jumpRequests already contains accepted edges (including mouse-wheel pulses).
    const forceUnduck=this.profile.mode==='ckz'&&this.grounded&&!this.oldDuck&&jumpRequests>0;
    const inputSpeed=len(this.velocity);
    const staminaScale=Math.pow(Math.max(0,1-this.stamina/100),2);
    this.stamina=Math.max(0,this.stamina-this.profile.staminaRecovery*dt);
    const fallSpeed=this.grounded?0:Math.max(0,-this.velocity[2]);
    const airborneDuck=this.ducked&&!this.grounded&&!this.onLadder;
    let jumpbugLanding=false;
    this.updateDuck(input.duck&&!forceUnduck,dt,now);
    // Source FinishUnDuck calls CategorizePosition before CheckJumpButton.
    // Expanding the air hull can reach ground without a falling impact; that
    // crouchbug has no landing stamina cost and permits a same-command jumpbug.
    if(this.profile.mode==='vnl'&&airborneDuck&&!this.ducked&&this.velocity[2]<=140){
      const ground=this.world.trace(this.position,add(this.position,[0,0,-2]),this.height);
      if(!ground.startSolid&&ground.fraction<1&&ground.normal[2]>=.7){
        // CategorizePosition does not snap an airborne origin to the floor.
        // A same-step jump keeps the residual gap; walking will settle it.
        this.grounded=true;this.groundNormal=ground.normal;
        jumpbugLanding=this.velocity[2]<0;
        this.landingTime=now;this.landingVelocity=[...this.velocity];this.surfaceFriction=1;
        this.jumpLog.update(this.position,this.velocity,true,this.groundNormal,[],now,r);
      }
    }
    this.oldDuck=forceUnduck||input.duck;
    const wasOnLadder=this.onLadder;
    let ladderHop=false;
    this.onLadder=false;
    if(this.ladders){
      const intent=mul(ladderWish(input.yaw,input.pitch,f,r),(this.duckInput||input.walk)?.34:1);
      const direction=wasOnLadder?mul(this.ladderNormal,-1):unit(intent);
      if(wasOnLadder||f||r){
        const ladder=this.ladders.trace(this.position,add(this.position,mul(direction,wasOnLadder?10:2)),this.height);
        if(ladder.fraction<1&&!ladder.startSolid&&Math.abs(ladder.normal[2])<0.7){
          this.jumpLog.cancel();
          // Ladder movement still has floor contact. Losing this state used to
          // turn the first jump into a horizontal kick followed by a landing.
          const floor=this.world.trace(this.position,add(this.position,[0,0,-1]),this.height);
          const onFloor=floor.fraction<1&&!floor.startSolid&&floor.normal[2]>=.7;
          this.grounded=onFloor;
          if(onFloor)this.groundNormal=floor.normal;
          if(!wasOnLadder)this.ignoreLadderJumpUntil=now+.2;
          this.onLadder=true;this.ladderNormal=ladder.normal;this.surfaceFriction=1;
          const wantsJump=jumpRequests>0||input.jump;
          if(wantsJump&&now>=this.ignoreLadderJumpUntil){
            this.velocity=mul(ladder.normal,270);this.onLadder=false;ladderHop=true;
            // The same press reaches normal ground jumping after LadderMove.
            if(onFloor)jumpRequests=Math.max(1,jumpRequests);
          }else{
            // Source leaves velocity untouched while jump is protected on a
            // new grab. Re-grabbing after a kick can therefore glide outward
            // until release, provided the hull remains within ladder reach.
            if(!wantsJump)this.velocity=ladderVelocity(intent,ladder.normal,onFloor,this.profile.mode==='vnl');
            else if(onFloor&&jumpRequests>0)this.jump(now,input.yaw,dt,true);
            this.slide(dt);return;
          }
        }
      }
    }
    if(this.profile.mode==='ckz')this.pre.update(now+dt,dt,this.grounded,this.landingTime,this.velocity,wish);
    const jumping=this.grounded&&jumpRequests>0;
    if(jumpRequests>0)this.jump(now,input.yaw,dt,ladderHop,jumpbugLanding&&!ladderHop);
    const startedGround=this.grounded;
    // Gravity brackets displacement. CS2 jump/duck subtick internals remain approximations.
    if(!this.grounded){if(!(jumping&&this.profile.mode==='vnl'))this.velocity[2]-=this.profile.gravity*dt/2;}
    else {this.velocity[2]=0;this.velocity=friction(this.velocity,dt,this.profile);}
    const vanilla=this.profile.mode==='vnl';
    const walking=input.walk&&this.duckAmount===0;
    // Source only crops walk wish speed once actual speed is near walking speed.
    // Holding walk during a fast air strafe must not halve its acceleration budget.
    const walkCrop=walking&&inputSpeed<this.profile.run*.52+25;
    const max=(this.profile.run+(this.grounded&&!vanilla?this.pre.groundGain:0))*(vanilla?staminaScale:1)*(this.duckAmount>0?1-.66*this.duckAmount:walkCrop?.52:1);
    if(!this.grounded)this.airDebug={wishProjection:dot(this.velocity,wish),surfaceFriction:this.surfaceFriction,before:speed(this.velocity),afterAcceleration:0,afterCollision:0};
    if(vanilla&&this.grounded){
      const projection=dot(this.velocity,wish),scale=this.profile.run*(this.duckInput||this.duckAmount>0?.34:walking?.52:1);
      const accel=this.profile.accelerate*(walking?clamp((scale-Math.max(0,projection))/5,0,1):1);
      const gain=Math.min(Math.max(0,((f||r)?max:0)-projection),accel*scale*dt*this.surfaceFriction);
      this.velocity=add(this.velocity,mul(wish,gain));
      const total=len(this.velocity),cap=max;
      if(total>cap)this.velocity=mul(this.velocity,cap/total);
    }else this.velocity=accelerate(this.velocity,wish,(f||r)?max:0,dt*this.surfaceFriction,!this.grounded,this.profile);
    if(this.airDebug)this.airDebug.afterAcceleration=speed(this.velocity);
    // Requested local profile: ground prestrafe is hard-capped at 275.
    // Takeoff is processed before ground friction/cropping, preserving valid perf carry.
    if(!vanilla&&this.grounded&&!isPerf(now-this.landingTime)&&speed(this.velocity)>CKZ.groundSpeedCap){const scale=CKZ.groundSpeedCap/speed(this.velocity);this.velocity[0]*=scale;this.velocity[1]*=scale;}
    this.velocity=this.velocity.map(v=>clamp(v,-this.profile.maxVelocity,this.profile.maxVelocity)) as V;
    if(vanilla&&this.grounded&&len(this.velocity)<1)this.velocity=[0,0,0];
    const incoming:V=[...this.velocity];
    if(this.grounded){this.stepMove(dt);this.stayOnGround();}else this.slide(dt);
    const groundEnd=add(this.position,[0,0,-2]);
    const rawGround=this.world.trace(this.position,groundEnd,this.height);
    const ground=vanilla?rawGround:fixGround(this.world,this.position,groundEnd,this.height,rawGround);
    const categorizedZ=this.velocity[2];
    let measuredLanding:{position:V;time:number}|undefined;
    this.grounded=this.velocity[2]<=140&&ground.fraction<1&&ground.normal[2]>=0.7&&!ground.startSolid;
    if(this.grounded){
      if(!startedGround&&this.profile.mode==='ckz'&&ground.normal[2]>=.999999){
        // Match CKZ RegisterLanding's distance correction; never move the player.
        // Prefer the actual flat impact over the end of its remaining slide.
        // slide() fills this after the per-tick reset; TS does not track that mutation.
        const contact=this.landingContact as {position:V;fraction:number}|undefined;
        if(contact)measuredLanding={position:contact.position,time:now+dt*contact.fraction};
        else {
          // Ground categorization can snap down up to two units before impact.
          const gap=this.position[2]-ground.end[2],vz=incoming[2],g=this.profile.gravity;
          if(gap>.03125&&vz<0){
            const extra=(vz+Math.sqrt(vz*vz+2*g*gap))/g;
            measuredLanding={position:[this.position[0]+incoming[0]*extra,this.position[1]+incoming[1]*extra,ground.end[2]],time:now+dt+extra};
          }
        }
      }
      this.groundNormal=ground.normal;
      // Source CategorizePosition only moves to the trace endpoint when the
      // player was already walking on ground. A new landing within the 2-unit
      // probe retains its height until WalkMove, or an immediate bhop.
      if(!vanilla||startedGround)this.position=ground.end;
      if(!startedGround){
        this.landingTime=now+dt;this.landingVelocity=incoming;
        if(vanilla)this.stamina=clamp(this.stamina+this.profile.staminaLand*fallSpeed,0,this.profile.staminaMax);
        // CKZ SlopeFix: only retain a downhill clip if it increases horizontal speed.
        const projected=clip(incoming,ground.normal);
        if(!vanilla&&ground.normal[2]<0.999999&&speed(projected)>=speed(incoming)){
          this.velocity[0]=projected[0];this.velocity[1]=projected[1];this.landingVelocity=[...projected];
        }
      }
      this.velocity[2]=0;
    }else this.velocity[2]-=this.profile.gravity*dt/2;
    // Source engine's unsupported slow-rise air-control factor, separate from stamina.
    const frictionZ=vanilla?categorizedZ:this.velocity[2];
    this.surfaceFriction=!this.grounded&&frictionZ>0&&frictionZ<140?.25:1;
    if(this.airDebug)this.airDebug.afterCollision=speed(this.velocity);
    this.jumpLog.update(this.position,this.velocity,this.grounded,this.groundNormal,this.contacts,now+dt,r,this.airDebug,this.airDebug&&this.jumpLog.pending?{
      ...this.airDebug,airAccelerate:this.profile.airAccelerate,airWish:this.profile.airWish,stepHz:1/this.profile.step,time:now+dt,dt,position:[...this.position],velocity:[...this.velocity],
      yaw:input.yaw,pitch:input.pitch,forward:input.forward,back:input.back,left:input.left,right:input.right,duck:input.duck,
      duckAmount:this.duckAmount,duckSpeed:this.duckSpeed,hullHeight:this.height,eyeHeight:this.eye,wishSpeed:(f||r)?max:0,
    }:undefined,this.world,measuredLanding);
  }
  /** Source-style plane/crease sliding; not the full CS2 ClipVelocity/trace solver.
   * See docs/PHYSICS-AUDIT.md before reusing this for another movement mode. */
  slide(dt:number){
    this.rampFix.stuckCount=0;
    let remaining=dt, original:V=[...this.velocity];const primal:V=[...this.velocity],planes:V[]=[];
    for(let bump=0;bump<4;bump++){
      const end=add(this.position,mul(this.velocity,remaining));
      const tr=this.profile.mode==='ckz'?this.rampFix.trace(this.world,this.position,end,this.height):this.world.trace(this.position,end,this.height);
      if(tr.startSolid){this.velocity=[0,0,0];return;}
      if(tr.fraction>0){this.position=tr.end;original=[...this.velocity];planes.length=0;}
      if(tr.fraction===1)break;
      remaining*=1-tr.fraction;this.contacts.push(tr.normal);
      if(!this.grounded&&tr.normal[2]>=.999999&&!this.landingContact)this.landingContact={position:[...tr.end],fraction:1-remaining/dt};
      if(!planes.some(p=>dot(p,tr.normal)>0.99))planes.push(tr.normal);
      let solved=false;
      for(const n of planes){const candidate=clip(original,n);if(planes.every(p=>dot(candidate,p)>=-1e-7)){this.velocity=candidate;solved=true;break;}}
      if(!solved){if(planes.length!==2){this.velocity=[0,0,0];return;}const crease=unit(cross(planes[0],planes[1]));this.velocity=mul(crease,dot(original,crease));}
      if(dot(this.velocity,primal)<=0){this.velocity=[0,0,0];return;}
    }
  }
  /** Source up/forward/down candidate compared with direct displacement. */
  stepMove(dt:number){
    const start:V=[...this.position],v:V=[...this.velocity];this.slide(dt);
    const direct:V=[...this.position],directV:V=[...this.velocity];
    // Local compatibility guard, not an upstream CKZ hook or verified CS2 StepMove.
    // A ramp clip can launch a fast ground contact into an uphill slide. Keep
    // its actual displacement and clipped velocity together: the stair path
    // would otherwise restore full XY speed while borrowing this upward Z,
    // adding kinetic energy (the legacy Source "no-jump step boost").
    if(this.profile.mode==='ckz'&&directV[2]>140)return;
    if(speed(sub(direct,add(start,mul(v,dt))))<0.001)return;
    const up=this.world.trace(start,add(start,[0,0,18]),this.height);
    if(up.startSolid||up.fraction<1)return;
    this.position=up.end;this.velocity=v;this.slide(dt);
    const down=this.world.trace(this.position,add(this.position,[0,0,-18]),this.height);
    if(down.startSolid||down.fraction===1||down.normal[2]<0.7||speed(sub(down.end,start))<=speed(sub(direct,start))){this.position=direct;this.velocity=directV;}
    else{this.position=down.end;this.velocity[2]=directV[2];}
  }
  /** Walking follows descending terrain by at most one step, never an air slide. */
  stayOnGround(){
    if(this.velocity[2]>140)return;
    const up=this.world.trace(this.position,add(this.position,[0,0,2]),this.height);
    if(up.startSolid)return;
    const end=add(this.position,[0,0,-this.profile.stepHeight]);
    const raw=this.world.trace(up.end,end,this.height);
    const ground=this.profile.mode==='ckz'?fixGround(this.world,up.end,end,this.height,raw):raw;
    if(!ground.startSolid&&ground.fraction>0&&ground.fraction<1&&ground.normal[2]>=.7)this.position=ground.end;
  }
}
