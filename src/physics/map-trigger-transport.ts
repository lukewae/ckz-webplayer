import {MapTransport,type Transport} from './transport';
import type {Player} from './movement';
import {zoneIntervals} from './zones';
import type {V} from './math';

interface ContextAction {action:'ClearContext'|'AddContext'|'RemoveContext';name?:string;delay:number}
export interface MapTrigger extends Transport {
  type:number;delay:number;pitch?:number;antiBhopTime?:number;
  contextFilter:{name:string;negated:boolean}|null;
  contexts:ContextAction[];
  relative?:boolean;sourceOrigin?:V;resetSpeed?:boolean;useDestinationAngles?:boolean;
}
/** Audited map context/teleport subset. Movement rules are unchanged. */
export class MapTriggerTransport extends MapTransport {
  contexts=new Set<string>();entered=new Map<string,number>();
  pending:{at:number;order:number;action:ContextAction}[]=[];serial=0;
  lastBhop?:string;sequential=new Set<string>();
  constructor(public triggers:MapTrigger[]){super(triggers);}
  override clearContacts(){super.clearContacts();this.entered.clear();this.lastBhop=undefined;this.sequential.clear();}
  override reset(){super.reset();this.contexts.clear();this.entered.clear();this.pending=[];this.serial=0;this.lastBhop=undefined;this.sequential.clear();this.pitch=undefined;}
  private flush(time:number){
    this.pending.sort((a,b)=>a.at-b.at||a.order-b.order);
    while(this.pending.length&&this.pending[0].at<=time+1e-9){const {action:a}=this.pending.shift()!;
      if(a.action==='ClearContext')this.contexts.clear();
      else if(a.name){if(a.action==='AddContext')this.contexts.add(a.name);else this.contexts.delete(a.name);}
    }
  }
  override blocksJump(player:Player,time:number){
    if(player.noclip)return false;
    this.flush(time);
    return this.triggers.some(v=>v.type===4&&(!v.contextFilter||this.contexts.has(v.contextFilter.name)!==v.contextFilter.negated)&&
      zoneIntervals(v.hulls,player.position,player.position,player.height).length>0&&
      ((v.antiBhopTime??0)===0||!player.grounded||time-player.landingTime<=(v.antiBhopTime??0)));
  }
  override process(player:Player,time=0,dt=0,wasGrounded=player.grounded,currentYaw=0):number|undefined {
    this.pitch=undefined;if(player.noclip){this.clearContacts();return;}
    this.flush(time);
    const contacts=this.triggers.flatMap(volume=>zoneIntervals(volume.hulls,player.previous,player.position,player.height).map(interval=>({volume,...interval}))).sort((a,b)=>a.enter-b.enter);
    const touching=new Set<string>();const processed=new Set<string>();
    for(const {volume:v,enter,leave} of contacts){
      const at=time+enter*dt;this.flush(at);
      const filter=v.contextFilter;
      if(filter&&(this.contexts.has(filter.name)===filter.negated))continue;
      if(leave===1)touching.add(v.id);
      if(processed.has(v.id))continue;processed.add(v.id);
      const entered=this.touching.has(v.id)?this.entered.get(v.id)??at:at;
      this.entered.set(v.id,entered);
      if(!this.touching.has(v.id))for(const action of v.contexts)this.pending.push({at:at+action.delay,order:this.serial++,action});
      this.flush(at);
      const bhop=v.type>=11&&v.type<=13;
      // Native single/sequential history records the block on ground departure.
      if(bhop&&wasGrounded&&!player.grounded){this.lastBhop=v.id;if(v.type===13)this.sequential.add(v.id);}
      if(!v.destination)continue;
      const end=time+leave*dt;
      const start=bhop?Math.max(entered,player.landingTime):entered;
      const repeat=bhop&&(v.type===12&&this.lastBhop===v.id||v.type===13&&this.sequential.has(v.id));
      if(bhop&&!player.grounded)continue;
      const delay=bhop?Math.max(.1,v.delay):v.delay;
      if(!repeat&&(delay>0?end-start<=delay:bhop&&end-start<=0))continue;
      // Reuse the existing teleport reset behavior without changing movement.
      const velocity:V=[...player.velocity];
      const destination:V=v.relative?v.destination.map((n,k)=>n+player.position[k]-v.sourceOrigin![k]) as V:v.destination;
      const yaw=new MapTransport([{...v,destination,yaw:v.useDestinationAngles===false?currentYaw:v.yaw,addPass:false,removePass:false,requiresPass:null}]).process(player);
      if(yaw===undefined)continue;
      if(v.resetSpeed===false)player.velocity=velocity;
      this.pitch=v.useDestinationAngles===false?undefined:v.pitch;this.touching.clear();this.entered.clear();this.lastBhop=undefined;this.sequential.clear();this.teleports++;return yaw;
    }
    this.flush(time+dt);
    for(const id of this.entered.keys())if(!touching.has(id))this.entered.delete(id);
    if((player.grounded||player.onLadder)&&!this.triggers.some(v=>v.type>=11&&v.type<=13&&touching.has(v.id))){this.lastBhop=undefined;this.sequential.clear();}
    this.touching=touching;return undefined;
  }
}
