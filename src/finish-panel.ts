import {formatRunTime,formatDelta,type RunResult} from './run-results';
export class FinishPanel {
  readonly dialog:HTMLDialogElement;
  version=0;
  onLeaderboard?:(course:string,category:'Pro'|'TP')=>void;
  onReplay?:()=>void;
  private nameResolve?: (name:string|null)=>void;
  constructor(root:HTMLElement,private onClose:()=>void){
    this.dialog=document.createElement('dialog');this.dialog.id='finish-results';this.dialog.setAttribute('aria-labelledby','finish-title');
    this.dialog.innerHTML='<div class="finish-heading"><span id="finish-course"></span><button id="finish-close" type="button" aria-label="Close results">×</button></div><div class="finish-hero"><span class="finish-mark" aria-hidden="true">✓</span><h2 id="finish-title">Run complete</h2><strong id="finish-time"></strong><span id="finish-tps"></span></div><div class="finish-best"><strong id="finish-best-label"></strong><span id="finish-delta"></span></div><p id="finish-reference"></p><details class="finish-splits"><summary>Split times <span></span></summary><table><thead><tr><th>Checkpoint / split</th><th>Time</th><th>vs PB</th></tr></thead><tbody></tbody></table></details><form id="finish-name" hidden><label for="finish-name-input">What should we call you?</label><p>Your name on times and replays, for this tab session.</p><div class="finish-name-controls"><input id="finish-name-input" name="name" maxlength="24" autocomplete="nickname" placeholder="Player name" required><button type="submit">Save name</button><button type="button" id="finish-name-skip">Stay guest</button></div><span id="finish-name-error" role="status"></span></form><p id="finish-submission" role="status" hidden></p><div class="finish-footer"><button id="finish-leaderboard" type="button">Leaderboard</button><button id="finish-replay" type="button" hidden>Watch your run</button><button id="finish-done" type="button">Back to menu</button></div><span class="finish-hint">Esc to close</span>';
    root.append(this.dialog);
    this.dialog.querySelector('#finish-close')!.addEventListener('click',()=>this.close());this.dialog.querySelector('#finish-done')!.addEventListener('click',()=>this.close());
    this.dialog.querySelector('#finish-replay')!.addEventListener('click',()=>{this.close();this.onReplay?.();});
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.dialog.querySelector('#finish-name')!.addEventListener('submit',e=>{e.preventDefault();const name=this.dialog.querySelector<HTMLInputElement>('#finish-name-input')!.value.trim().replace(/\s+/g,' ');if(!name||Array.from(name).length>24||/[\p{Cc}\p{Cf}]/u.test(name)){this.dialog.querySelector('#finish-name-error')!.textContent='Use 1–24 visible characters.';return;}this.resolveName(name);});
    this.dialog.querySelector('#finish-name-skip')!.addEventListener('click',()=>this.resolveName(null));
  }
  get open(){return this.dialog.open;}
  private resolveName(name:string|null){const resolve=this.nameResolve;this.nameResolve=undefined;this.dialog.querySelector<HTMLElement>('#finish-name')!.hidden=true;if(resolve&&this.open)this.dialog.querySelector<HTMLButtonElement>('#finish-leaderboard')!.focus({preventScroll:true});resolve?.(name);}
  close(){if(this.open){this.resolveName(null);this.dialog.close();this.onClose();}}
  requestName():Promise<string|null>{if(!this.open)return Promise.resolve(null);this.resolveName(null);this.dialog.querySelector<HTMLElement>('#finish-name')!.hidden=false;this.dialog.querySelector('#finish-name-error')!.textContent='';const input=this.dialog.querySelector<HTMLInputElement>('#finish-name-input')!;input.value='';input.focus({preventScroll:true});return new Promise(resolve=>{this.nameResolve=resolve;});}
  replayAvailable(available:boolean){this.dialog.querySelector<HTMLButtonElement>('#finish-replay')!.hidden=!available;}
  submission(message:string,version=this.version){if(version===this.version){const status=this.dialog.querySelector<HTMLElement>('#finish-submission')!;status.textContent=message;status.hidden=!message;}}
  show(result:RunResult,map:string,course:string,_hasZones:boolean){
    this.resolveName(null);this.version++;this.submission('');this.replayAvailable(false);
    this.dialog.dataset.best=String(result.newBest);
    this.dialog.querySelector<HTMLButtonElement>('#finish-leaderboard')!.onclick=()=>{this.close();this.onLeaderboard?.(result.course,result.category);};
    const text=(id:string,value:string)=>{this.dialog.querySelector('#'+id)!.textContent=value;};
    text('finish-course',`${map}${/^main(course)?$/i.test(course)?'':` · ${course}`}`);
    text('finish-title',result.practice?'Practice complete':'Run complete');text('finish-time',formatRunTime(result.time));text('finish-tps',`${result.category}${result.teleports?` · ${result.teleports} ${result.teleports===1?'teleport':'teleports'}`:' · No teleports'}`);
    text('finish-best-label',result.practice?'Practice run':result.newBest?(result.previous?'New personal best':'First finish saved'):'vs your personal best');
    const delta=this.dialog.querySelector<HTMLElement>('#finish-delta')!,difference=result.previous&&!result.practice?result.time-result.previous.time:null;
    delta.hidden=difference===null;delta.textContent=difference===null?'':formatDelta(difference);delta.dataset.trend=difference===null?'none':difference<0?'ahead':difference>0?'behind':'equal';
    const reference=result.practice?'Practice runs do not update your PB.':result.previous?`Previous best ${formatRunTime(result.previous.time)}`:'';
    text('finish-reference',reference);this.dialog.querySelector<HTMLElement>('#finish-reference')!.hidden=!reference;
    const body=this.dialog.querySelector('tbody')!;body.replaceChildren();
    for(const split of result.splits){const row=document.createElement('tr'),pb=result.previous?.splits.find(s=>s.key===split.key),diff=pb?split.time-pb.time:null;
      for(const value of [split.label,formatRunTime(split.time),diff===null?'—':formatDelta(diff)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      (row.lastElementChild as HTMLElement).dataset.trend=diff===null?'none':diff<0?'ahead':diff>0?'behind':'equal';body.append(row);
    }
    const splits=this.dialog.querySelector<HTMLDetailsElement>('.finish-splits')!;splits.hidden=!result.splits.length;splits.open=false;splits.querySelector('summary span')!.textContent=String(result.splits.length);
    if(!this.open)this.dialog.showModal();this.dialog.querySelector<HTMLButtonElement>('#finish-leaderboard')!.focus({preventScroll:true});
  }
}
