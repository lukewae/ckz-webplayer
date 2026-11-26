import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/physics/clock';
import {Player,emptyInput,type Input} from '../src/physics/movement';
import {TriangleWorld} from '../src/physics/collision';
import {CKZ} from '../src/physics/ckz';
import {speed} from '../src/physics/math';
import {captureGameKeys,GAME_KEYS} from '../src/keyboard-lock';

function recording(){
  const player=new Player(new TriangleWorld([]),[0,0,10000]),seen:Input[]=[];
  player.tick=input=>{seen.push({...input});};
  return {sim:new Simulation(player),seen};
}
test('command angle is shared by both halves while a strafe reversal keeps its snapped time',()=>{
  const {sim,seen}=recording();
  sim.enqueue({time:.001,key:'left',value:true});sim.enqueue({time:.002,key:'yaw',value:4});
  sim.enqueue({time:.009,key:'left',value:false});sim.enqueue({time:.009,key:'right',value:true});
  sim.enqueue({time:.013,key:'yaw',value:20});sim.enqueue({time:.013,key:'pitch',value:-10});
  sim.advance(CKZ.step);assert.equal(seen.length,0); // final command angle not available yet
  sim.advance(CKZ.tick);
  assert.deepEqual(seen.map(i=>[i.yaw,i.pitch,i.left,i.right]),[[10,-5,true,false],[20,-10,false,true]]);
});
test('angle wrapping survives many full mouse rotations and delayed rendering',()=>{
  const {sim,seen}=recording();sim.previousYaw=-1079;sim.input.yaw=-1079;
  sim.enqueue({time:.003,key:'yaw',value:-1081});sim.advance(CKZ.tick);
  assert.equal(seen[0].yaw,-1080);assert.equal(seen[1].yaw,-1081);
});
test('live half-step scheduling uses available input without varying command angles by render schedule',()=>{
  const run=(fps:number)=>{const {sim,seen}=recording();
    for(let i=0;i<125;i++)sim.enqueue({time:i/1000,key:'yaw',value:Math.sin(i/8)*20});
    for(let t=1/fps;t<.14;t+=1/fps)sim.advance(t-CKZ.step,t);
    sim.advance(.125,.125+CKZ.step);return seen;
  };
  assert.deepEqual(run(60),run(240));assert.deepEqual(run(60),run(1000));
});
test('isolated CKZ air acceleration supports eleven synchronized reversals without cumulative loss',()=>{
  const run=(strafes:number)=>{
    const p=new Player(new TriangleWorld([]),[0,0,10000]);p.velocity=[275,0,302];let previous=275;
    for(let i=0;i<96;i++){
      const left=Math.floor(i*strafes/96)%2===0;
      p.tick({...emptyInput(),left,right:!left,yaw:Math.atan2(p.velocity[1],p.velocity[0])*180/Math.PI},i*CKZ.step,CKZ.step,0);
      assert.ok(speed(p.velocity)>previous);previous=speed(p.velocity);
    }
    return previous;
  };
  assert.ok(Math.abs(run(11)-run(6))<1e-6);assert.ok(run(11)>400);
});
test('keyboard capture protects gameplay and menu keys only in fullscreen, with denied capture falling back',async()=>{
  let calls=0;const keyboard={lock:async(keys:string[])=>{calls++;assert.deepEqual(keys,GAME_KEYS);},unlock:()=>{}};
  assert.equal(await captureGameKeys(false,keyboard),false);assert.equal(calls,0);
  assert.equal(await captureGameKeys(true,undefined),false);
  assert.equal(await captureGameKeys(true,keyboard),true);assert.equal(calls,1);
  assert.ok(GAME_KEYS.includes('KeyW'));assert.ok(GAME_KEYS.includes('Tab'));assert.ok(GAME_KEYS.includes('Escape'));assert.ok(GAME_KEYS.includes('KeyP'));
  assert.equal(await captureGameKeys(true,{...keyboard,lock:async()=>{throw new Error('Denied');}}),false);
});
