import test from 'node:test';
import assert from 'node:assert/strict';
import {TriangleWorld} from '../src/physics/collision';
import {Player,emptyInput} from '../src/physics/movement';
import {CKZ} from '../src/physics/ckz';
import {Simulation} from '../src/physics/clock';

// A real swept-hull contact, rather than a mocked ladder trace.
const wall=[16.04,-1000,0,16.04,1000,0,16.04,1000,2000,16.04,-1000,0,16.04,1000,2000,16.04,-1000,2000];
function setup(){const world=new TriangleWorld(wall);const p=new Player(world,[0,0,100]);p.ladders=world;return p;}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('ladder: W climbs; looking up/right with W+A adds vertical speed, mirrored by W+D',()=>{
  const straight=setup();straight.tick({...emptyInput(),forward:true},0,CKZ.step,0);
  assert.equal(straight.onLadder,true);close(straight.velocity[2],200);
  const left=setup(),right=setup();
  left.tick({...emptyInput(),forward:true,left:true,yaw:-45,pitch:-45},0,CKZ.step,0);
  right.tick({...emptyInput(),forward:true,right:true,yaw:45,pitch:-45},0,CKZ.step,0);
  assert.equal(left.onLadder,true);assert.equal(right.onLadder,true);
  assert.ok(left.velocity[2]>380);close(left.velocity[2],right.velocity[2]);
  close(left.velocity[1],-right.velocity[1]);close(left.velocity[0],0);
  assert.ok(left.position[2]>straight.position[2]);
});

test('ladder: release stays attached and stops; no-input proximity does not acquire',()=>{
  const p=setup();p.tick(emptyInput(),0,CKZ.step,0);assert.equal(p.onLadder,false);
  p.tick({...emptyInput(),forward:true},CKZ.step,CKZ.step,0);assert.equal(p.onLadder,true);
  p.tick({...emptyInput(),yaw:180},2*CKZ.step,CKZ.step,0);
  assert.equal(p.onLadder,true);assert.deepEqual(p.velocity,[0,0,0]);
  const away=setup();away.tick({...emptyInput(),forward:true,yaw:180},0,CKZ.step,0);
  assert.equal(away.onLadder,false);
});

test('ladder: jump pushes away without an invented upward impulse; top releases',()=>{
  const p=setup();p.tick({...emptyInput(),forward:true},0,CKZ.step,0);
  p.tick({...emptyInput(),jump:true},.25,CKZ.step,1);
  assert.equal(p.onLadder,false);close(p.velocity[0],-270);assert.ok(p.velocity[2]<0);
  p.tick(emptyInput(),.25+CKZ.step,CKZ.step,0);assert.equal(p.onLadder,false);
  const top=setup();top.tick({...emptyInput(),forward:true},0,CKZ.step,0);
  top.position=[0,0,2001];top.tick(emptyInput(),CKZ.step,CKZ.step,0);
  assert.equal(top.onLadder,false);
});

const floor=[-1000,-1000,0,1000,-1000,0,1000,1000,0,-1000,-1000,0,1000,1000,0,-1000,1000,0];
test('ladder: one keyboard press and one wheel pulse both perform the grounded 270 hop',()=>{
  const outcomes=[];
  for(const wheel of [false,true]){
    const p=new Player(new TriangleWorld([...wall,...floor]),[0,0,.03125]);
    p.ladders=new TriangleWorld(wall);p.onLadder=true;p.ladderNormal=[-1,0,0];
    // Deliberately false: ladder floor contact must be discovered before jump.
    p.grounded=false;p.landingTime=0;p.landingVelocity=[220,0,0];
    const sim=new Simulation(p);
    sim.enqueue(wheel?{time:0,pulse:true}:{time:0,key:'jump',value:true});
    sim.advance(2*CKZ.step);
    assert.equal(p.onLadder,false);assert.equal(p.grounded,false);
    close(p.lastTakeoff,270);assert.equal(p.jumps,1);assert.equal(p.lastPerf,'NORMAL');
    assert.ok(p.velocity[2]>280);outcomes.push([p.position,p.velocity]);
  }
  assert.deepEqual(outcomes[0],outcomes[1]);
});

test('ladder: fresh grab protects held jump for .2 seconds and retains incoming velocity',()=>{
  const p=setup();p.velocity=[-40,0,10];
  p.tick({...emptyInput(),forward:true,jump:true},0,CKZ.step,1);
  assert.equal(p.onLadder,true);assert.deepEqual(p.velocity,[-40,0,10]);
  p.tick({...emptyInput(),jump:true},.19,CKZ.step,0);
  assert.equal(p.onLadder,true);close(p.velocity[0],-40);
  p.tick({...emptyInput(),jump:true},.2,CKZ.step,0);
  assert.equal(p.onLadder,false);close(p.velocity[0],-270);
});

test('ladder: crouched kick can regrab and glide to an offset, then stop on release',()=>{
  const p=setup(),input={...emptyInput(),forward:true,duck:true};
  p.tick(input,0,CKZ.step,0);
  p.tick({...input,jump:true},.25,CKZ.step,1);
  assert.equal(p.onLadder,false);
  for(let i=1;i<=4;i++)p.tick({...input,jump:true},.25+i*CKZ.step,CKZ.step,0);
  assert.equal(p.onLadder,true);
  const offset=.04-p.position[0];assert.ok(offset>7&&offset<10,`offset ${offset}`);
  const x=p.position[0];p.tick(emptyInput(),.25+5*CKZ.step,CKZ.step,0);
  assert.equal(p.onLadder,true);close(p.position[0],x);assert.deepEqual(p.velocity,[0,0,0]);
  p.position[0]=-10.1;p.tick(emptyInput(),.4,CKZ.step,0);assert.equal(p.onLadder,false);
});

test('ladder: grounded outward movement gives the Source 200/128 offset step',()=>{
  const p=new Player(new TriangleWorld([...wall,...floor]),[0,0,.03125]);
  p.ladders=new TriangleWorld(wall);p.onLadder=true;p.ladderNormal=[-1,0,0];
  p.tick({...emptyInput(),back:true,pitch:89},0,CKZ.step,0);
  close(p.position[0],-200*CKZ.step);assert.equal(p.onLadder,true);
  assert.ok(p.position[2]>.03125);
});
