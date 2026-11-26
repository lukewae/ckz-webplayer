import {sampleReplay,type Replay} from './replay';
import {formatRunTime} from './run-results';
export class ReplayViewer {
  replay?:Replay;time=0;playing=false;rate=1;private panel:HTMLElement;private seek:HTMLInputElement;private toggle:HTMLButtonElement;
  constructor(root:HTMLElement,private exit:()=>void){
    this.panel=document.createElement('section');this.panel.id='replay-viewer';this.panel.hidden=true;this.panel.setAttribute('aria-label','Replay player');
    this.panel.innerHTML='<div class="replay-heading"><div class="replay-title"><span>REPLAY</span><strong></strong><small></small></div><button data-action="exit">Exit replay <span aria-hidden="true">×</span></button></div><div class="replay-timeline"><span class="replay-elapsed"></span><input type="range" min="0" value="0" step="0.0078125" aria-label="Replay timeline"><span class="replay-duration"></span></div><div class="replay-controls"><div class="replay-transport"><button data-action="play">Pause</button><button data-action="restart" title="Restart from the beginning">Restart</button></div><div class="replay-frames" role="group" aria-label="Frame stepping"><button data-action="back" aria-label="Previous replay frame" title="Pause and go back one frame">−1 frame</button><button data-action="next" aria-label="Next replay frame" title="Pause and advance one frame">+1 frame</button></div><label class="replay-rate">Playback <select aria-label="Replay speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div><div class="replay-info"><span class="replay-velocity"></span><span class="replay-state"></span><span class="replay-keys" aria-label="Recorded inputs"></span></div>';
    root.append(this.panel);this.seek=this.panel.querySelector('input')!;this.toggle=this.panel.querySelector('[data-action="play"]')!;
    this.seek.oninput=()=>{this.time=Number(this.seek.value);this.playing=false;this.update(0);};
    this.panel.querySelector('select')!.onchange=e=>{this.rate=Number((e.target as HTMLSelectElement).value);};
    this.panel.addEventListener('click',e=>{const action=(e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.action;if(action==='exit'){this.close();return;}if(action==='play'){if(this.replay&&this.time>=this.replay.duration)this.time=-(this.replay.preRoll??0);this.playing=!this.playing;}if(action==='restart'){this.time=-(this.replay?.preRoll??0);this.playing=true;}if(action==='back'||action==='next'){this.playing=false;this.time+=(action==='next'?1:-1)/(this.replay?.hz??128);}this.update(0);});
    window.addEventListener('keydown',e=>{if(!this.replay)return;if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}else if(e.code==='Space'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLSelectElement)){e.preventDefault();e.stopImmediatePropagation();this.playing=!this.playing;}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.playing=false;});
  }
  open(replay:Replay,name:string){this.replay=replay;this.time=-(replay.preRoll??0);this.playing=true;this.rate=1;this.panel.querySelector('select')!.value='1';this.panel.querySelector('.replay-title strong')!.textContent=name;this.panel.querySelector('.replay-title small')!.textContent=/^main(course)?$/i.test(replay.course)?'Main course':replay.course;this.panel.querySelector('.replay-duration')!.textContent=formatRunTime(replay.duration);this.seek.min=String(-(replay.preRoll??0));this.seek.max=String(replay.duration);this.seek.step=String(1/replay.hz);this.panel.hidden=false;document.body.classList.add('replay-active');this.update(0);this.toggle.focus();}
  close(){if(!this.replay)return;this.replay=undefined;this.playing=false;this.panel.hidden=true;document.body.classList.remove('replay-active');this.exit();}
  update(dt:number){
    const r=this.replay;if(!r)return;
    if(this.playing)this.time+=Math.max(0,Math.min(dt,.1))*this.rate;
    this.time=Math.max(-(r.preRoll??0),Math.min(this.time,r.duration));if(this.time===r.duration)this.playing=false;
    const f=sampleReplay(r,this.time);this.seek.value=String(this.time);this.toggle.textContent=this.playing?'Pause':'Play';
    this.panel.querySelector('.replay-elapsed')!.textContent=this.time<0?`−${formatRunTime(-this.time)}`:formatRunTime(this.time);
    const keys=['W','S','A','D','DUCK','JUMP','WALK'].filter((_,i)=>f[10]&(1<<i));
    this.panel.querySelector('.replay-velocity')!.textContent=`${Math.hypot(f[7],f[8]).toFixed(1)} u/s`;
    this.panel.querySelector('.replay-state')!.textContent=this.time<0?'Prestart':f[12]?'Ground':'Air';
    const inputs=this.panel.querySelector('.replay-keys')!;const label=keys.join(' ');if(inputs.getAttribute('data-keys')!==label){inputs.setAttribute('data-keys',label);inputs.replaceChildren();for(const key of keys){const k=document.createElement('kbd');k.textContent=key;inputs.append(k);}}
    return f;
  }
}
