import {jumpTiers,type JumpTier} from './jump-tiers';
export class JumpSound {
  private context?:AudioContext;private master?:GainNode;private buffers=new Map<JumpTier,Promise<AudioBuffer|undefined>>();private voice?:AudioBufferSourceNode;private generation=0;
  private enabled=false;private volume=35;
  private previewVoice?:HTMLAudioElement;
  preview(tier:JumpTier,volume:number){this.previewVoice?.pause();const audio=new Audio(`/audio/jumpstats/${tier}.mp3`);audio.volume=Math.max(0,Math.min(1,volume/100));this.previewVoice=audio;void audio.play().catch(()=>{});}
  configure(enabled:boolean,volume:number){this.enabled=enabled;this.volume=Math.max(0,Math.min(100,volume));if(this.master&&this.context)this.master.gain.setTargetAtTime(enabled?this.volume/100:0,this.context.currentTime,.01);if(!enabled||!this.volume){this.generation++;this.stop();}else if(this.context)this.preload();}
  unlock(){if(!this.enabled||!this.volume)return;try{this.context??=new AudioContext();if(!this.master){this.master=this.context.createGain();this.master.gain.value=this.volume/100;this.master.connect(this.context.destination);}void this.context.resume().catch(()=>{});this.preload();}catch{/* Audio may be unavailable. */}}
  private preload(){for(const tier of jumpTiers)this.buffer(tier.key);}
  private buffer(tier:JumpTier){if(!this.buffers.has(tier)){const context=this.context;this.buffers.set(tier,fetch(`/audio/jumpstats/${tier}.mp3`).then(r=>{if(!r.ok)throw Error('Announcer unavailable');return r.arrayBuffer();}).then(b=>context!.decodeAudioData(b)).catch(()=>undefined));}return this.buffers.get(tier)!;}
  play(tier:JumpTier){if(!this.enabled||!this.volume)return;this.unlock();const context=this.context;if(!context)return;const generation=++this.generation;void this.buffer(tier).then(buffer=>{if(!buffer||generation!==this.generation||!this.enabled||!this.volume||context.state!=='running')return;this.stop();const source=context.createBufferSource();source.buffer=buffer;source.connect(this.master!);this.voice=source;source.onended=()=>{source.disconnect();if(this.voice===source)this.voice=undefined;};source.start();});}
  stop(){if(this.voice){this.voice.stop();this.voice=undefined;}this.previewVoice?.pause();this.previewVoice=undefined;}
}
