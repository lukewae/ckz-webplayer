// Direct structural port of CKZ FixTryPlayerMoveTrace / FixGroundTrace (AGPL-3.0-only).
// Underlying traces are our SAT surface traces, so these fixes do not establish engine parity.
import {type Collider,type Trace} from './collision';
import {type V,add,sub,mul,dot,len,unit} from './math';
export function fixGround(world:Collider,start:V,end:V,height:number,trace:Trace):Trace {
  if(trace.fraction===1||trace.startSolid||trace.normal[2]<.7)return trace;
  const small=world.trace(start,end,height,16-.0625);
  if(small.fraction===1||small.startSolid||small.normal[2]>=.7)return trace;
  const direction=unit([-small.normal[0],-small.normal[1],0]);
  const wall=world.trace(trace.end,add(trace.end,mul(direction,.0625)),height);
  return wall.fraction<.5&&!wall.startSolid?{...trace,normal:small.normal}:trace;
}
export class RampFix {
  lastPlane:V=[0,0,0];stuckCount=0;
  trace(world:Collider,start:V,end:V,height:number):Trace {
    let tr=world.trace(start,end,height);const direction=unit(sub(end,start)),length=len(sub(end,start)),last=this.lastPlane,offsetSize=.03125;
    if(tr.fraction<1&&!tr.startSolid&&len(last)>0&&length>0&&(dot(tr.normal,last)<.999||tr.fraction*length<offsetSize)){
      let success=false;const stuck=this.stuckCount>=2;
      const near=world.trace(add(tr.end,mul(last,offsetSize)),sub(tr.end,mul(last,offsetSize*2)),height);
      if(near.fraction<1&&!near.startSolid&&dot(near.normal,last)>=.999){
        const offset=mul(last,offsetSize),candidate=world.trace(add(start,offset),add(end,offset),height);
        const distance=dot(sub(candidate.end,tr.end),direction),samePlane=dot(candidate.normal,last)>=.99;
        success=!candidate.startSolid&&distance>offsetSize&&(stuck||candidate.fraction===1||distance>1||samePlane);
        if(success)tr=candidate;
      }
      if(!success&&stuck&&tr.fraction*length<offsetSize){
        const n=tr.normal;let other:V=[0,0,0];
        if(dot(n,last)<.999)other=last;
        else{const probe=world.trace(start,add(start,mul(n,offsetSize*2)),height);if(probe.fraction<1&&!probe.startSolid&&dot(probe.normal,n)<.999)other=probe.normal;}
        if(len(other)>0&&dot(other,n)>-.99){let offset=unit(add(n,other));offset=mul(offset,Math.min(offsetSize/dot(n,offset),1));const candidate=world.trace(add(start,offset),add(end,offset),height);if(!candidate.startSolid&&dot(sub(candidate.end,tr.end),direction)>offsetSize)tr=candidate;}
      }
    }
    tr=fixGround(world,start,end,height,tr);
    if(tr.fraction<1&&!tr.startSolid){if(dot(tr.normal,tr.normal)>.98)this.lastPlane=tr.normal;if(tr.fraction*length<offsetSize)this.stuckCount++;}
    return tr;
  }
}
