import test from 'node:test';
import assert from 'node:assert/strict';
import {Player,emptyInput} from '../src/physics/movement';
import {TriangleWorld} from '../src/physics/collision';
import {Simulation} from '../src/physics/clock';
const dt=1/128;
const floor=[-4096,-4096,0,4096,-4096,0,4096,4096,0,-4096,-4096,0,4096,4096,0,-4096,4096,0];
const ceiling=[-100,-100,60,100,100,60,100,-100,60,-100,-100,60,-100,100,60,100,100,60];
function player(geometry=floor){const p=new Player(new TriangleWorld(geometry),[0,0,.03125]);p.grounded=true;return p;}
function near(a:number,b:number){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
test('ground duck transitions hull, view and wish speed; short pre-duck is not full crouch',()=>{
  const p=player(),i={...emptyInput(),duck:true,forward:true};
  p.tick(i,0,dt,0);assert.equal(p.height,72);assert.ok(p.duckAmount>0&&p.duckAmount<.1);assert.ok(p.eye<64&&p.eye>46);
  for(let n=1;n<32;n++)p.tick(i,n*dt,dt,0);
  assert.equal(p.height,54);near(p.eye,46);near(p.position[2],.03125);
  for(let n=32;n<256;n++)p.tick(i,n*dt,dt,0);
  near(Math.hypot(p.velocity[0],p.velocity[1]),85);
});
test('air hull changes raise/lower feet 9 units without injecting momentum',()=>{
  const p=player();p.grounded=false;p.position=[0,0,100];p.velocity=[350,0,100];
  p.updateDuck(true,dt);near(p.position[2],109);assert.equal(p.height,54);assert.deepEqual(p.velocity,[350,0,100]);
  p.updateDuck(false,dt);near(p.position[2],100);assert.equal(p.height,72);assert.deepEqual(p.velocity,[350,0,100]);
});
test('partial pre-duck, simultaneous bind and fully crouched jumps stay distinct',()=>{
  const pre=player(),bind=player(),full=player(),i={...emptyInput(),duck:true};
  pre.tick(i,-dt,dt,0);
  for(let n=0;n<32;n++)full.tick(i,-(32-n)*dt,dt,0);
  for(const p of [pre,bind,full])p.tick(i,0,dt,1);
  assert.ok(pre.duckAmount>0&&pre.duckAmount<1);assert.equal(bind.duckAmount,0);assert.equal(full.height,54);
  near(pre.velocity[2],295.75);near(full.velocity[2],295.75);near(bind.velocity[2],292.625);
  for(const p of [pre,bind,full])p.tick(i,dt,dt,0);
  near(pre.position[2]-full.position[2],9);near(bind.position[2]-full.position[2],9-3.125*dt*2);
});
test('blocked standing retains crouch and retries after leaving the ceiling',()=>{
  const p=player([...floor,...ceiling]);p.ducked=true;p.duckAmount=1;
  p.updateDuck(false,dt);assert.equal(p.height,54);near(p.duckAmount,1);
  p.position[0]=200;for(let n=0;n<32;n++)p.updateDuck(false,dt);
  assert.equal(p.height,72);near(p.duckAmount,0);
});
test('air unduck checks swept standing hull and cannot lower feet through the floor',()=>{
  const p=player();p.grounded=false;p.position[2]=5;p.ducked=true;p.duckAmount=1;
  p.updateDuck(false,dt);assert.equal(p.height,54);near(p.position[2],5);
  p.position[2]=100;p.updateDuck(false,dt);assert.equal(p.height,72);near(p.position[2],91);
});
test('aborting a partial ground duck in air does not invent a downward hull offset',()=>{
  const p=player();p.updateDuck(true,dt);p.grounded=false;p.position[2]=100;
  p.updateDuck(false,dt);near(p.position[2],100);assert.equal(p.height,72);
});
test('duck spam respects CKZ speed floor and ladder duck keeps the foot anchor',()=>{
  const p=player();for(let n=0;n<100;n++){p.updateDuck(n%2===0,dt);assert.ok(p.duckSpeed>=6.0234375);}
  p.grounded=false;p.onLadder=true;p.position[2]=100;p.updateDuck(true,dt);near(p.position[2],100);assert.equal(p.height,54);
  p.updateDuck(false,dt);near(p.position[2],100);assert.equal(p.height,72);
});
test('duck input sequence is identical across render rates',()=>{
  const run=(fps:number)=>{const p=player(),s=new Simulation(p);
    for(const e of [{time:.1,key:'duck',value:true},{time:.12,key:'jump',value:true},{time:.2,key:'jump',value:false},{time:.4,key:'duck',value:false},{time:.6,key:'duck',value:true},{time:1,key:'duck',value:false}] as const)s.enqueue(e);
    for(let n=1;n<=fps*2;n++)s.advance(n/fps);
    return [p.position,p.velocity,p.duckAmount,p.ducked,p.duckSpeed,p.jumps];};
  for(const fps of [60,144,240])assert.deepEqual(run(fps),run(30));
});
test('crouch clearance comes from the hull offset, with unchanged ballistic velocity',()=>{
  const standing=player(),duck=player();let standingPeak=0,duckPeak=0;
  for(let n=0;n<75;n++){
    standing.tick(emptyInput(),n*dt,dt,n===0?1:0);
    duck.tick({...emptyInput(),duck:n>0},n*dt,dt,n===0?1:0);
    near(duck.velocity[2],standing.velocity[2]);
    standingPeak=Math.max(standingPeak,standing.position[2]);duckPeak=Math.max(duckPeak,duck.position[2]);
  }
  near(duckPeak-standingPeak,9);
});
test('crouched jumping hits a low ceiling and does not tunnel through it',()=>{
  const p=player([...floor,...ceiling]);p.ducked=true;p.duckAmount=1;
  for(let n=0;n<64;n++){
    p.tick({...emptyInput(),duck:true},n*dt,dt,n===0?1:0);
    assert.ok(p.position[2]+p.height<60);assert.equal(p.world.trace(p.position,p.position,p.height).startSolid,false);
  }
  assert.equal(p.grounded,true);
});

test('pre-duck reaches 66 units while late duck remains 64.828125',()=>{
  const peak=(pre:boolean)=>{
    const p=player();if(pre)p.tick({...emptyInput(),duck:true},-dt,dt,0);
    let height=0;
    for(let i=0;i<70;i++){p.tick({...emptyInput(),duck:pre||i>0},i*dt,dt,i===0?1:0);height=Math.max(height,p.position[2]-.03125);}
    return height;
  };
  near(peak(true),66);near(peak(false),64.828125);
});
