import {type V} from './math';
import type {Simulation} from './clock';
export interface Checkpoint {position:V;yaw:number;pitch:number;ducked:boolean;grounded:boolean;groundNormal:V;onLadder:boolean;ladderNormal:V}
export class Checkpoints {
  points:Checkpoint[]=[];selected=-1;teleports=0;undoPoint:Checkpoint|undefined;
  constructor(public sim:Simulation){}
  clear(){this.points=[];this.selected=-1;this.teleports=0;this.undoPoint=undefined;}
  snapshot(yaw:number,pitch:number):Checkpoint {const p=this.sim.player;return {position:[...p.position],yaw,pitch,ducked:p.ducked,grounded:p.grounded,groundNormal:[...p.groundNormal],onLadder:p.onLadder,ladderNormal:[...p.ladderNormal]};}
  save(yaw:number,pitch:number){
    const p=this.sim.player;if(p.noclip||(!p.grounded&&!p.onLadder))return 'Checkpoint requires ground or ladder contact';
    this.points.push(this.snapshot(yaw,pitch));this.selected=this.points.length-1;return `Checkpoint ${this.selected+1} saved`;
  }
  restore(point:Checkpoint){
    const p=this.sim.player;
    if(p.world.trace(point.position,point.position,point.ducked?54:72).startSolid)return false;
    p.reset();p.position=[...point.position];p.previous=[...point.position];p.ducked=point.ducked;p.duckAmount=point.ducked?1:0;p.previousEye=p.eye;
    p.grounded=point.grounded;p.groundNormal=[...point.groundNormal];p.onLadder=point.onLadder;p.ladderNormal=[...point.ladderNormal];
    this.sim.input.yaw=point.yaw;this.sim.input.pitch=point.pitch;this.sim.previousYaw=point.yaw;this.sim.desiredYaw=point.yaw;this.sim.previousPitch=point.pitch;this.sim.desiredPitch=point.pitch;
    this.sim.events=[];this.sim.teleportYaw=point.yaw;this.sim.teleportPitch=point.pitch;this.sim.transport?.clearContacts();
    this.sim.timer?.teleport();this.teleports++;return true;
  }
  teleport(offset:number,yaw:number,pitch:number){
    if(!this.points.length)return 'No checkpoints saved';
    const index=Math.max(0,Math.min(this.points.length-1,this.selected+offset));
    const undo=this.snapshot(yaw,pitch);
    if(!this.restore(this.points[index]))return 'Checkpoint is blocked';
    this.undoPoint=undo;this.selected=index;return `Teleported to checkpoint ${index+1}`;
  }
  undo(yaw:number,pitch:number){
    if(!this.undoPoint)return 'No teleport to undo';
    if(!this.undoPoint.grounded&&!this.undoPoint.onLadder)return 'Cannot undo a teleport made in midair';
    const back=this.snapshot(yaw,pitch);
    if(!this.restore(this.undoPoint))return 'Undo position is blocked';
    this.undoPoint=back;return 'Teleport undone';
  }
}
