import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TriangleWorld} from '../src/physics/collision';
import {Player,emptyInput,friction,accelerate} from '../src/physics/movement';
import {Simulation} from '../src/physics/clock';
import {CKZ,Prestrafe,isPerf,perfSpeed,snapInputTime} from '../src/physics/ckz';
import {type V,speed} from '../src/physics/math';
import {MapTransport} from '../src/physics/transport';
const floor=[-4096,-4096,0,4096,-4096,0,4096,4096,0,-4096,-4096,0,4096,4096,0,-4096,4096,0];
function box(min:V,max:V){const v:V[]=[];for(let i=0;i<8;i++)v.push([i&1?max[0]:min[0],i&2?max[1]:min[1],i&4?max[2]:min[2]]);return [0,2,3,0,3,1,4,5,7,4,7,6,0,1,5,0,5,4,2,6,7,2,7,3,0,4,6,0,6,2,1,3,7,1,7,5].flatMap(i=>v[i]);}
function setup(geometry=floor,spawn:V=[0,0,0.03125]){const p=new Player(new TriangleWorld(geometry),spawn);p.grounded=true;return p;}
const close=(a:number,b:number,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('friction includes stopspeed and cannot reverse velocity',()=>{close(friction([250,0,0],1/128)[0],239.84375);close(friction([10,0,0],1/128)[0],6.75);close(friction([1,0,0],1)[0],0);});
test('air projection caps at 30 while preserving perpendicular momentum',()=>{assert.deepEqual(accelerate([300,0,0],[0,1,0],250,1/128,true),[300,30,0]);assert.deepEqual(accelerate([300,0,0],[1,0,0],250,1/128,true),[300,0,0]);});
test('jump matches native CKZ takeoff and 55.828125 apex',()=>{
  const p=setup();p.tick(emptyInput(),0,CKZ.step,1);
  close(p.position[2]-.03125,2.310546875);close(p.velocity[2],292.625);
  p.tick(emptyInput(),CKZ.step,CKZ.step,0);
  close(p.position[2]-.03125,4.572265625);close(p.velocity[2],286.375);
  let apex=0;for(let i=2;i<130;i++){p.tick(emptyInput(),i*CKZ.step,CKZ.step,0);apex=Math.max(apex,p.position[2]-.03125);}
  close(apex,55.828125);assert.equal(p.grounded,true);close(p.position[2],.03125);
});
test('inactive stored pre cannot boost straight W back above 250 after landing',()=>{
  for(const entry of [240,250,275]){
    const p=setup();p.velocity=[entry,0,0];p.pre.left=.5;p.pre.right=.5;p.pre.bonus=26;p.landingTime=0;
    let previous=entry;const input={...emptyInput(),forward:true};
    for(let i=0;i<128;i++){
      p.tick(input,i*CKZ.step,CKZ.step,0);const current=speed(p.velocity);
      assert.ok(current<=Math.max(250,previous)+1e-9);previous=current;
    }
    close(speed(p.velocity),250);
  }
});
test('continued W turning and W+A/D prestrafing still earn ground bonus',()=>{
  for(const side of [-1,0,1]){
    const p=setup();p.velocity=[275,0,0];p.pre.left=.5;p.pre.right=.5;p.pre.bonus=26;p.landingTime=0;
    const input={...emptyInput(),forward:true,left:side<0,right:side>0};
    for(let i=0;i<128;i++){
      // Keep wish direction 15 degrees ahead of velocity, using each input style.
      input.yaw=Math.atan2(p.velocity[1],p.velocity[0])*180/Math.PI+15+side*45;
      p.tick(input,i*CKZ.step,CKZ.step,0);
    }
    assert.ok(p.pre.activelyStrafing);assert.ok(speed(p.velocity)>270);
  }
});
test('perf boundaries are inclusive 20 ms with logarithmic speed attenuation',()=>{assert.equal(isPerf(-0.001),false);assert.equal(isPerf(0),true);assert.equal(isPerf(0.020),true);assert.equal(isPerf(0.020001),false);close(perfSpeed(276,270,0,26),276);assert.ok(perfSpeed(1000,900,0,26)>300);assert.ok(perfSpeed(1000,900,.02,26)<perfSpeed(1000,900,0,26));});
test('jump edge is manual, holding space never autob hops',()=>{const p=setup(),s=new Simulation(p);s.enqueue({time:0,key:'jump',value:true});s.advance(2);assert.equal(p.jumps,1);assert.equal(p.grounded,true);s.enqueue({time:2,key:'jump',value:false});s.enqueue({time:2.02,key:'jump',value:true});s.advance(2.04);assert.equal(p.jumps,2);});
test('several edges within a tick are retained; short release cannot rearm old jump',()=>{const p=setup(),s=new Simulation(p);s.oldJump=true;s.input.jump=true;s.enqueue({time:.001,key:'jump',value:false});s.enqueue({time:.003,key:'jump',value:true});s.advance(1/64);assert.equal(p.jumps,0);assert.equal(s.events.length,0);assert.equal(s.input.jump,true);close(snapInputTime(.012),1/128);});
test('prestrafe rewards sustained signed wish/velocity angle and decays',()=>{const pre=new Prestrafe();for(let i=0;i<128;i++)pre.update(i/128,1/128,true,-10,[250,0,0],[Math.cos(.3),Math.sin(.3),0]);close(pre.gain,26);for(let i=128;i<256;i++)pre.update(i/128,1/128,true,-10,[250,0,0],[1,0,0]);close(pre.gain,0);});
test('duck cannot expand through a low ceiling',()=>{const p=setup([...floor,...box([-80,-80,60],[80,80,100])]);p.ducked=true;p.duckAmount=1;p.tick(emptyInput(),1,1/128,0);assert.equal(p.ducked,true);p.position=[200,0,.03125];for(let i=0;i<32;i++)p.tick(emptyInput(),2+i/128,1/128,0);assert.equal(p.ducked,false);});
test('swept hull blocks high speed wall crossing',()=>{const w=new TriangleWorld([...floor,...box([100,-500,0],[110,500,500])]);const tr=w.trace([0,0,.03125],[500,0,.03125],72);assert.ok(tr.fraction<.2);close(tr.end[0],83.96875);assert.deepEqual(tr.normal,[-1,0,0]);});
test('18 unit step succeeds; 24 unit ledge blocks',()=>{for(const [height,expected] of [[16,true],[24,false]] as const){const p=setup([...floor,...box([60,-100,0],[300,100,height])]);const input=emptyInput();input.forward=true;for(let i=0;i<150;i++)p.tick(input,i/128,1/128,0);assert.equal(p.position[0]>100,expected,JSON.stringify(p.position));}});
test('steep ramp slides under gravity without grounding',()=>{const ramp=[-500,-500,0,500,-500,2000,500,500,2000,-500,-500,0,500,500,2000,-500,500,0];const p=setup(ramp,[-50,0,950]);p.grounded=false;for(let i=0;i<50;i++)p.tick(emptyInput(),i/128,1/128,0);assert.equal(p.grounded,false);assert.ok(p.velocity[0]<-1);assert.ok(p.position.every(Number.isFinite));});
test('timestamped inputs yield identical results at 30 / 60 / 144 / 240 render Hz',()=>{const run=(fps:number)=>{const p=setup(),s=new Simulation(p);for(const e of [{time:.01,key:'forward',value:true},{time:.62,key:'jump',value:true},{time:.65,key:'jump',value:false},{time:.7,key:'right',value:true},{time:.72,key:'yaw',value:25},{time:1.3,key:'forward',value:false}] as const)s.enqueue(e);for(let i=1;i<=fps*2;i++)s.advance(i/fps);return {p:p.position,v:p.velocity,j:p.jumps,t:s.tick};};const a=run(30);for(const fps of [60,144,240])assert.deepEqual(run(fps),a);});
test('reset clears all history, velocity, input edges and duck state',()=>{const p=setup(),s=new Simulation(p);s.logging=true;s.enqueue({time:0,key:'forward',value:true});s.advance(1);s.reset();assert.deepEqual(p.position,p.spawn);assert.deepEqual(p.velocity,[0,0,0]);assert.equal(s.events.length,0);assert.equal(s.history.length,0);assert.equal(p.pre.gain,0);assert.equal(p.lastPerf,'—');assert.equal(p.duckAmount,0);});
test('turning prestrafe cannot exceed the requested 275 u/s ground cap',()=>{const p=setup();p.velocity=[300,0,0];p.pre.left=.5;p.pre.right=.5;p.pre.bonus=26;const input=emptyInput();input.forward=true;for(let i=0;i<256;i++){input.yaw=i;p.tick(input,i/128,1/128,0);assert.ok(speed(p.velocity)<=275+1e-9);}p.tick(input,2,1/128,1);assert.ok(p.lastTakeoff<=275+1e-9);});
test('ground cap does not crop legitimate airborne momentum or immediate perf takeoff',()=>{const p=setup();p.velocity=[1000,0,0];p.landingVelocity=[1000,0,-100];p.landingTime=1;p.tick(emptyInput(),1,1/128,1);assert.equal(p.lastPerf,'PERF');assert.ok(p.lastTakeoff>275);const air=setup();air.grounded=false;air.position=[0,0,1000];air.velocity=[500,0,0];air.tick(emptyInput(),1,1/128,0);close(air.velocity[0],500);});
test('brief landing contact does not apply the prestrafe cap to slide entry speed',()=>{const p=setup();p.velocity=[500,0,0];p.landingTime=1;p.tick(emptyInput(),1,1/128,0);assert.ok(speed(p.velocity)>450);p.tick(emptyInput(),1.03,1/128,0);assert.ok(speed(p.velocity)<=275);});
function slopeWorld(slope:number){
  const a:V=[-4096,-4096,-4096*slope],b:V=[4096,-4096,4096*slope],c:V=[4096,4096,4096*slope],d:V=[-4096,4096,-4096*slope];
  return new TriangleWorld([...a,...b,...c,...a,...c,...d]);
}
function slopePlayer(slope:number,entry:number){
  const world=slopeWorld(slope),ground=world.trace([0,0,100],[0,0,-100],72);
  const p=new Player(world,ground.end);p.grounded=true;p.groundNormal=ground.normal;p.velocity=[entry,0,0];return p;
}
test('uphill and downhill turning pre stays grounded and never exceeds 275',()=>{
  for(const slope of [-1,-.75,-.5,.5,.75,1]){
    const p=slopePlayer(slope,275),input=emptyInput();input.forward=true;
    p.pre.left=.5;p.pre.right=.5;p.pre.bonus=26;
    for(let i=0;i<256;i++){
      input.yaw=25*Math.sin(i/32);p.tick(input,i/128,1/128,0);
      assert.ok(p.grounded,`slope ${slope}: false airborne at ${i}`);
      assert.ok(speed(p.velocity)<=275+1e-9,`slope ${slope}: ${speed(p.velocity)}`);
    }
    p.tick(input,2,1/128,1);assert.ok(p.lastTakeoff<=275+1e-9);
  }
});
test('fast uphill contact keeps the clipped vector instead of a stair-generated boost',()=>{
  const p=slopePlayer(.75,500);p.landingTime=0;
  p.tick(emptyInput(),0,1/128,0);
  assert.equal(p.grounded,false);
  // Friction leaves 479.6875. Projecting onto z=.75x gives (307,0,230.25),
  // then the closing gravity half-step removes 3.125 vertical units.
  close(p.velocity[0],307);close(p.velocity[2],227.125);
  for(let i=1;i<256;i++)p.tick(emptyInput(),i/128,1/128,0);
  assert.equal(p.grounded,true);close(speed(p.velocity),0);
  assert.ok(p.position[2]-p.spawn[2]<85,'coasting uphill used to rise over 158 units');
});
test('ground following cannot magnetize jumps, steep surf or drops beyond a step',()=>{
  const jumper=slopePlayer(-1,275);jumper.tick(emptyInput(),1,1/128,1);
  assert.equal(jumper.grounded,false);assert.ok(jumper.velocity[2]>290);
  const ledge=setup(box([-100,-100,-20],[0,100,0]),[15,0,.03125]);ledge.velocity=[275,0,0];
  ledge.tick(emptyInput(),1,1/128,0);assert.equal(ledge.grounded,false);
  const surfer=slopePlayer(1.1,500);surfer.grounded=false;
  surfer.tick(emptyInput(),1,1/128,0);assert.equal(surfer.grounded,false);assert.ok(surfer.velocity[0]>200);
});
test('slope perf carry is still based on landing speed',()=>{
  const p=slopePlayer(.75,500);p.landingVelocity=[500,0,-100];p.landingTime=1;
  p.tick(emptyInput(),1,1/128,1);assert.equal(p.lastPerf,'PERF');assert.ok(p.lastTakeoff>275);
});
test('selected real map spawn settles and supports movement and a jump',()=>{const m=JSON.parse(fs.readFileSync('public/maps/manifest.json','utf8')),b=fs.readFileSync('public/maps/collision.bin'),w=new TriangleWorld(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4));const p=new Player(w,m.spawn);for(let i=0;i<64;i++)p.tick(emptyInput(),i/128,1/128,0);assert.equal(p.grounded,true);const origin=[...p.position];const input=emptyInput();input.forward=true;for(let i=64;i<85;i++)p.tick(input,i/128,1/128,0);assert.ok(speed([p.position[0]-origin[0],p.position[1]-origin[1],0])>5);p.tick(input,85/128,1/128,1);assert.ok(p.velocity[2]>290);assert.equal(w.trace(p.position,p.position,p.height).startSolid,false);});
test('repeated jumps have no accumulating stamina penalty',()=>{const p=setup();const heights:number[]=[];for(let j=0;j<6;j++){const base=p.position[2];p.tick(emptyInput(),j*2,1/128,1);let peak=p.position[2];for(let i=1;i<128;i++){p.tick(emptyInput(),j*2+i/128,1/128,0);peak=Math.max(peak,p.position[2]);}heights.push(peak-base);}for(const h of heights)close(h,heights[0]);});
test('map transport uses native convex hull unions and resets speed',()=>{const volumes=JSON.parse(fs.readFileSync('public/maps/transports.json','utf8'));assert.equal(volumes.length,7);assert.ok(volumes.find((v:any)=>v.id==='179').hulls.length>1);const system=new MapTransport(volumes),p=setup();p.previous=[0,0,100];p.position=[0,0,100];system.process(p);assert.equal(system.teleports,0);const reset=volumes.find((v:any)=>v.id==='27979');p.previous=[145,-2767,1846.5];p.position=[145,-2767,1846.5];p.velocity=[500,10,-20];system.process(p);assert.deepEqual(p.position,reset.destination);assert.deepEqual(p.velocity,[0,0,0]);});
test('key filter prevents teleport only after acquiring the map pass context',()=>{const volumes=JSON.parse(fs.readFileSync('public/maps/transports.json','utf8'));const system=new MapTransport(volumes),p=setup();p.previous=[28,756,2256];p.position=[28,756,2256];system.process(p);assert.equal(system.pass,true);p.previous=[-416,752,1968];p.position=[-416,752,1968];system.process(p);assert.equal(system.teleports,0);system.pass=false;system.touching.clear();system.process(p);assert.equal(system.teleports,1);});

