import {type V,dot} from './math';
export type Hull={normal:V;dist:number}[];
/** Swept player-hull overlap with a union of convex trigger hulls. */
export function zoneIntervals(hulls:Hull[],start:V,end:V,height:number){
  const intervals:{enter:number;leave:number}[]=[];
  for(const hull of hulls){let enter=0,leave=1,valid=true;
    for(const {normal:n,dist} of hull){
      const offset=(Math.abs(n[0])+Math.abs(n[1]))*15.96875+(n[2]<0?-n[2]*(height-.03125):-n[2]*.03125);
      const a=dot(start,n)-dist-offset,b=dot(end,n)-dist-offset;
      if(a>0&&b>0){valid=false;break;}
      if(a>b)enter=Math.max(enter,a/(a-b));else if(a<b)leave=Math.min(leave,a/(a-b));
      if(enter>leave){valid=false;break;}
    }
    if(valid)intervals.push({enter,leave});
  }
  intervals.sort((a,b)=>a.enter-b.enter);
  const merged:typeof intervals=[];
  for(const interval of intervals){const last=merged.at(-1);if(last&&interval.enter<=last.leave+1e-9)last.leave=Math.max(last.leave,interval.leave);else merged.push({...interval});}
  return merged;
}
