import type {FlatJump} from './physics/jump-log';
export function formatJumpStats(j:Pick<FlatJump,'takeoffSpeed'|'maxSpeed'|'maxHeight'|'strafes'>&{diagnostics?:{sync:number}},compact=false){
  const sync=j.diagnostics?.sync,lines=[`PRE ${j.takeoffSpeed.toFixed(1)} · MAX ${j.maxSpeed.toFixed(1)}`,`HEIGHT ${j.maxHeight.toFixed(2)} · SYNC ${sync==null?'—':`${sync.toFixed(1)}%`} · ${j.strafes} strafes`];
  return lines.join(compact?' · ':'\n');
}
/** Plain text is also embedded in the JSON export, for easy comparison/pasting. */
export function formatJump(j:FlatJump){
  const d=j.diagnostics,g=j.geometry,f=(n:number|undefined|null,digits=2)=>n==null?'N/A':n.toFixed(digits);
  const lines=[
    `FLAT: ${f(j.distance,5)} [Block*: ${f(g?.block)} | Edge*: ${f(g?.edge)} | Veer*: ${f(d?.veer)}]`,
    `[Fwd: ${f(d?.forwardSteps,0)} | Sync: ${f(d?.sync)} | Max: ${f(j.maxSpeed,3)}]`,
    `[Land Edge*: ${f(g?.landEdge)} | Pre: ${f(j.takeoffSpeed,4)} | OL/DA: ${f(d?.overlap,0)}/${f(d?.deadAir,0)}]`,
    `[Jumpoff Angle*: ${f(d?.jumpOffAngle,3)} | Airpath: ${f(d?.airpath,4)}]`,
    `[Strafes: ${j.strafes} | Airtime: ${f(d?.airtimeSteps,0)} | ${d?.direction??'N/A'} | Height: ${f(j.maxHeight,4)}]`,
    `[Raw distance: ${f(j.rawDistance??j.distance,5)} | Landing adjustment: ${f(j.landingAdjustment??0,5)}]`,
    `Δ reference: distance ${f(j.distance-284.08422)} | max ${f(j.maxSpeed-379.688)} | height ${f(j.maxHeight-55.8281)}`,
    '#  Sync%  Gain  Loss   Max  Air OL DA AvgGain AvgEff% MaxEff%',
  ];
  for(const r of d?.rows??[])lines.push([
    String(r.number).padStart(2),f(r.sync,1).padStart(6),f(r.gain).padStart(5),f(r.loss).padStart(5),
    f(r.max,1).padStart(6),f(r.air,0).padStart(3),f(r.ol,0).padStart(2),f(r.da,0).padStart(2),
    f(r.avgGain).padStart(7),f(r.efficiency,0).padStart(7),f(r.maxEfficiency,0).padStart(7),
  ].join(' '));
  lines.push(`Air loss ${f(j.airLoss)} · Contact loss ${f(j.contactLoss)}`,
    '* Geometry/angle estimates; N/A when no single gap detected.',
    'Efficiency uses the active air-acceleration profile; native stat equivalence unverified.',
    `Air/OL/DA use ${j.samples[0]?.stepHz??128} Hz movement steps. Raw samples are in the JSON download.`);
  return lines.join('\n');
}
