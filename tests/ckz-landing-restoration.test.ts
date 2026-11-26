import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,emptyInput} from '../src/physics/movement';
import {TriangleWorld} from '../src/physics/collision';
import {CKZ,perfSpeed} from '../src/physics/ckz';
import {speed} from '../src/physics/math';

const floor=[-10000,-10000,0,10000,-10000,0,10000,10000,0,-10000,-10000,0,10000,10000,0,-10000,10000,0];
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function landed(){
 const p=new Player(new TriangleWorld(floor),[0,0,1]);p.velocity=[500,0,-200];
 p.tick(emptyInput(),0,CKZ.step,0);assert.ok(p.grounded);near(speed(p.landingVelocity),500);return p;
}

test('first grounded movement crops speed without overwriting the perf landing snapshot',()=>{
 for(const pre of [0,.5]){
  const p=landed();p.pre.left=p.pre.right=pre;p.pre.bonus=p.pre.gain;
  const x=p.position[0];p.tick(emptyInput(),CKZ.step,CKZ.step,0);
  const cap=275;near(speed(p.velocity),cap);near(p.position[0]-x,cap*CKZ.step);
  near(speed(p.landingVelocity),500);assert.equal(p.stamina,0);
 }
});

test('delayed perfs restore saved landing speed after one or two cropped ground steps',()=>{
 for(const delay of [0,1,2]){
  const p=landed();
  for(let n=0;n<delay;n++)p.tick(emptyInput(),(n+1)*CKZ.step,CKZ.step,0);
  p.tick(emptyInput(),(delay+1)*CKZ.step,CKZ.step,1);
  assert.equal(p.lastPerf,'PERF');near(p.lastTakeoff,perfSpeed(500,500,delay*CKZ.step,0));
  assert.ok(p.lastTakeoff>275);assert.equal(p.stamina,0);
 }
});

test('wall and floor contact cannot restore velocity already removed by the wall',()=>{
 const wall=[18,-100,0,18,100,0,18,100,200,18,-100,0,18,100,200,18,-100,200];
 const p=new Player(new TriangleWorld([...floor,...wall]),[0,0,1]);p.velocity=[500,250,-200];
 p.tick(emptyInput(),0,CKZ.step,0);assert.ok(p.grounded);
 near(p.velocity[0],0);near(p.velocity[1],250);
 near(p.landingVelocity[0],0);near(p.landingVelocity[1],250);
 p.tick(emptyInput(),CKZ.step,CKZ.step,1);
 assert.equal(p.lastPerf,'PERF');near(p.lastTakeoff,250);near(p.velocity[0],0);near(p.velocity[1],250);
});

test('high speed remains uncropped in free air and on the landing movement itself',()=>{
 const p=new Player(new TriangleWorld(floor),[0,0,100]);p.velocity=[500,0,-200];
 p.tick(emptyInput(),0,CKZ.step,0);assert.equal(p.grounded,false);near(speed(p.velocity),500);
 near(speed(landed().velocity),500);
});
