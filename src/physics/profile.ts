import {CKZ} from './ckz';
export type Timing='64'|'128'|'64x128';
export interface MovementProfile {
  mode:'ckz'|'vnl'; timing:Timing; step:number; commandSteps:number;
  gravity:number; jump:number; friction:number; stopSpeed:number; accelerate:number;
  airAccelerate:number; airWish:number; run:number; maxVelocity:number; stepHeight:number;
  staminaJump:number; staminaLand:number; staminaMax:number; staminaRecovery:number;
  id:string;
}
/** Fixed, knife-speed CS:GO baseline. Overrides create a different run identity. */
export function movementProfile(mode:'ckz'|'vnl'='ckz',timing:Timing='64',airAccelerate?:number):Readonly<MovementProfile>{
  if(!['ckz','vnl'].includes(mode)||!['64','128','64x128'].includes(timing))throw Error('Invalid movement mode/timing');
  if(airAccelerate!==undefined&&(!Number.isFinite(airAccelerate)||airAccelerate<0||airAccelerate>1000))throw Error('Air acceleration must be between 0 and 1000');
  if(mode==='ckz'&&airAccelerate!==undefined)throw Error('Custom air acceleration is available in VNL only');
  if(mode==='ckz')return Object.freeze({...CKZ,mode,timing:'64x128',commandSteps:2,staminaJump:0,staminaLand:0,staminaMax:0,staminaRecovery:0,id:'ckz-browser-2026-10-17-landing'});
  const aa=airAccelerate??12;
  return Object.freeze({gravity:800,friction:5.2,stopSpeed:80,airWish:30,run:250,maxVelocity:3500,stepHeight:18,mode,timing,step:timing==='64'?1/64:1/128,commandSteps:timing==='64x128'?2:1,
    jump:301.993377,accelerate:5.5,airAccelerate:aa,staminaJump:.08,staminaLand:.05,staminaMax:80,staminaRecovery:60,
    id:`csgo-vnl-v6-${timing}-aa${aa}`});
}
