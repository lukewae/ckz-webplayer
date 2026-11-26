/** One-shot pickup audio, unlocked by the Enter/Resume gesture. */
export class KeySound {
  private context?:AudioContext;
  private buffer?:AudioBuffer;
  private loading?:Promise<void>;
  private sources=new Set<AudioBufferSourceNode>();
  constructor(private url:string,private delay:number){}
  unlock(){
    this.context??=new AudioContext();
    void this.context.resume().catch(()=>{});
    this.loading??=fetch(this.url).then(r=>{if(!r.ok)throw Error('Key sound missing');return r.arrayBuffer();})
      .then(b=>this.context!.decodeAudioData(b)).then(b=>{this.buffer=b;}).catch(e=>console.warn('Key audio unavailable',e));
  }
  play(){
    if(!this.buffer||this.context?.state!=='running')return;
    const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.context.destination);
    this.sources.add(source);source.onended=()=>{source.disconnect();this.sources.delete(source);};
    source.start(this.context.currentTime+this.delay);
  }
  stop(){for(const s of this.sources)s.stop();this.sources.clear();}
  dispose(){this.stop();void this.context?.close().catch(()=>{});this.context=undefined;this.buffer=undefined;}
}
