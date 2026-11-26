import test from 'node:test';
import assert from 'node:assert/strict';
import {lockMouse,requestPlayCapture} from '../src/pointer-lock';

test('mouse lock requests raw movement',async()=>{
  const calls:unknown[]=[];
  assert.equal(await lockMouse({requestPointerLock:async options=>{calls.push(options);}}),'RAW REQUESTED');
  assert.deepEqual(calls,[{unadjustedMovement:true}]);
});
test('mouse lock retries standard mode only when raw input is unsupported',async()=>{
  const calls:unknown[]=[];
  const mode=await lockMouse({requestPointerLock:async options=>{
    calls.push(options);if(options)throw new DOMException('Raw input unsupported','NotSupportedError');
  }});
  assert.equal(mode,'STANDARD');assert.deepEqual(calls,[{unadjustedMovement:true},undefined]);
  let deniedCalls=0;
  await assert.rejects(lockMouse({requestPointerLock:async()=>{deniedCalls++;throw new DOMException('Denied','SecurityError');}}),{name:'SecurityError'});
  assert.equal(deniedCalls,1);
});
test('mouse lock supports older non-promise implementations',async()=>{
  assert.equal(await lockMouse({requestPointerLock:()=>{}}),'RAW REQUESTED');
});

test('first-entry capture starts pointer lock before fullscreen consumes activation',async()=>{
  let activation=true;const order:string[]=[];
  const capture=requestPlayCapture({requestPointerLock:()=>{order.push('pointer');assert.ok(activation);return Promise.resolve();}},()=>{order.push('fullscreen');activation=false;return Promise.resolve();});
  assert.deepEqual(order,['pointer','fullscreen']);await capture.fullscreen;assert.equal((await capture.mouse).ok,true);
});

test('fullscreen denial retains successful mouse lock, while mouse denial settles without losing the fullscreen result',async()=>{
  const ok=requestPlayCapture({requestPointerLock:async()=>{}},async()=>{throw Error('Fullscreen denied');});
  await ok.fullscreen;assert.equal((await ok.mouse).ok,true);
  let entered=false;const denied=requestPlayCapture({requestPointerLock:async()=>{throw new DOMException('Denied','SecurityError');}},async()=>{entered=true;});
  await denied.fullscreen;assert.ok(entered);assert.equal((await denied.mouse).ok,false);
});
