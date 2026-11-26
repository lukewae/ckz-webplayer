export type ActionCue='checkpoint'|'teleport'|'reset'|'noclip'|'finish';
export interface SoundPrefs {enabled:boolean;volume:number;checkpoint:boolean;teleport:boolean;reset:boolean;noclip:boolean;finish:boolean}
export const SOUND_STORAGE='ckz-action-audio-v1';
export const defaultSounds=():SoundPrefs=>({enabled:true,volume:25,checkpoint:true,teleport:true,reset:true,noclip:true,finish:true});
export function normalizeSounds(raw:unknown):SoundPrefs {
  const result=defaultSounds(),p=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  for(const key of ['enabled','checkpoint','teleport','reset','noclip','finish'] as const)if(typeof p[key]==='boolean')result[key]=p[key];
  if(typeof p.volume==='number'&&Number.isFinite(p.volume))result.volume=Math.max(0,Math.min(100,p.volume));
  return result;
}
export function loadSounds():SoundPrefs {try{return normalizeSounds(JSON.parse(localStorage.getItem(SOUND_STORAGE)??'null'));}catch{return defaultSounds();}}
export function saveSounds(p:SoundPrefs){try{localStorage.setItem(SOUND_STORAGE,JSON.stringify(p));}catch{}}
const tones:Record<ActionCue,number[]>={checkpoint:[1800],teleport:[1000],reset:[520,390,260],noclip:[220,330],finish:[523.25,659.25,783.99,1046.5]};
/** Short, faded UI cues. No gameplay state or map pickup audio is involved. */
export class ActionSound {
  private context?:AudioContext;private master?:GainNode;private last=-Infinity;
  private voices=new Map<OscillatorNode,ActionCue>();
  constructor(public prefs=loadSounds(),private createContext=()=>new AudioContext()){}
  unlock(){
    if(!this.prefs.enabled||!this.prefs.volume)return;
    try{if(!this.context){this.context=this.createContext();this.master=this.context.createGain();this.master.gain.value=this.prefs.volume/100;this.master.connect(this.context.destination);}void this.context.resume().catch(()=>{});}catch{/* Audio support or permission can be unavailable. */}
  }
  configure(prefs:SoundPrefs){this.prefs=normalizeSounds(prefs);saveSounds(this.prefs);if(this.context&&this.master)this.master.gain.setTargetAtTime(this.prefs.enabled?this.prefs.volume/100:0,this.context.currentTime,.01);for(const [voice,cue] of this.voices)if(!this.prefs.enabled||!this.prefs[cue]||!this.prefs.volume)voice.stop();}
  play(cue:ActionCue){
    const p=this.prefs;if(!p.enabled||!p[cue]||!p.volume)return;
    this.unlock();const ctx=this.context;if(!ctx)return;if(ctx.state!=='running'){void ctx.resume().then(()=>{if(ctx.state==='running')this.play(cue);}).catch(()=>{});return;}if(cue!=='finish'&&ctx.currentTime-this.last<.09)return;this.last=ctx.currentTime;
    for(const [i,frequency] of tones[cue].entries()){
      const tick=cue==='checkpoint'||cue==='teleport',duration=tick?.028:cue==='finish'?(i===3?.48:.32):.08;
      const source=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*(cue==='finish'?.085:.055);source.type=tick?'triangle':'sine';source.frequency.value=frequency;
      if(tick){source.frequency.setValueAtTime(frequency,at);source.frequency.exponentialRampToValueAtTime(frequency/6,at+.018);}
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(cue==='finish'?.055:.065,at+(tick?.001:cue==='finish'?.012:.008));gain.gain.exponentialRampToValueAtTime(.0001,at+duration-.003);
      source.connect(gain);gain.connect(this.master!);this.voices.set(source,cue);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(source);};source.start(at);source.stop(at+duration);
    }
  }
}
export function addSoundSettings(container:HTMLElement,sound:ActionSound){
  const p=sound.prefs;
  container.insertAdjacentHTML('beforeend',`<details id="sound-options"><summary>Sound effects</summary><div class="sound-fields"><label><span>Enable sounds</span><input data-sound="enabled" type="checkbox" ${p.enabled?'checked':''}></label><label><span>Volume</span><input data-sound="volume" type="range" min="0" max="100" value="${p.volume}"><output>${p.volume}%</output></label>${(['checkpoint','teleport','reset','noclip','finish'] as ActionCue[]).map(cue=>`<label><span>${{checkpoint:'Checkpoint saved',teleport:'Checkpoint teleport / undo',reset:'Reset / restart',noclip:'Enter noclip',finish:'Run finished'}[cue]}</span><input data-sound="${cue}" type="checkbox" ${p[cue]?'checked':''}><button type="button" data-preview-sound="${cue}" aria-label="Preview ${cue} sound">Test</button></label>`).join('')}</div><small>Quiet local cues · map pickup audio is separate.</small></details>`);
  const panel=container.querySelector<HTMLElement>('#sound-options')!;
  panel.addEventListener('input',e=>{const input=e.target as HTMLInputElement,key=input.dataset.sound as keyof SoundPrefs;if(!key)return;const prefs={...sound.prefs,[key]:key==='volume'?Number(input.value):input.checked};sound.configure(prefs);panel.querySelector('output')!.value=`${sound.prefs.volume}%`;});
  panel.addEventListener('click',e=>{const cue=(e.target as HTMLElement).closest<HTMLElement>('[data-preview-sound]')?.dataset.previewSound as ActionCue|undefined;if(cue)sound.play(cue);});
}
