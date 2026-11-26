import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,emptyInput} from '../src/physics/movement';
import {TriangleWorld} from '../src/physics/collision';
import {CKZ,perfSpeed} from '../src/physics/ckz';
import {Simulation} from '../src/physics/clock';

const floor=[-20000,-20000,0,20000,-20000,0,20000,20000,0,-20000,-20000,0,20000,20000,0,-20000,20000,0];
test('high-fall takeoffs have no uncapped step between perf and normal ground movement',()=>{
 for(const duck of [false,true])for(const entry of [250,500,1000])for(let delay=0;delay<=5;delay++){
  const p=new Player(new TriangleWorld(floor),[0,0,2048]);p.velocity=[entry,0,0];
  const input={...emptyInput(),duck};let step=0;
  while(!p.grounded&&step<640)p.tick(input,step++*CKZ.step,CKZ.step,0);
  assert.ok(p.grounded);
  for(let i=0;i<delay;i++)p.tick(input,step++*CKZ.step,CKZ.step,0);
  p.tick(input,step*CKZ.step,CKZ.step,1);
  assert.equal(p.jumps,1);assert.equal(p.lastJumpbug,false);
  if(delay<=2){
   assert.equal(p.lastPerf,'PERF');
   assert.ok(Math.abs(p.lastTakeoff-perfSpeed(entry,entry,delay*CKZ.step,0))<1e-7);
  }else{
   assert.equal(p.lastPerf,'NORMAL');assert.ok(p.lastTakeoff<=275+1e-9,`duck=${duck}, entry=${entry}, delay=${delay}: ${p.lastTakeoff}`);
  }
 }
});

test('held duck with wheel pulses cannot exploit the post-perf boundary at different render rates',()=>{
 const run=(fps:number)=>{
  const p=new Player(new TriangleWorld(floor),[0,0,2048]),sim=new Simulation(p);
  p.velocity=[1000,0,0];sim.enqueue({time:0,key:'duck',value:true});
  // Find this deterministic landing, then scroll on the first non-perf step.
  while(!p.grounded&&sim.time<5)sim.advance(sim.time+CKZ.tick);
  const jumpTime=p.landingTime+3*CKZ.step;
  sim.enqueue({time:jumpTime,pulse:true});
  const end=jumpTime+.1,start=sim.time;
  for(let t=start+1/fps;t<end;t+=1/fps)sim.advance(t);
  sim.advance(end);
  assert.equal(p.jumps,1);assert.equal(p.lastPerf,'NORMAL');assert.equal(p.lastJumpbug,false);
  assert.ok(p.lastTakeoff<275,'ordinary ground movement already cropped landing speed, followed by friction');
  return {position:p.position,velocity:p.velocity,tick:sim.tick};
 };
 const expected=run(30);for(const fps of [60,144,240])assert.deepEqual(run(fps),expected);
});
