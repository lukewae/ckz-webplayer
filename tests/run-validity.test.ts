import test from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../src/physics/movement';
import {TriangleWorld} from '../src/physics/collision';
import {Simulation} from '../src/physics/clock';
import {Checkpoints} from '../src/physics/checkpoints';
import {CourseTimer} from '../src/physics/timer';
import {RunResults,personalBestKey,readPersonalBest} from '../src/run-results';
import type {V} from '../src/physics/math';
const physics='ckz-browser-2026-10-17-landing',map='3551310998',course='course_kiwi_main';
const box=(min:V,max:V)=>[0,1,2].flatMap(k=>{const n:V=[0,0,0],neg:V=[0,0,0];n[k]=1;neg[k]=-1;return [{normal:n,dist:max[k]},{normal:neg,dist:-min[k]}];});
test('350 checkpoint teleports finish as TP and save separately from Pro, including after reloading PB storage',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 function finish(teleports:number,time:number){
  const player=new Player(new TriangleWorld([]),[0,0,0]);player.grounded=true;
  const sim=new Simulation(player),timer=new CourseTimer([{id:'s',kind:'start',course,hulls:[box([-20,-20,0],[20,20,100])]},{id:'e',kind:'end',course,hulls:[box([200,-20,0],[240,20,100])]}]);sim.timer=timer;
  const results=new RunResults(map,[],storage,physics),cp=new Checkpoints(sim);
  timer.update(player,0,0,true);player.previous=[...player.position];player.position=[100,0,0];timer.update(player,0,0,true);assert.equal(timer.state,'running');results.observe(timer,player,0,0);
  cp.save(0,0);for(let i=0;i<teleports;i++)assert.match(cp.teleport(0,0,0),/Teleported/);
  assert.equal(timer.practice,false);assert.equal(timer.teleports,teleports);
  // Pausing is a suspension of simulation, not an invalidation or a checkpoint TP.
  assert.equal(timer.elapsed,0);player.previous=[220,0,0];player.position=[220,0,0];timer.update(player,time,0,true);
  assert.equal(timer.state,'finished');return results.observe(timer,player,time,0)!;
 }
 const tp=finish(350,1218.269);assert.equal(tp.category,'TP');assert.equal(tp.practice,false);assert.equal(tp.newBest,true);
 const pro=finish(0,1400);assert.equal(pro.category,'Pro');assert.equal(pro.newBest,true);assert.equal(pro.previous,null);
 const slower=finish(2,1300);assert.equal(slower.newBest,false);assert.equal(slower.previous?.time,1218.269);
 assert.equal(readPersonalBest(storage,physics,map,course,'TP')?.teleports,350);assert.equal(readPersonalBest(storage,physics,map,course,'Pro')?.time,1400);
 assert.equal(values.size,2);assert.equal(readPersonalBest(storage,physics,map,'other','TP'),null);assert.equal(readPersonalBest(storage,'other-profile',map,course,'TP'),null);
});

test('PB readers preserve legacy keys and reject invalid records or the wrong Pro/TP category',()=>{
 assert.equal(personalBestKey('ckz-browser-2026-10-12-takeoff','map','main','TP'),'ckz-pb-v1:map:main:TP');
 for(const data of ['bad',JSON.stringify({time:0,teleports:1,splits:[]}),JSON.stringify({time:5,teleports:0,splits:[]})])assert.equal(readPersonalBest({getItem:()=>data},physics,map,course,'TP'),null);
 assert.equal(readPersonalBest({getItem:()=>{throw Error('blocked');}},physics,map,course,'TP'),null);
});
