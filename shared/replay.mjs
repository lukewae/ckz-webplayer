export const REPLAY_VERSION=1;
export const REPLAY_PHYSICS='ckz-browser-2026-10-17-landing';
export const MAX_REPLAY_SECONDS=600;
export const MAX_REPLAY_BYTES=24*1024*1024;
// t, x,y,z, eye, yaw,pitch, vx,vy,vz, buttons, jump requests, grounded,
// duck amount, duck speed, movement yaw,pitch, discontinuity
export function validateReplay(value){
  const fail=()=>{throw Object.assign(Error('Invalid or unsupported replay.'),{status:400});};
  const preRoll=value?.preRoll??0;
  const movement=value?.movement;
  const vnl=movement?.mode==='vnl';
  if(vnl){
    if(Object.keys(movement).some(k=>!['mode','timing','airAccelerate'].includes(k))||!['64','128','64x128'].includes(movement.timing)||!Number.isFinite(movement.airAccelerate)||movement.airAccelerate<0||movement.airAccelerate>1000||![1,2,3,4,5,6].some(v=>value.physics===`csgo-vnl-v${v}-${movement.timing}-aa${movement.airAccelerate}`)||value.hz!==(movement.timing==='64'?64:128))fail();
  }else if(movement!==undefined||value?.hz!==128||!['ckz-browser-2026-10-11','ckz-browser-2026-10-12-slopes','ckz-browser-2026-10-12-takeoff','ckz-browser-2026-10-12-contact','ckz-browser-2026-10-13-duck','ckz-browser-2026-10-13-ladder',REPLAY_PHYSICS].includes(value?.physics))fail();
  const hz=value?.hz;
  if(!Number.isFinite(preRoll)||preRoll<0||preRoll>1)fail();
  if(!value||value.version!==REPLAY_VERSION||
    typeof value.map!=='string'||!/^\d{10}$/.test(value.map)||typeof value.course!=='string'||value.course.length>100||
    typeof value.mapHash!=='string'||! /^[a-f0-9]{64}$/.test(value.mapHash)||
    typeof value.collisionHash!=='string'||! /^[a-f0-9]{64}$/.test(value.collisionHash)||
    !Number.isFinite(value.duration)||value.duration<=0||value.duration>MAX_REPLAY_SECONDS||
    !Array.isArray(value.frames)||value.frames.length<2||value.frames.length>(MAX_REPLAY_SECONDS+1)*hz+4)fail();
  let previous=-Infinity;
  for(const f of value.frames){
    if(!Array.isArray(f)||f.length!==18||f.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e8)||f[0]<-preRoll||f[0]<=previous||f[0]>value.duration+.02||f[4]<0||f[4]>100||Math.abs(f[6])>90||!Number.isInteger(f[10])||f[10]<0||f[10]>255||!Number.isInteger(f[11])||f[11]<0||f[11]>1000||![0,1].includes(f[12])||f[13]<0||f[13]>1||f[14]<0||f[14]>10||![0,1].includes(f[17]))fail();
    if(Number.isFinite(previous)&&f[0]-previous>1/hz+.00001)fail();previous=f[0];
  }
  if(value.frames[0][0]!==-preRoll||!value.frames.some(f=>f[0]===0)||Math.abs(previous-value.duration)>1/hz+.00001)fail();
  // Whitelist the stored envelope rather than retaining arbitrary client properties.
  return {version:1,hz,physics:value.physics,...(vnl?{movement:{...movement}}:{}),map:value.map,course:value.course,mapHash:value.mapHash,collisionHash:value.collisionHash,duration:value.duration,...(preRoll?{preRoll}:{}),frames:value.frames};
}
