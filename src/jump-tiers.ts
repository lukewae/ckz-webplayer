import type {FlatJump} from './physics/jump-log';
export const jumpTiers=[
  {key:'impressive',label:'Impressive',color:'#5e98d9'},
  {key:'perfect',label:'Perfect',color:'#40ff40'},
  {key:'godlike',label:'Godlike',color:'#ff0000'},
  {key:'ownage',label:'Ownage',color:'#e4ae39'},
  {key:'wrecker',label:'Wrecker',color:'#d32ce6'},
] as const;
export type JumpTier=typeof jumpTiers[number]['key'];
export type JumpKind='lj'|'bhop'|'multibhop';
// CS2KZ Classic; GOKZ CS:GO Vanilla (our Vanilla simulation is CS:GO based).
export const jumpThresholds={ckz:{lj:[265,270,275,280,284],bhop:[275,280,287,292,295],multibhop:[275,280,287,292,295]},vnl:{lj:[235,240,245,248,250],bhop:[230,233,235,238,240],multibhop:[235,240,245,248,250]}} as const;
export function jumpRating(distance:number,mode:'ckz'|'vnl'='ckz',kind:JumpKind='lj'){
  if(!Number.isFinite(distance))return undefined;
  const thresholds=jumpThresholds[mode][kind];
  for(let i=thresholds.length-1;i>=0;i--)if(distance>=thresholds[i])return jumpTiers[i];
  return undefined;
}
/** Presentation-only inference from completed, same-height flat jumps; never writes movement. */
export function jumpKinds(records:readonly FlatJump[]){
  const result=new Map<number,JumpKind>();
  for(let i=0;i<records.length;i++){
    const j=records[i],previous=records[i-1],start=j.samples[0],end=previous?.samples.at(-1);
    const gap=start&&end?start.time-start.dt-end.time:Infinity;
    const continuous=previous&&j.id===previous.id+1&&gap>=-1e-6&&gap<=.05+1e-6&&Math.hypot(...j.takeoff.map((v,k)=>v-previous.landing[k]))<32;
    const kind:JumpKind=continuous?(result.get(previous.id)==='lj'?'bhop':'multibhop'):'lj';result.set(j.id,kind);
  }
  return result;
}
