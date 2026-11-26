import {mapAssetUrl} from './map-assets';
import {jumpbugEvents,JumpbugWheel} from './jb-bind';
import {longJumpEvents} from './lj-bind';
import {rankedMode} from '../shared/ranking.mjs';
import * as THREE from 'three';
import {formatJump,formatJumpStats} from './jump-report';
import {jumpRating,jumpKinds} from './jump-tiers';
import {JumpSound} from './jump-sound';
import {DeveloperConsole} from './developer-console';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TriangleWorld } from './physics/collision';
import { Player, type Input, emptyInput } from './physics/movement';
import { Simulation } from './physics/clock';
import {movementProfile,type Timing} from './physics/profile';
import { type V, speed, clamp } from './physics/math';
import {MapTransport} from './physics/transport';
import {MapTriggerTransport} from './physics/map-trigger-transport';
import {maps,selectedMap,selectMap} from './map-catalog';
import {lockMouse,requestPlayCapture} from './pointer-lock';
import {captureGameKeys,keyboardCapture} from './keyboard-lock';
import {Checkpoints} from './physics/checkpoints';
import {CourseTimer} from './physics/timer';
import {KzMenu,type KzAction} from './kz-menu';
import {KeySound} from './key-sound';
import {Hud} from './hud';
import {ActionSound,addSoundSettings} from './action-sound';
import {MenuShell,menuMarkup} from './menu-shell';
import {RunResults,type RunResult} from './run-results';
import {FinishPanel} from './finish-panel';
import {Leaderboards} from './leaderboards';
import {RunRecorder,pose} from './replay';
import {ReplayViewer} from './replay-viewer';
import {validateReplay} from '../shared/replay.mjs';
import './replay-viewer.css';
import './style.css';
import './menu-shell.css';
import './finish-panel.css';
import './leaderboards.css';
const movementParams=new URLSearchParams(location.search);
const selectedMode=movementParams.get('mode')==='vnl'?'vnl':'ckz';
const selectedTiming=(['64','128','64x128'].includes(movementParams.get('timing')??'')?movementParams.get('timing'):'64') as Timing;
const requestedAA=movementParams.has('airaccelerate')?Number(movementParams.get('airaccelerate')):undefined;
const profile=movementProfile(selectedMode,selectedTiming,selectedMode==='vnl'&&requestedAA!==undefined&&Number.isFinite(requestedAA)&&requestedAA>=0&&requestedAA<=1000?requestedAA:undefined);
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<canvas id="viewport" aria-label="First person KZ map"></canvas>
<div id="crosshair">+</div>
${menuMarkup(profile.mode)}
<section id="debug" hidden><div class="eyebrow">SIMULATION / SOURCE COORDINATES</div><pre id="state"></pre><label><input id="collision" type="checkbox"> Collision overlay</label><label><input id="noclip" type="checkbox"> Noclip <kbd>N</kbd></label><label><input id="record" type="checkbox"> Record tick states</label><button id="download" class="text-button">Download state log ↓</button><p>Native triangle surfaces · approximate trace semantics</p></section>
<footer><div class="mode"><span>CLASSIC</span><small>64 ticks / 128 movement steps</small></div><div class="speed"><strong id="speed">0</strong><span>UNITS / SEC</span><div class="speed-track"><i id="speed-bar"></i></div></div><div class="stats"><div><span>VERTICAL</span><b id="vertical">0</b></div><div><span>TAKEOFF</span><b id="takeoff">—</b></div><div><span>LAST JUMP</span><b id="perf">—</b></div><div><span>STATE</span><b id="ground">PAUSED</b></div></div></footer><div id="notice" role="status"></div>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const menuShell=new MenuShell(el('menu'));
try{const saved=JSON.parse(sessionStorage.getItem('ckz-map-settings')??'null');if(saved){if(Number.isFinite(saved.sensitivity)&&saved.sensitivity>=0&&saved.sensitivity<=20)el<HTMLInputElement>('sensitivity').value=String(saved.sensitivity);if(typeof saved.fullscreen==='boolean')el<HTMLInputElement>('fullscreen-play').checked=saved.fullscreen;}}catch{/* Storage may be unavailable in embedded browsers. */}
el('map-browser').onclick=e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-map]');if(button)void switchMap(button.dataset.map!);};
el('debug').insertAdjacentHTML('beforeend','<label><input id="jump-record" type="checkbox" checked> Record flat-ground jumps</label><pre id="jump-detail">Complete a flat jump for the strafe breakdown.</pre><pre id="jump-history">No flat jumps recorded.</pre><button id="jump-download" class="text-button">Download jump log ↓</button> <button id="jump-clear" class="text-button">Clear jumps</button><p>Distance = horizontal origin travel + 32 units. Same-height, flat landings only; approximate native jumpstats.</p>');
app.insertAdjacentHTML('beforeend','<aside id="jump-readout" hidden></aside>');
const canvas=el<HTMLCanvasElement>('viewport'),menu=el('menu'),play=el<HTMLButtonElement>('play');
const timingSelect=el<HTMLSelectElement>('movement-timing');
timingSelect.value=selectedTiming;el('movement-timing-label').hidden=profile.mode==='ckz';
el('movement-description').textContent=`${rankedMode(profile.id)?'Ranked · leaderboard replays':'Unranked · local PBs and replays'} · air acceleration ${profile.airAccelerate}`;
menu.querySelector('.shell-heading > span')!.textContent=profile.mode==='vnl'?'CS:GO Vanilla':'Classic';
document.querySelector('.mode span')!.textContent=profile.mode.toUpperCase();document.querySelector('.mode small')!.textContent=`${1/(profile.step*profile.commandSteps)} commands / ${1/profile.step} movement steps`;
function selectMovement(mode:'ckz'|'vnl'){const url=new URL(location.href);if(mode==='ckz'){url.searchParams.delete('mode');url.searchParams.delete('timing');}else{url.searchParams.set('mode',mode);url.searchParams.set('timing',timingSelect.value);}url.searchParams.delete('airaccelerate');url.searchParams.delete('replay');location.assign(url.href);}
for(const button of Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-movement-mode]')))button.onclick=()=>{const mode=button.dataset.movementMode as 'ckz'|'vnl';if(mode!==profile.mode)selectMovement(mode);};
timingSelect.onchange=()=>{const url=new URL(location.href);url.searchParams.set('mode','vnl');url.searchParams.set('timing',timingSelect.value);url.searchParams.set('page','settings');url.searchParams.set('area','vanilla');url.searchParams.delete('airaccelerate');url.searchParams.delete('replay');location.assign(url.href);};
const finishPanel=new FinishPanel(app,()=>{menu.hidden=false;});
const leaderboards=new Leaderboards(menu,rankedMode(profile.id)!==null,profile.mode,profile.id);
leaderboards.onGuestName=()=>finishPanel.requestName();
finishPanel.onReplay=()=>{if(!lastLocalReplay)return;pause();menu.hidden=true;replayViewer.open(lastLocalReplay,'Your run');};
if(profile.mode==='vnl'){el('tab-leaderboards').textContent='VNL leaderboards';menu.querySelector('#menu-page-leaderboards h2')!.textContent='VNL leaderboards';}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene();scene.background=new THREE.Color('#141d25');scene.fog=new THREE.FogExp2('#141d25',0.00012);
const camera=new THREE.PerspectiveCamera(73.7398,innerWidth/innerHeight,1,40000);camera.up.set(0,1,0);
scene.add(new THREE.HemisphereLight('#dae9f3','#343037',2.6));const sun=new THREE.DirectionalLight('#ffeed9',2.5);sun.position.set(1000,2500,800);scene.add(sun);
const sourceToRender=(p:V)=>new THREE.Vector3(p[1],p[2],p[0]);
let player:Player,sim:Simulation,world:TriangleWorld,wire:THREE.Mesh,manifest:any;
let ready=false,active=false,debug=false,dragPreview=false,dragging=false,yaw=0,pitch=0,epoch=0,wall=0,lastFrame=performance.now(),frames=0,fps=0,fpsTime=lastFrame;
let mapModel:THREE.Object3D|undefined,loadGeneration=0;
let keySound:KeySound|undefined;
let mouseMode='UNLOCKED';
let keysCaptured=false;
let shownJumpId=0;
let checkpoints:Checkpoints,gameplay:any,kzPaused=false,lastStartSerial=0;
let runResults:RunResults,pendingResult:RunResult|null=null;
let recorder:RunRecorder;
let lastLocalReplay:ReturnType<RunRecorder['finish']>;
const replayViewer=new ReplayViewer(app,()=>{menu.hidden=false;menuShell.show('leaderboards');const url=new URL(location.href);url.searchParams.delete('replay');history.replaceState(null,'',url);});
let replayLoading=0;
let scoreboardHeld=false,scoreboardMouse=false;
function closeScoreboard(){scoreboardHeld=false;scoreboardMouse=false;menu.classList.remove("held-scoreboard","scoreboard-mouse");menu.hidden=true;}
// The held scoreboard keeps the current run active; only explicit pause/exit uses pause().
function holdScoreboard(){scoreboardHeld=true;scoreboardMouse=false;menu.classList.add("held-scoreboard");menuShell.show("leaderboards");menu.hidden=false;leaderboards.open(sim.timer?.course||"main",sim.timer?.teleports?"TP":"Pro");}
window.addEventListener('mousedown',e=>{if(!scoreboardHeld||e.button!==2)return;e.preventDefault();scoreboardMouse=true;menu.classList.add('scoreboard-mouse');document.exitPointerLock();});
window.addEventListener('contextmenu',e=>{if(scoreboardHeld)e.preventDefault();});
async function watchReplay(id:string,map:string,name='Recorded run'){
  if(!ready)return;
  if(map!==selectedMap.id){const url=new URL(location.href);url.searchParams.set('map',map);url.searchParams.set('replay',id);url.searchParams.set('page','leaderboards');location.assign(url.href);return;}
  const generation=++replayLoading;toast('Loading replay…');
  try{const response=await fetch('/api/replays/'+encodeURIComponent(id),{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Replay unavailable for this record.');const replay=validateReplay(await response.json());if(generation!==replayLoading)return;
    if(replay.map!==selectedMap.id||replay.mapHash!==manifest.mapSha256||replay.collisionHash!==manifest.collisionSha256)throw Error('This replay uses a different map version.');
    finishPanel.close();devConsole.close();document.exitPointerLock();pause();menu.hidden=true;replayViewer.open(replay,name);
  }catch(e){if(generation===replayLoading)toast((e as Error).message);}
}
leaderboards.onReplay=(id,map,name)=>{void watchReplay(id,map,name);};
function openLeaderboard(course?:string,category:'Pro'|'TP'='Pro'){
  document.exitPointerLock();pause();menu.hidden=false;menuShell.show('leaderboards');leaderboards.open(course,category);el('tab-leaderboards').focus();
}
finishPanel.onLeaderboard=(course,category)=>openLeaderboard(course,category);
const kzMenu=new KzMenu(app,kzAction,profile.mode.toUpperCase());
const hud=new Hud(app,kzMenu.clock,{host:el('settings-hud'),onOpen:()=>menuShell.showSettings('hud')});
const jumpSound=new JumpSound();jumpSound.configure(hud.prefs.jumpSounds,hud.prefs.jumpSoundVolume);
hud.onJumpSoundSettings=(enabled,volume)=>jumpSound.configure(enabled,volume);
hud.onJumpSoundPreview=tier=>jumpSound.preview(tier,hud.prefs.jumpSoundVolume);
menuShell.onHudOpen=()=>hud.open();
const actionSound=new ActionSound();
addSoundSettings(el('audio-settings-host'),actionSound);
el<HTMLDetailsElement>('sound-options').open=true;
const toast=(s:string)=>{el('notice').textContent=s;setTimeout(()=>{el('notice').textContent='';},3500);};
const devConsole=new DeveloperConsole(app,()=>{document.exitPointerLock();pause();el('debug').hidden=true;debug=false;});
el('console-bind-controls').insertAdjacentHTML('beforeend','<label class="sensitivity">Longjump bind <button id="lj-bind" type="button">Mouse2</button></label><small>Duck + jump; releases forward/back. Click to assign a key or right/middle mouse. Esc cancels. Console: bind_lj None disables.</small>');
el('console-bind-controls').insertAdjacentHTML('beforeend','<label class="sensitivity">Jumpbug key <button id="jb-bind" type="button">None</button></label><small>Press: jump + unduck + release forward. Release: stop jump. You time the input.</small><label><input id="jb-wheel" type="checkbox"> Jumpbug wheel-up sequence</label><small>First scroll ducks; further scrolls unduck + pulse jump. Press W to reset. Wheel down stays normal jump.</small>');
el('jb-bind').onclick=()=>{el('jb-bind').textContent='Press a key or mouse button…';devConsole.captureBinding('jb');};
el<HTMLInputElement>('jb-wheel').onchange=e=>{devConsole.prefs.jbWheel=(e.target as HTMLInputElement).checked;devConsole.save();jbWheel.reset();};
el('lj-bind').onclick=()=>{el('lj-bind').textContent='Press a key or mouse button…';devConsole.captureBinding('lj');};
el('console-bind-controls').insertAdjacentHTML('beforeend','<label class="sensitivity">Console key <button id="console-bind" type="button"></button></label><small>Click and press a key. Esc cancels. The console key overrides gameplay binds.</small>');
devConsole.onPrefs=()=>{el('jb-bind').textContent=devConsole.prefs.jbKey;el<HTMLInputElement>('jb-wheel').checked=devConsole.prefs.jbWheel;el('lj-bind').textContent=devConsole.prefs.ljKey;el<HTMLInputElement>('sensitivity').value=String(devConsole.prefs.sensitivity);el('console-bind').textContent=devConsole.prefs.consoleKey;el('console-key-hint').textContent=devConsole.prefs.consoleKey;};
devConsole.onPrefs();
el('console-bind').onclick=()=>{el('console-bind').textContent='Press a key…';devConsole.captureBinding();};
el<HTMLInputElement>('sensitivity').onchange=e=>{const n=Number((e.target as HTMLInputElement).value);if(Number.isFinite(n))devConsole.prefs.sensitivity=clamp(n,0,20);devConsole.save();};
function setDebug(){devConsole.open();}
const requireReady=()=>{if(!ready)throw Error('Map is still loading.');};
const noArgs=(args:string[])=>{if(args.length)throw Error('This command takes no arguments.');};
for(const [name,action] of Object.entries({checkpoint:'checkpoint',cp:'checkpoint',teleport:'teleport',tp:'teleport',undo:'undo',restart:'restart',noclip:'noclip'}))devConsole.add(name,'KZ '+action,args=>{noArgs(args);requireReady();kzAction(action as KzAction);return el('notice').textContent??'Done';});
devConsole.add('hud','Open HUD / crosshair settings',args=>{noArgs(args);devConsole.close();hud.open();});
devConsole.add('kz_stats','Print the latest full jump report',args=>{noArgs(args);requireReady();const last=player.jumpLog.records.at(-1);return last?formatJump(last):'No flat jumps recorded.';});
devConsole.add('kz_export','Download jump reports and raw samples',args=>{noArgs(args);requireReady();el('jump-download').click();return 'Jump log exported.';});
devConsole.add('kz_clear','Clear recorded jumps',args=>{noArgs(args);requireReady();el('jump-clear').click();return 'Jump records cleared.';});
devConsole.add('sv_airaccelerate','[0..1000] VNL air acceleration; changing restarts the map with separate local PBs',args=>{if(!args.length)return String(profile.airAccelerate);if(profile.mode!=='vnl')throw Error('Select VNL in the menu first.');if(args.length!==1)throw Error('Usage: sv_airaccelerate 12');const value=Number(args[0]);movementProfile('vnl',profile.timing,value);const url=new URL(location.href);url.searchParams.set('airaccelerate',String(value));location.assign(url.href);return 'Reloading movement profile';});
devConsole.add('replay_last','Watch the last completed local run',args=>{noArgs(args);if(!lastLocalReplay)throw Error('No completed replay in this session.');devConsole.close();finishPanel.close();pause();menu.hidden=true;replayViewer.open(lastLocalReplay,profile.mode.toUpperCase()+' local run');});
devConsole.add('replay_export','Download the last completed run with movement configuration',args=>{noArgs(args);if(!lastLocalReplay)throw Error('No completed replay in this session.');const url=URL.createObjectURL(new Blob([JSON.stringify(lastLocalReplay)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=lastLocalReplay.physics+'.replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'Replay exported.';});
devConsole.add('movement_profile','Show movement configuration',()=>JSON.stringify(profile,null,2));
devConsole.add('kz_state','Print current movement / duck state',args=>{noArgs(args);requireReady();return JSON.stringify({profile:profile.id,stamina:player.stamina,position:player.position,velocity:player.velocity,duckAmount:player.duckAmount,duckSpeed:player.duckSpeed,hull:[32,32,player.height],eye:player.eye},null,2);});
for(const name of ['kz_jumpstats','collision','record'])devConsole.add(name,'[0|1] '+({kz_jumpstats:'Record flat jumps',collision:'Collision overlay',record:'Record movement ticks'}[name]),args=>{requireReady();const input=el<HTMLInputElement>({kz_jumpstats:'jump-record',collision:'collision',record:'record'}[name]!);if(args.length){if(args.length!==1||!['0','1'].includes(args[0]))throw Error('Usage: '+name+' 0|1');input.checked=args[0]==='1';input.dispatchEvent(new Event('change'));}return name+' '+Number(input.checked);});
devConsole.add('record_export','Download recorded movement ticks',args=>{noArgs(args);requireReady();el('download').click();return 'State log exported.';});
function reset(){ljHeld=false;jbHeld=false;jbWheel.reset();recorder?.reset();finishPanel.close();runResults?.reset();pendingResult=null;keySound?.stop();sim.reset();checkpoints.clear();kzPaused=false;lastStartSerial=sim.timer?.startSerial??0;const start=gameplay?.destinations[0];if(start){player.position=[...start.position] as V;player.previous=[...start.position] as V;}yaw=start?.yaw??manifest.yaw;pitch=start?.pitch??0;sim.input.yaw=yaw;sim.input.pitch=pitch;sim.previousYaw=yaw;sim.desiredYaw=yaw;sim.previousPitch=pitch;sim.desiredPitch=pitch;epoch=performance.now()/1000;wall=0;toast('Returned to course start');actionSound.play('reset');}
function toggleNoclip(){player.noclip=!player.noclip;player.onLadder=false;player.velocity=[0,0,0];player.jumpLog.cancel();if(player.noclip)sim.timer?.reset();el<HTMLInputElement>('noclip').checked=player.noclip;toast(player.noclip?'Noclip enabled · WASD follows your view':'Noclip disabled');if(player.noclip)actionSound.play('noclip');}
function kzAction(action:KzAction){
  if(!ready||replayViewer.replay)return;
  if(action==='checkpoint'){const count=checkpoints.points.length;toast(checkpoints.save(yaw,pitch));if(checkpoints.points.length>count)actionSound.play('checkpoint');}
  else if(action==='teleport'||action==='previous'||action==='next'){const count=checkpoints.teleports;toast(checkpoints.teleport(action==='previous'?-1:action==='next'?1:0,yaw,pitch));if(checkpoints.teleports>count)actionSound.play('teleport');}
  else if(action==='undo'){const count=checkpoints.teleports;toast(checkpoints.undo(yaw,pitch));if(checkpoints.teleports>count)actionSound.play('teleport');}
  else if(action==='restart')reset();
  else if(action==='noclip')toggleNoclip();
  else if(action==='pause'){
    if(!kzPaused&&!player.grounded&&!player.onLadder){toast('Pause requires ground or ladder contact');return;}
    kzPaused=!kzPaused;
    sim.events=[];sim.input={...emptyInput(),yaw,pitch};sim.previousYaw=yaw;sim.desiredYaw=yaw;sim.previousPitch=pitch;sim.desiredPitch=pitch;sim.oldJump=false;
    epoch=performance.now()/1000-sim.time-profile.step;toast(kzPaused?'Paused':'Resumed');
  }else if(action==='jumpstats'){player.jumpLog.enabled=!player.jumpLog.enabled;player.jumpLog.cancel();el<HTMLInputElement>('jump-record').checked=player.jumpLog.enabled;}
  else if(action==='clear'){checkpoints.clear();toast('Checkpoints cleared');}
  else if(action==='collision'){wire.visible=!wire.visible;el<HTMLInputElement>('collision').checked=wire.visible;}
  else if(action==='settings'){document.exitPointerLock();pause();menuShell.showSettings('controls');}
  else if(action==='hud'){document.exitPointerLock();pause();hud.open();}
  el<HTMLInputElement>('noclip').checked=player.noclip;
}
function pause(){ljHeld=false;jbHeld=false;jbWheel.reset();if(scoreboardHeld)closeScoreboard();keySound?.stop();active=false;dragging=false;if(!document.fullscreenElement){keyboardCapture()?.unlock?.();keysCaptured=false;}menu.hidden=finishPanel.open||Boolean(replayViewer.replay);if(!el('menu-page-settings').hidden&&!el('settings-hud').hidden)hud.open();play.textContent='Resume →';if(sim){sim.events=[];sim.input={...emptyInput(),yaw,pitch};sim.previousYaw=yaw;sim.desiredYaw=yaw;sim.previousPitch=pitch;sim.desiredPitch=pitch;sim.oldJump=false;}el('ground').textContent='PAUSED';updateFullscreenControls();}
function updateFullscreenControls(){const fullscreen=Boolean(document.fullscreenElement);el('exit-fullscreen').hidden=!fullscreen;el('menu-key-hint').textContent=fullscreen?(keysCaptured?'Esc / P · menu · Hold Esc to exit fullscreen':'P · menu without leaving fullscreen'):'Esc / P · menu · P / Resume to play';}
el('exit-fullscreen').onclick=()=>{keyboardCapture()?.unlock?.();keysCaptured=false;void document.exitFullscreen().catch(()=>{updateFullscreenControls();toast('Hold Esc to exit fullscreen.');});};
updateFullscreenControls();
function activate(){active=true;menu.hidden=true;epoch=performance.now()/1000-sim.time-profile.step;lastFrame=performance.now();canvas.focus();}
let starting=false;
async function start(){
  if(!ready||starting)return;
  starting=true;
  actionSound.unlock();
  jumpSound.unlock();
  try{keySound?.unlock();}catch(e){console.warn('Audio unavailable',e);}
  const capture=requestPlayCapture(canvas,el<HTMLInputElement>('fullscreen-play').checked&&!document.fullscreenElement?()=>document.documentElement.requestFullscreen():undefined);
  try{
    await capture.fullscreen;
    keysCaptured=await captureGameKeys(Boolean(document.fullscreenElement),keyboardCapture());
    updateFullscreenControls();
    const mouse=await capture.mouse;
    if(mouse.ok){mouseMode=mouse.mode;dragPreview=false;if(document.pointerLockElement===canvas)activate();if(!keysCaptured)toast('Shortcut protection unavailable. Use C to duck to avoid Ctrl+W; fullscreen keyboard permission is needed.');}
    else{mouseMode='DRAG PREVIEW';dragPreview=true;activate();toast('Pointer lock unavailable: hold left mouse to look. Use C to duck.');}
  }finally{starting=false;}
}
play.onclick=start;canvas.onclick=()=>{if(!active)void start();};
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){dragPreview=false;if(!active&&!starting)activate();}
  else if(!dragPreview&&!(scoreboardHeld&&scoreboardMouse))pause();
});
canvas.tabIndex=0;
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){keyboardCapture()?.unlock?.();keysCaptured=false;if(active){document.exitPointerLock();pause();}}updateFullscreenControls();});
canvas.addEventListener('mousedown',()=>{dragging=true;});window.addEventListener('mouseup',()=>{dragging=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){document.exitPointerLock();pause();}});
window.addEventListener('blur',()=>{if(active){document.exitPointerLock();pause();}});
const keyMap:Record<string,keyof Input>={KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',Space:'jump',ControlLeft:'duck',ControlRight:'duck',KeyC:'duck',ShiftLeft:'walk'};
let ljHeld=false,jbHeld=false;
const jbWheel=new JumpbugWheel();
function jbAction(pressed:boolean){if(pressed===jbHeld)return;jbHeld=pressed;for(const event of jumpbugEvents(eventTime(),pressed))sim.enqueue(event);}
function ljAction(pressed:boolean){if(pressed===ljHeld)return;ljHeld=pressed;for(const event of longJumpEvents(eventTime(),pressed))sim.enqueue(event);}
canvas.addEventListener('mousedown',e=>{const code=e.button===2?'Mouse2':e.button===1?'Mouse3':'';if(active&&!kzPaused&&!scoreboardHeld){if(code===devConsole.prefs.ljKey){e.preventDefault();ljAction(true);}else if(code===devConsole.prefs.jbKey){e.preventDefault();jbAction(true);}}});
window.addEventListener('mouseup',e=>{const code=e.button===2?'Mouse2':e.button===1?'Mouse3':'';if(active){if(ljHeld&&code===devConsole.prefs.ljKey){e.preventDefault();ljAction(false);}else if(jbHeld&&code===devConsole.prefs.jbKey){e.preventDefault();jbAction(false);}}});
canvas.addEventListener('contextmenu',e=>{if(active)e.preventDefault();});
const eventTime=()=>Math.max(sim.time,performance.now()/1000-epoch);
window.addEventListener('keydown',e=>{
  const target=e.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;
  if(devConsole.opened)return;
  if(!ready)return;
  if(!active){if(e.code==='KeyP'&&!menu.hidden&&!finishPanel.open&&!replayViewer.replay){e.preventDefault();if(!e.repeat)void start();}return;}
  if(e.code==='KeyW'&&!e.repeat)jbWheel.reset();
  if(e.code===devConsole.prefs.jbKey&&!scoreboardHeld&&!kzPaused){e.preventDefault();if(!e.repeat)jbAction(true);return;}
  if(e.code===devConsole.prefs.ljKey&&!scoreboardHeld&&!kzPaused){e.preventDefault();if(!e.repeat)ljAction(true);return;}
  if(e.code==='Tab'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(!e.repeat)holdScoreboard();return;}
  if(scoreboardHeld&&scoreboardMouse&&e.code!=='Escape')return;
  if(e.code==='KeyM'||/^Digit[0-9]$/.test(e.code)){e.preventDefault();if(!e.repeat)kzMenu.key(e.code);return;}
  if(keyMap[e.code]||e.code==='KeyR'||e.code==='KeyN')e.preventDefault();
  if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!e.repeat){document.exitPointerLock();pause();play.focus();}return;}
  if(e.code==='KeyR'&&!e.repeat){reset();return;}
  if(e.code==='KeyN'&&!e.repeat){toggleNoclip();return;}
  if(kzPaused)return;
  const key=keyMap[e.code];if(key){e.preventDefault();if(!e.repeat)sim.enqueue({time:eventTime(),key,value:true});}
});
window.addEventListener('keyup',e=>{if(active&&e.code===devConsole.prefs.jbKey){e.preventDefault();jbAction(false);return;}if(active&&e.code===devConsole.prefs.ljKey){e.preventDefault();ljAction(false);return;}if(e.code==='Tab'&&scoreboardHeld){e.preventDefault();const restoreMouse=scoreboardMouse&&!dragPreview;closeScoreboard();canvas.focus();if(restoreMouse&&active)void lockMouse(canvas).then(mode=>{mouseMode=mode;}).catch(()=>pause());return;}if(active&&keyMap[e.code]){e.preventDefault();sim.enqueue({time:eventTime(),key:keyMap[e.code],value:false});}});
window.addEventListener('mousemove',e=>{
  if(!active||(dragPreview?!dragging:document.pointerLockElement!==canvas))return;
  if(!Number.isFinite(e.movementX)||!Number.isFinite(e.movementY))return;
  const s=Number(el<HTMLInputElement>('sensitivity').value),sens=Number.isFinite(s)?clamp(s,0,20):1.5;
  yaw-=e.movementX*devConsole.prefs.m_yaw*sens;pitch=clamp(pitch+e.movementY*devConsole.prefs.m_pitch*sens,-89,89);
  if(kzPaused)return;
  const time=eventTime();sim.enqueue({time,key:'yaw',value:yaw});sim.enqueue({time,key:'pitch',value:pitch});
});
canvas.addEventListener('wheel',e=>{if(active&&!kzPaused&&!scoreboardHeld){e.preventDefault();if(!e.deltaY)return;const time=eventTime();if(devConsole.prefs.jbWheel&&e.deltaY<0){for(const event of jbWheel.scroll(time))sim.enqueue(event);}else sim.enqueue({time,pulse:true});}},{passive:false});
el('debug-toggle').onclick=setDebug;
el<HTMLInputElement>('jump-record').onchange=e=>{if(player){player.jumpLog.enabled=(e.target as HTMLInputElement).checked;player.jumpLog.cancel();}};
el('jump-clear').onclick=()=>{if(player){player.jumpLog.clear();shownJumpId=0;el('jump-readout').hidden=true;el('jump-history').textContent='No flat jumps recorded.';el('jump-detail').textContent='Complete a flat jump for the strafe breakdown.';}};
el('jump-download').onclick=()=>{
  if(!player)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:2,map:manifest.name,physicsStepHz:1/profile.step,movement:profile,reference:{distance:284.08422,pre:274.7272,max:379.688,sync:95.95,strafes:10,airtime:99,height:55.8281},reports:player.jumpLog.records.map(formatJump),convention:'Horizontal origin displacement + 32; flat same-height jumps. Native adjusted endpoint/distbug correction is not implemented.',jumps:player.jumpLog.records},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='ckz-flat-jumps.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el<HTMLInputElement>('collision').onchange=e=>{if(wire)wire.visible=(e.target as HTMLInputElement).checked;};
el<HTMLInputElement>('noclip').onchange=()=>{if(player)toggleNoclip();};
el<HTMLInputElement>('record').onchange=e=>{if(sim)sim.logging=(e.target as HTMLInputElement).checked;};
el('download').onclick=()=>{if(!sim)return;const url=URL.createObjectURL(new Blob([JSON.stringify({map:manifest,steps:sim.history},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ckz-state-log.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function disposeMap(object:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();object.removeFromParent();object.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();for(const geometry of geometries)geometry.dispose();}
function mapLoadFailed(e:unknown){el('map-progress').hidden=true;play.disabled=true;play.textContent='Map load failed';el('map-status').textContent=(e as Error).message;toast((e as Error).message);console.error(e);}
async function switchMap(id:string,push=true){
  if(!maps.some(m=>m.id===id)||id===selectedMap.id&&ready)return;
  finishPanel.close();replayViewer.close();devConsole.close();document.exitPointerLock();pause();
  ready=false;document.body.classList.add('map-loading');selectMap(id,push);menuShell.mapChanged(profile.mode==='vnl'?'Vanilla':'Classic');leaderboards.mapChanged();
  menu.hidden=false;pendingResult=null;lastLocalReplay=undefined;shownJumpId=0;replayLoading++;kzPaused=false;dragPreview=false;keySound?.dispose();keySound=undefined;jumpSound.stop();recorder?.reset();
  if(mapModel){disposeMap(mapModel);mapModel=undefined;}if(wire){disposeMap(wire);}renderer.renderLists.dispose();
  el<HTMLInputElement>('noclip').checked=false;el<HTMLInputElement>('collision').checked=false;el('jump-history').textContent='No flat jumps recorded.';el('jump-detail').textContent='Complete a flat jump for the strafe breakdown.';
  play.disabled=true;play.textContent='Loading map…';el('map-status').textContent='Reading map assets…';
  const generation=loadGeneration+1;
  try{await load();}catch(e){if(loadGeneration===generation)mapLoadFailed(e);}
}
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('map')??maps[0].id;if(id!==selectedMap.id)void switchMap(id,false);});
async function load(){
  const generation=++loadGeneration,map=selectedMap,assets=map.assets;
  const progress=el<HTMLProgressElement>('map-progress');progress.hidden=false;progress.removeAttribute('value');
  el('map-status').textContent='Reading map assets…';
  // The manager includes GLB dependencies (textures), not just the scene file.
  const manager=new THREE.LoadingManager();
  manager.onProgress=(_url,loaded,total)=>{
    if(generation!==loadGeneration)return;
    progress.max=total;progress.value=loaded;
    el('map-status').textContent=`Loading assets · ${loaded} / ${total} files`;
  };
  const json=async(file:string)=>{const response=await fetch(`${assets}/${file}`);if(!response.ok)throw Error(`${map.name}: ${file} missing. Prepare this map, then reload.`);return response.json();};
  const bytes=async(file:string)=>{const url=`${assets}/${file}`;manager.itemStart(url);try{const response=await fetch(url);if(!response.ok)throw Error(`${map.name}: ${file} missing. Prepare this map, then reload.`);return await response.arrayBuffer();}finally{manager.itemEnd(url);}};
  const [nextManifest,nextGameplay]=await Promise.all([json('manifest.json'),json('gameplay.json')]);
  if(generation!==loadGeneration)return;
  if(nextManifest.workshopId!==map.id||nextManifest.name!==map.name)throw Error('Map identity does not match its catalog entry. Prepare this map again.');
  const nativeEmission=nextGameplay.markers.find((m:any)=>m.emissiveTexture)?.emissiveTexture;
  const emissionUrl=nativeEmission?mapAssetUrl(nativeEmission):undefined;
  const results=await Promise.allSettled([new GLTFLoader(manager).loadAsync(`${assets}/${nextManifest.renderAsset??'map.glb'}`,event=>{if(generation!==loadGeneration)return;const loaded=(event.loaded/1048576).toFixed(1);if(event.lengthComputable){progress.max=event.total;progress.value=event.loaded;el('map-status').textContent=`Downloading scene · ${loaded} / ${(event.total/1048576).toFixed(1)} MB`;}else{progress.removeAttribute('value');el('map-status').textContent=`Downloading scene · ${loaded} MB`;}}),bytes('collision.bin'),bytes('ladders.bin'),json('transports.json'),json('splits.json'),nextGameplay.markers.length?new THREE.TextureLoader(manager).loadAsync(mapAssetUrl(nextGameplay.markers[0].texture)):Promise.resolve(undefined),emissionUrl?new THREE.TextureLoader(manager).loadAsync(emissionUrl):Promise.resolve(undefined)]);
  const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
  if(failure||generation!==loadGeneration){if(results[0].status==='fulfilled')disposeMap((results[0].value as Awaited<ReturnType<GLTFLoader['loadAsync']>>).scene);for(const i of [5,6]){const r=results[i];if(r.status==='fulfilled'&&r.value instanceof THREE.Texture)r.value.dispose();}if(failure)throw failure.reason;return;}
  const [gltf,binary,ladderBinary,transports,splits,markerTexture,emissionTexture]=results.map(r=>(r as PromiseFulfilledResult<unknown>).value) as [Awaited<ReturnType<GLTFLoader['loadAsync']>>,ArrayBuffer,ArrayBuffer,any,any,THREE.Texture|undefined,THREE.Texture|undefined];
  progress.removeAttribute('value');el('map-status').textContent='Preparing map…';
  // Let the preparation status paint before building collision and GPU resources.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  if(generation!==loadGeneration){disposeMap(gltf.scene);markerTexture?.dispose();emissionTexture?.dispose();return;}
  manifest=nextManifest;gameplay=nextGameplay;
  const data=new Float32Array(binary);world=new TriangleWorld(data);
  player=new Player(world,manifest.spawn,profile);player.ladders=new TriangleWorld(new Float32Array(ladderBinary));sim=new Simulation(player);
  player.jumpLog.enabled=el<HTMLInputElement>('jump-record').checked;sim.logging=el<HTMLInputElement>('record').checked;
  sim.transport=manifest.transportImplementation==='context-v2'?new MapTriggerTransport(transports):new MapTransport(transports);
  if(manifest.keySound){keySound=new KeySound(`${assets}/${manifest.keySound.file}`,manifest.keySound.delay);sim.transport.onEnter=id=>{if(id===manifest.keySound.triggerId)keySound?.play();};}

  leaderboards.setCourses(gameplay.courses);leaderboards.open();
  sim.timer=new CourseTimer(gameplay.zones);checkpoints=new Checkpoints(sim);
  let pbStorage:Storage|undefined;try{pbStorage=localStorage;}catch{}
  runResults=new RunResults(selectedMap.id,splits,pbStorage,profile.id);
  recorder=new RunRecorder({map:selectedMap.id,mapHash:manifest.mapSha256,collisionHash:manifest.collisionSha256},profile);
  let beforePose:number[]=[];
  sim.onBeforeStep=()=>{beforePose=pose(player,sim.input.yaw,sim.input.pitch);};
  sim.onStep=(input,jumps,time,teleported)=>{if(player.noclip)recorder.reset();else recorder.step(sim.timer!,beforePose,pose(player,sim.input.yaw,sim.input.pitch),input,jumps,time,teleported);};
  sim.timer.onUpdate=(p,time,dt)=>{const result=runResults.observe(sim.timer!,p,time,dt);if(result)pendingResult=result;};
  yaw=manifest.yaw;pitch=0;sim.input.yaw=yaw;sim.input.pitch=pitch;sim.previousYaw=yaw;sim.desiredYaw=yaw;sim.previousPitch=pitch;sim.desiredPitch=pitch;
  const model=gltf.scene;model.scale.multiplyScalar(1/0.0254);
  // Exported Source photometric values are not calibrated to this viewer's exposure.
  // Divert's directional intensity 683 washes out its textures; use the scene lights.
  model.traverse(o=>{if(o instanceof THREE.Light)o.visible=false;});
  // Missing baked interior bounce makes Dydanhomon's downward-facing rock roof black.
  // A bounded map-local preview fill reveals its existing texture, without changing materials.
  if(manifest.workshopId==='3801640043')model.add(new THREE.AmbientLight('#fff4e5',.6));
  model.traverse(o=>{if(o instanceof THREE.Mesh){
    if(manifest.renderAsset){
      for(const material of (Array.isArray(o.material)?o.material:[o.material])){
        const vmat=material.userData.vmat;
        // Native overlays depth-test against the world but never write depth.
        if(material.userData.nativeOverlay){material.depthWrite=false;material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;}
        // CS2 foliage COLOR is wind/AO data, not albedo tint (VRF complex.vert).
        if(manifest.nativeFoliageVertexData&&vmat?.ShaderName==='csgo_foliage.vfx')material.vertexColors=false;
        // Fancy water has no glTF shader equivalent; preview its authored water tint.
        if(manifest.nativeWaterPreview&&vmat?.ShaderName==='csgo_water_fancy.vfx'&&material instanceof THREE.MeshStandardMaterial){
          const tint=vmat.VectorParams?.g_vWaterDecayColor;
          if(tint?.length>=3){material.color.setRGB(tint[0],tint[1],tint[2],THREE.SRGBColorSpace);material.transparent=true;material.opacity=.5;material.depthWrite=false;material.roughness=vmat.FloatParams?.g_flWaterRoughnessMin??.3;}
        }
        if(vmat?.IntParams?.F_ADDITIVE_BLEND){material.blending=THREE.AdditiveBlending;material.transparent=true;material.depthWrite=false;}
      }
      return;
    }
    const name=o.name.toLowerCase();let color='#879b9f';if(/sand|stone_ground/.test(name))color='#b9a383';else if(/wall/.test(name))color='#7b8e95';else if(/ladder|wood/.test(name))color='#a08461';else if(/gradient_start/.test(name))color='#65b29c';o.material=new THREE.MeshStandardMaterial({color,roughness:0.95,metalness:0,side:THREE.DoubleSide});
  }});

  if(markerTexture){markerTexture.flipY=false;markerTexture.colorSpace=THREE.SRGBColorSpace;markerTexture.wrapS=markerTexture.wrapT=THREE.RepeatWrapping;}


  if(emissionTexture){emissionTexture.flipY=false;emissionTexture.colorSpace=THREE.SRGBColorSpace;emissionTexture.wrapS=emissionTexture.wrapT=THREE.RepeatWrapping;}
  // GLTFLoader sanitizes dots in Object3D.name but retains the authored node name here.
  model.traverse(o=>{if(o instanceof THREE.Mesh){const marker=gameplay.markers.find((m:any)=>m.mesh===(o.userData.name??o.name));if(marker){(o.material as THREE.Material).dispose();const tint=new THREE.Color().setRGB(...marker.color as [number,number,number]),options={map:markerTexture,transparent:true,depthWrite:false,blending:marker.blend==='normal'?THREE.NormalBlending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false};o.material=marker.emissiveTexture?new THREE.MeshStandardMaterial({...options,color:0x000000,emissive:tint,emissiveMap:emissionTexture,emissiveIntensity:1}):new THREE.MeshBasicMaterial({...options,color:tint});}}});
  scene.add(model);mapModel=model;
  const rendered=new Float32Array(data.length);for(let i=0;i<data.length;i+=3){rendered[i]=data[i+1];rendered[i+1]=data[i+2];rendered[i+2]=data[i];}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(rendered,3));
  wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#6affc5',wireframe:true,transparent:true,opacity:0.5,depthTest:false}));wire.visible=false;scene.add(wire);
  for(let i=0;i<64;i++)player.tick(emptyInput(),i*profile.step,profile.step,0);
  player.spawn=[...player.position];player.reset();
  progress.hidden=true;ready=true;document.body.classList.remove('map-loading');const requestedReplay=new URLSearchParams(location.search).get('replay');if(requestedReplay)void watchReplay(requestedReplay,selectedMap.id);play.disabled=false;play.textContent='Enter map';el('map-status').textContent='Ready';el('map-name').textContent=manifest.name;
  // Read-only inspection seam for diagnostics; it cannot drive or modify simulation.
  if(!Object.hasOwn(window,"ckz"))Object.defineProperty(window,'ckz',{value:{getState:()=>({position:[...player.position],velocity:[...player.velocity],grounded:player.grounded,ducked:player.ducked,noclip:player.noclip,onLadder:player.onLadder,jumps:player.jumps,tick:sim.tick,yaw,pitch,active,triangles:world.triangleCount,perf:player.lastPerf})}});
}
const initialLoad=load(),initialLoadGeneration=loadGeneration;initialLoad.catch(e=>{if(loadGeneration===initialLoadGeneration)mapLoadFailed(e);});
function frame(now:number){
  requestAnimationFrame(frame);frames++;if(now-fpsTime>500){fps=Math.round(frames*1000/(now-fpsTime));fpsTime=now;frames=0;}
  if(ready){
    if(active){if(kzPaused){epoch=now/1000-sim.time-profile.step;wall=sim.time+profile.step;}else if(now-lastFrame>250){document.exitPointerLock();pause();toast('Paused after a frame stall');}else{wall=now/1000-epoch;sim.advance(wall-profile.step,wall);}}
    if(pendingResult){const result=pendingResult;pendingResult=null;actionSound.play('finish');pause();document.exitPointerLock();menu.hidden=true;finishPanel.show(result,manifest.name,gameplay.courses?.find((c:any)=>c.key===result.course)?.name??'Main',runResults.zones.some(z=>z.course===result.course));lastLocalReplay=recorder.finish();finishPanel.replayAvailable(Boolean(lastLocalReplay));const version=finishPanel.version;void leaderboards.completed(result,message=>finishPanel.submission(message,version),lastLocalReplay);}
    if(sim.teleportYaw!==undefined){yaw=sim.teleportYaw;sim.teleportYaw=undefined;}
    if(sim.teleportPitch!==undefined){pitch=sim.teleportPitch;sim.teleportPitch=undefined;}
    if(sim.timer&&sim.timer.startSerial!==lastStartSerial){lastStartSerial=sim.timer.startSerial;checkpoints.clear();}
    if(sim.timer)kzMenu.update(active,debug,kzPaused,checkpoints.points.length,checkpoints.selected,sim.timer.state==='running'||sim.timer.state==='finished'?sim.timer.teleports:checkpoints.teleports,sim.timer.state,sim.timer.elapsed,sim.timer.practice,player.jumpLog.enabled);
    const alpha=active?clamp((wall-profile.step-sim.time)/profile.step,0,1):1;
    const p=player.previous.map((v,i)=>v+(player.position[i]-v)*alpha) as V;p[2]+=player.previousEye+(player.eye-player.previousEye)*alpha;camera.position.copy(sourceToRender(p));
    const y=yaw*Math.PI/180,a=pitch*Math.PI/180;const direction:V=[Math.cos(y)*Math.cos(a),Math.sin(y)*Math.cos(a),-Math.sin(a)];camera.lookAt(camera.position.clone().add(sourceToRender(direction)));
    const s=speed(player.velocity);el('speed').textContent=s.toFixed(0);el('speed-bar').style.width=`${Math.min(100,s/5)}%`;el('vertical').textContent=player.velocity[2].toFixed(0);el('takeoff').textContent=player.lastTakeoff.toFixed(0);el('perf').textContent=player.lastPerf;el('perf').className=player.lastPerf==='PERF'?'good':'';
    el('ground').textContent=!active?'PAUSED':player.noclip?'NOCLIP':player.onLadder?'LADDER':player.grounded?'GROUND':'AIR';
    const lastJump=player.jumpLog.records.at(-1);
    if(lastJump&&lastJump.id!==shownJumpId){
      const tier=jumpRating(lastJump.distance,profile.mode,jumpKinds(player.jumpLog.records).get(lastJump.id));if(tier)jumpSound.play(tier.key);
      shownJumpId=lastJump.id;el('jump-readout').hidden=false;const report=formatJump(lastJump);devConsole.print(report);
      const distance=(n:number)=>(Math.floor(n*100)/100).toFixed(2);
      el('jump-readout').textContent=`FLAT JUMP ${distance(lastJump.distance)} units\n${formatJumpStats(lastJump)}`;
      el('jump-history').textContent=player.jumpLog.records.slice(-5).map(j=>`#${j.id}  ${distance(j.distance)}  HEIGHT ${j.maxHeight.toFixed(2)}  PRE ${j.takeoffSpeed.toFixed(0)}  MAX ${j.maxSpeed.toFixed(0)}  ${j.strafes} str`).join('\n');
    }
    if(debug)el('state').textContent=`${fps} FPS  ·  step ${sim.tick}\nXYZ  ${player.position.map(v=>v.toFixed(2)).join(' / ')}\nVEL  ${player.velocity.map(v=>v.toFixed(2)).join(' / ')}\nPRE  ${player.pre.gain.toFixed(2)}  ·  HULL 32×32×${player.height}\nDUCK ${player.duckAmount.toFixed(3)} · RATE ${player.duckSpeed.toFixed(3)} · EYE ${player.eye.toFixed(2)}\nYAW  ${yaw.toFixed(2)}  ·  JUMPS ${player.jumps}\nMOUSE ${mouseMode}\nKEYS ${keysCaptured?'CAPTURED':'C DUCK RECOMMENDED'}\nTRACE ${world.queries}  ·  LOG ${sim.history.length}`;
    hud.update({mode:profile.mode,speed:s,prespeed:player.lastTakeoff,jumps:player.jumps,grounded:player.grounded,perf:player.lastPerf,jumpbug:player.lastJumpbug,input:sim.input,active,state:kzPaused?'paused':sim.timer?.state??'idle',elapsed:sim.timer?.elapsed??0,practice:sim.timer?.practice??false,teleports:sim.timer&&(sim.timer.state==='running'||sim.timer.state==='finished')?sim.timer.teleports:checkpoints.teleports,checkpoints:checkpoints.points.length,selected:checkpoints.selected,map:manifest.name,course:gameplay.courses?.find((c:any)=>c.key===sim.timer?.course)?.name??'Main',records:player.jumpLog.records},now);
    if(!replayViewer.replay&&player.position[2]<-12000)reset();
  }
  const replayPose=replayViewer.update((now-lastFrame)/1000);
  if(replayPose){const p:V=[replayPose[1],replayPose[2],replayPose[3]+replayPose[4]];camera.position.copy(sourceToRender(p));const y=replayPose[5]*Math.PI/180,a=replayPose[6]*Math.PI/180;camera.lookAt(camera.position.clone().add(sourceToRender([Math.cos(y)*Math.cos(a),Math.sin(y)*Math.cos(a),-Math.sin(a)])));}
  lastFrame=now;renderer.render(scene,camera);
}
requestAnimationFrame(frame);


