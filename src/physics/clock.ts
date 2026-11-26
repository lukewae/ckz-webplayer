import { Player, emptyInput, type Input } from './movement';
import type {MapTransport} from './transport';
import type {CourseTimer} from './timer';
export type InputEvent = { time:number; key?:keyof Input; value?:boolean|number; pulse?:boolean };
/** Ordered edges are retained even when several snap into one half tick.
 * A complete 64 Hz command supplies both half-steps' desired view angles.
 * Keys retain their snapped half-tick times; the first view angle is interpolated. */
export class Simulation {
  time=0;tick=0;input=emptyInput();events:InputEvent[]=[];lastRelease=-Infinity;oldJump=false;
  vanillaCommandJump=false;
  history:unknown[]=[];logging=false;
  previousYaw=0;desiredYaw=0;previousPitch=0;desiredPitch=0;
  transport?:MapTransport;teleportYaw?:number;teleportPitch?:number;timer?:CourseTimer;
  onBeforeStep?:()=>void;
  onStep?:(input:Input,jumps:number,time:number,teleported:boolean)=>void;
  constructor(public player:Player){}
  get step(){return this.player.profile.step;}
  get commandSteps(){return this.player.profile.commandSteps;}
  enqueue(event:InputEvent){const last=this.events.at(-1);this.events.push(event);if(last&&last.time>event.time)this.events.sort((a,b)=>a.time-b.time);}
  reset(){this.time=0;this.tick=0;this.input=emptyInput();this.events=[];this.lastRelease=-Infinity;this.oldJump=false;this.vanillaCommandJump=false;this.history=[];this.previousYaw=0;this.desiredYaw=0;this.previousPitch=0;this.desiredPitch=0;this.player.reset();this.transport?.reset();this.timer?.reset();this.teleportYaw=undefined;this.teleportPitch=undefined;}
  advance(target:number,availableInputTime=target){
    const vanilla=this.player.profile.mode==='vnl';
    while((this.tick+1)*this.step<=target+1e-10){
      if(this.tick%this.commandSteps===0){
        const commandEnd=(this.tick+this.commandSteps)*this.step;
        if(commandEnd>availableInputTime+1e-10)break;
        this.desiredYaw=this.input.yaw;this.desiredPitch=this.input.pitch;
        for(const e of this.events){
          if(e.time>=commandEnd-1e-10)break;
          if(e.key==='yaw')this.desiredYaw=Number(e.value);
          if(e.key==='pitch')this.desiredPitch=Number(e.value);
        }
        if(vanilla){
          // Source CalcButtonBits samples held OR impulse-down once per command.
          // A wheel press/release still sets IN_JUMP for that whole command.
          let held=this.input.jump,pressed=false;
          for(const e of this.events){
            if(e.time>=commandEnd-1e-10)break;
            if(e.pulse)pressed=true;
            else if(e.key==='jump'){pressed ||= Boolean(e.value)&&!held;held=Boolean(e.value);}
          }
          this.vanillaCommandJump=held||pressed;
        }
      }
      let jumps=0;
      while(this.events.length&&(Math.floor((this.events[0].time+1e-10)/this.step)*this.step)<=this.time+1e-10){
        const e=this.events.shift()!;
        if(vanilla&&(e.pulse||e.key==='jump')){if(e.key==='jump')this.input.jump=Boolean(e.value);}
        else if(e.pulse){if(!this.oldJump||e.time-this.lastRelease>this.step)jumps++;this.lastRelease=e.time;this.oldJump=true;}
        else if(e.key==='jump'){
          if(!e.value)this.lastRelease=e.time;
          else if(!this.input.jump&&(!this.oldJump||e.time-this.lastRelease>this.step))jumps++;
          this.input.jump=Boolean(e.value);
        }else if(e.key)(this.input as unknown as Record<string,boolean|number>)[e.key]=e.value!;
      }
      if(vanilla)jumps=this.vanillaCommandJump&&!this.oldJump?1:0;
      // CKZ interpolates the first forced half step, restores the desired angle afterward.
      this.input.yaw=this.desiredYaw;this.input.pitch=this.desiredPitch;
      let movementYaw=this.desiredYaw,movementPitch=this.desiredPitch;
      if(this.commandSteps===2&&this.tick%2===0){
        const delta=((this.desiredYaw-this.previousYaw)%360+540)%360-180;
        movementYaw=this.previousYaw+delta*.5;movementPitch=(this.previousPitch+this.desiredPitch)*.5;
      }
      const movementInput={...this.input,jump:vanilla?this.vanillaCommandJump:this.input.jump,yaw:movementYaw,pitch:movementPitch};
      this.onBeforeStep?.();
      if(this.transport?.blocksJump(this.player,this.time))jumps=0;
      const wasGrounded=this.player.grounded;
      this.player.tick(movementInput,this.time,this.step,jumps);
      this.previousYaw=this.desiredYaw;this.previousPitch=this.desiredPitch;
      this.timer?.update(this.player,this.time,this.step,wasGrounded);
      const teleportYaw=this.transport?.process(this.player,this.time,this.step,wasGrounded,movementInput.yaw);
      if(teleportYaw!==undefined){
        this.teleportYaw=teleportYaw;this.input.yaw=teleportYaw;this.previousYaw=teleportYaw;this.desiredYaw=teleportYaw;
        if(this.transport?.pitch!==undefined){this.teleportPitch=this.transport.pitch;this.input.pitch=this.transport.pitch;this.previousPitch=this.transport.pitch;this.desiredPitch=this.transport.pitch;}
        if(this.timer){this.timer.touching.clear();this.timer.groundedInStart=false;this.timer.update(this.player,this.time+this.step,0,false);}
      }
      this.oldJump=movementInput.jump;
      this.time=++this.tick*this.step;
      this.onStep?.(movementInput,jumps,this.time,teleportYaw!==undefined);
      if(this.logging){this.history.push({t:this.time,p:[...this.player.position],v:[...this.player.velocity],g:this.player.grounded,input:movementInput,desiredYaw:this.desiredYaw,air:this.player.airDebug,contacts:this.player.contacts});if(this.history.length>2048)this.history.shift();}
    }
  }
}
