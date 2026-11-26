import {prespeedColor,defaultHud,elementNames,loadHud,normalizeHud,saveHud,snapHudPosition,type ElementName,type ElementPrefs,type HudPrefs} from './hud-settings';
import type {Input} from './physics/movement';
import type {FlatJump} from './physics/jump-log';
import {jumpRating,jumpKinds,jumpTiers,type JumpTier} from './jump-tiers';
import {formatJumpStats} from './jump-report';

export interface HudSnapshot {mode?:'ckz'|'vnl';speed:number;prespeed:number;jumps:number;grounded:boolean;perf:string;jumpbug?:boolean;input:Readonly<Input>;active:boolean;state:string;elapsed:number;practice:boolean;teleports:number;checkpoints:number;selected:number;map:string;course:string;records:readonly FlatJump[]}
type Nodes=Record<ElementName,HTMLElement>;
const crosshairMarkup='<i class="ch-left"></i><i class="ch-right"></i><i class="ch-top"></i><i class="ch-bottom"></i><i class="ch-dot"></i>';
const sample:HudSnapshot={speed:278.4,prespeed:274.2,jumps:3,grounded:false,perf:'PERF',input:{forward:false,back:false,left:true,right:false,jump:true,duck:false,walk:false,yaw:0,pitch:0},active:true,state:'running',elapsed:84.562,practice:false,teleports:0,checkpoints:2,selected:1,map:'kz_divert',course:'Main',records:[]};
export class Hud {
  onJumpSoundPreview?:(tier:JumpTier)=>void;
  onJumpSoundSettings?:(enabled:boolean,volume:number)=>void;
  prefs=loadHud();private nodes:Nodes;private previewNodes:Nodes;private dialog:HTMLDialogElement;private crosshair:HTMLElement;private previewCrosshair:HTMLElement;
  private seenJumps=0;private jumpAt=-Infinity;private reportSignature='';private reportAt=-Infinity;private snapshot:HudSnapshot|undefined;
  private selectedElement:ElementName='speed';
  private previewObserver?:ResizeObserver;
  private stopPreviewDrag=()=>{};
  constructor(root:HTMLElement,clock:HTMLElement,private presentation?:{host:HTMLElement;onOpen:()=>void}){
    const layer=document.createElement('div');layer.id='movement-hud';root.append(layer);
    this.nodes={} as Nodes;
    for(const key of Object.keys(elementNames) as ElementName[]){
      const existing=key==='speed'?root.querySelector<HTMLElement>('.speed'):key==='timer'?clock:key==='jumps'?root.querySelector<HTMLElement>('#jump-readout'):null;
      const node=existing??document.createElement('div');node.classList.add('hud-element',`hud-${key}`);node.dataset.hudElement=key;layer.append(node);this.nodes[key]=node;
    }
    this.nodes.keys.innerHTML=this.keysMarkup();
    this.crosshair=root.querySelector<HTMLElement>('#crosshair')!;this.crosshair.innerHTML=crosshairMarkup;
    this.dialog=document.createElement('dialog');this.dialog.id='hud-options';this.dialog.setAttribute('aria-labelledby','hud-title');(presentation?.host??root).append(this.dialog);
    this.dialog.addEventListener('close',()=>{this.stopPreviewDrag();root.querySelector<HTMLButtonElement>('#hud-open')?.focus();});
    this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.dialog.close();});
    this.buildSettings();this.previewNodes={} as Nodes;this.previewCrosshair=this.dialog.querySelector('.hud-preview-crosshair')!;
    this.buildPreview();this.apply();
    window.addEventListener('resize',()=>{if(this.dialog.open)this.renderPreview();});
  }
  open(){this.presentation?.onOpen();if(!this.dialog.open){if(this.presentation)this.dialog.show();else this.dialog.showModal();}this.renderPreview();this.selectElement(this.selectedElement);}
  private keysMarkup(){return ['forward','left','back','right','jump','duck','walk'].map(key=>`<span data-hud-key="${key}"><span class="hud-key-label"></span></span>`).join('')+'<small class="hud-jump-count"></small>';}
  private control(path:string,label:string,type='checkbox',options?:string[],min=0,max=100,step=1){
    const value=path.split('.').reduce((obj:any,key)=>obj[key],this.prefs);
    const input=type==='select'?`<select data-pref="${path}">${options!.map(o=>`<option value="${o}" ${value===o?'selected':''}>${o}</option>`).join('')}</select>`:`<input data-pref="${path}" type="${type}" ${type==='checkbox'?(value?'checked':''):`value="${value}"`} ${type==='range'?`min="${min}" max="${max}" step="${step}"`:''}>${type==='range'?`<output>${value}</output>`:''}`;
    return `<label class="hud-control ${type==='checkbox'?'hud-toggle':''}"><span>${label}</span>${input}</label>`;
  }
  private buildSettings(){
    this.stopPreviewDrag();
    const c=this.control.bind(this),toggle=(p:string,l:string)=>c(p,l),range=(p:string,l:string,min:number,max:number)=>c(p,l,'range',undefined,min,max,/\.(x|y)$/.test(p)?.1:1);
    const extra:Partial<Record<ElementName,string>>={
      speed:toggle('speedDecimals','Show decimal')+toggle('speedBar','Speed bar')+toggle('speedUnits','Units label'),
      prespeed:toggle('prespeedDecimals','Show decimal')+toggle('prespeedPerfColorEnabled','Color perfect bhops')+c('prespeedPerfColor','Perfect bhop color','color')+toggle('prespeedJumpbugColorEnabled','Color jumpbugs')+c('prespeedJumpbugColor','Jumpbug color','color')+c('prespeedShow','Show prespeed','select',['brief','air','always'])+c('prespeedBorder','Number surround','select',['none','parentheses','brackets']),
      keys:c('keysIdle','Unpressed keys','select',['show','hide','underscore'])+toggle('keysLetters','WASD letters (off = arrows)')+toggle('keysSquare','Square keys')+toggle('keysBorder','Key borders')+toggle('keysGlow','Pressed key glow')+toggle('keysFill','Pressed key fill')+toggle('keysOverlap','Highlight opposing keys')+toggle('keysCount','Show jump count')+c('keyColor','Pressed key color','color'),
      timer:toggle('timerDetailed','Milliseconds')+toggle('timerState','Run state / practice')+toggle('timerTeleports','Teleport count'),
      course:toggle('courseMap','Show map name'),
      jumps:toggle('jumpCompact','Compact report')+toggle('jumpHistory','Recent jump history')+range('jumpDuration','Report duration (seconds)',1,30)+toggle('jumpTierColors','Jump tier colours')+toggle('jumpSounds','Quake announcements')+range('jumpSoundVolume','Announcement volume (%)',0,100)+`<div class="jump-sound-previews" role="group" aria-label="Preview jump announcements">${jumpTiers.map(t=>`<button type="button" data-jump-sound="${t.key}" style="color:${t.color}">${t.label}</button>`).join('')}</div>`,
    };
    this.dialog.innerHTML=`<div class="hud-dialog-heading"><div><h2 id="hud-title">HUD options</h2><p>Saved automatically · preview below</p></div><button type="button" id="hud-close" aria-label="Close HUD options">✕</button></div><div class="hud-preview-tools"><label>Element <select id="hud-edit-element">${(Object.keys(elementNames) as ElementName[]).map(key=>`<option value="${key}">${elementNames[key]}</option>`).join('' )}</select></label><label class="hud-editor-toggle"><input id="hud-edit-enabled" type="checkbox">Show</label><label class="hud-editor-toggle"><input data-pref="gridSnap" type="checkbox" ${this.prefs.gridSnap?'checked':''}>Snap to grid</label><button type="button" id="hud-scale-down" aria-label="Scale selected HUD element down">−</button><output id="hud-edit-scale"></output><button type="button" id="hud-scale-up" aria-label="Scale selected HUD element up">+</button></div><div class="hud-editor-body"><div class="hud-editor-canvas"><p class="hud-edit-hint">Drag to move · corner to resize · scroll to scale · Alt to skip snapping</p><div class="hud-preview" aria-label="HUD sample preview"><span class="preview-label">SAMPLE PREVIEW</span><div class="hud-preview-crosshair">${crosshairMarkup}</div></div></div><div class="hud-settings-scroll"><div class="hud-general">${toggle('enabled','Movement HUD')}${toggle('stats','Extra movement readouts')}${toggle('mode','Classic mode label')}</div>${(Object.keys(elementNames) as ElementName[]).map(key=>{
      const p=`elements.${key}`;return `<details class="hud-section" data-element-options="${key}"><summary>${elementNames[key]}</summary><div class="hud-fields">${toggle(`${p}.enabled`,'Enabled')}${extra[key]??''}${c(`${p}.font`,'Font','select',['Arial','Verdana','Tahoma','Courier New'])}${range(`${p}.size`,'Text size (px)',8,80)}${range(`${p}.scale`,'Element scale (%)',50,200)}${toggle(`${p}.outline`,'Text outline')}${c(`${p}.color`,'Text color','color')}${range(`${p}.opacity`,'Opacity (%)',0,100)}${range(`${p}.background`,'Black background (%)',0,100)}${toggle(`${p}.border`,'Panel border')}${range(`${p}.x`,'Horizontal position (%)',5,95)}${range(`${p}.y`,'Vertical position (%)',5,95)}</div></details>`;
    }).join('')}<details class="hud-section"><summary>Static crosshair</summary><div class="hud-fields">${toggle('crosshair.enabled','Enabled')}${c('crosshair.color','Color','color')}${range('crosshair.opacity','Opacity (%)',0,100)}${range('crosshair.length','Arm length (px)',1,30)}${range('crosshair.thickness','Thickness (px)',1,8)}${range('crosshair.gap','Center gap (px)',0,20)}${toggle('crosshair.dot','Center dot')}${toggle('crosshair.outline','Black outline')}${toggle('crosshair.tStyle','T shape')}</div></details><p class="hud-help">Prespeed: brief = 1.5 seconds after takeoff; air = until landing. Jump reports use recorded flat-ground jumps. Recording stays in Debug / KZ options.</p><button type="button" id="hud-reset">Reset HUD & crosshair</button></div></div>`;
    this.dialog.querySelector<HTMLButtonElement>('#hud-close')!.onclick=()=>this.dialog.close();
    this.dialog.querySelector<HTMLButtonElement>('#hud-reset')!.onclick=()=>{this.prefs=defaultHud();saveHud(this.prefs);this.buildSettings();this.buildPreview();this.apply();this.selectElement(this.selectedElement);};
    this.dialog.querySelector<HTMLSelectElement>('#hud-edit-element')!.onchange=e=>this.selectElement((e.target as HTMLSelectElement).value as ElementName);
    this.dialog.querySelector<HTMLInputElement>('#hud-edit-enabled')!.onchange=e=>this.editElement(this.selectedElement,{enabled:(e.target as HTMLInputElement).checked});
    for(const section of Array.from(this.dialog.querySelectorAll<HTMLDetailsElement>('[data-element-options]')))section.addEventListener('toggle',()=>{if(section.open)this.selectElement(section.dataset.elementOptions as ElementName);});
    this.dialog.querySelector<HTMLButtonElement>('#hud-scale-down')!.onclick=()=>this.scaleElement(this.selectedElement,-5);
    this.dialog.querySelector<HTMLButtonElement>('#hud-scale-up')!.onclick=()=>this.scaleElement(this.selectedElement,5);
    this.dialog.addEventListener('input',this.onInput);
    this.dialog.querySelector('.jump-sound-previews')!.addEventListener('click',e=>{const tier=(e.target as HTMLElement).closest<HTMLElement>('[data-jump-sound]')?.dataset.jumpSound as JumpTier|undefined;if(tier)this.onJumpSoundPreview?.(tier);});
  }
  private onInput=(event:Event)=>{
    const input=event.target as HTMLInputElement;if(!input.dataset.pref)return;
    const raw=structuredClone(this.prefs),parts=input.dataset.pref.split('.');let parent:any=raw;for(const part of parts.slice(0,-1))parent=parent[part];
    parent[parts.at(-1)!]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
    this.prefs=normalizeHud(raw);saveHud(this.prefs);if(input.type==='range')input.parentElement!.querySelector('output')!.value=input.value;this.apply();this.syncEditor();
  };
  private buildPreview(){
    this.previewObserver?.disconnect();
    const preview=this.dialog.querySelector('.hud-preview')!;this.previewNodes={} as Nodes;
    for(const key of Object.keys(elementNames) as ElementName[]){const node=document.createElement('div');node.className=`hud-element hud-${key}`;node.dataset.hudElement=key;node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',`Move or scale ${elementNames[key]}`);if(key==='speed')node.innerHTML='<strong>278</strong><span>UNITS / SEC</span><div class="speed-track"><i></i></div>';if(key==='keys')node.innerHTML=this.keysMarkup();preview.append(node);this.previewNodes[key]=node;}
    this.previewCrosshair=this.dialog.querySelector('.hud-preview-crosshair')!;
    this.bindPreview(preview as HTMLElement);this.syncEditor();
    this.previewObserver=new ResizeObserver(()=>{if(this.dialog.open)this.renderPreview();});this.previewObserver.observe(preview);
  }
  private selectElement(key:ElementName){
    this.selectedElement=key;
    const section=this.dialog.querySelector<HTMLDetailsElement>(`[data-element-options="${key}"]`)!;
    const reveal=!section.open;
    for(const other of Array.from(this.dialog.querySelectorAll<HTMLDetailsElement>('.hud-section')))other.open=other===section;
    this.syncEditor();
    if(reveal){const scroll=this.dialog.querySelector<HTMLElement>('.hud-settings-scroll')!;scroll.scrollTop=section.offsetTop-scroll.offsetTop;}
  }
  private syncEditor(){
    this.dialog.querySelector<HTMLSelectElement>('#hud-edit-element')!.value=this.selectedElement;
    this.dialog.querySelector<HTMLInputElement>('#hud-edit-enabled')!.checked=this.prefs.elements[this.selectedElement].enabled;
    this.dialog.querySelector<HTMLOutputElement>('#hud-edit-scale')!.value=`${this.prefs.elements[this.selectedElement].scale}%`;
    for(const key of Object.keys(elementNames) as ElementName[])this.previewNodes[key]?.classList.toggle('hud-selected',key===this.selectedElement);
    this.syncResizeFrame();
  }
  private syncResizeFrame(){
    const preview=this.dialog.querySelector<HTMLElement>('.hud-preview')!,frame=preview.querySelector<HTMLElement>('.hud-resize-frame'),node=this.previewNodes[this.selectedElement];if(!frame||!node)return;
    frame.hidden=node.hidden;const rect=node.getBoundingClientRect(),area=preview.getBoundingClientRect();
    frame.style.cssText=`left:${rect.left-area.left-preview.clientLeft+rect.width/2}px;top:${rect.top-area.top-preview.clientTop+rect.height/2}px;width:${Math.max(18,rect.width)}px;height:${Math.max(18,rect.height)}px;`;
  }
  private editElement(key:ElementName,change:Partial<ElementPrefs>){
    const raw=structuredClone(this.prefs);Object.assign(raw.elements[key],change);this.prefs=normalizeHud(raw);saveHud(this.prefs);
    // Keep the detailed controls synchronized without rebuilding the dialog during a drag.
    for(const field of Object.keys(change) as (keyof ElementPrefs)[]){const input=this.dialog.querySelector<HTMLInputElement>(`[data-pref="elements.${key}.${field}"]`);if(input){if(input.type==='checkbox')input.checked=Boolean(this.prefs.elements[key][field]);else input.value=String(this.prefs.elements[key][field]);const output=input.parentElement!.querySelector('output');if(output)output.value=input.value;}}
    this.apply();this.syncEditor();
  }
  private scaleElement(key:ElementName,delta:number){this.selectElement(key);this.editElement(key,{scale:this.prefs.elements[key].scale+delta});}
  private bindPreview(preview:HTMLElement){
    let drag:{key:ElementName;pointer:number;clientX:number;clientY:number;x:number;y:number;resize?:{scale:number;width:number;height:number;anchorX:number;anchorY:number;sx:number;sy:number;vx:number;vy:number}}|undefined;
    preview.insertAdjacentHTML('beforeend',`<div class="hud-resize-frame">${['nw','ne','sw','se'].map(c=>`<button type="button" data-resize="${c}" aria-label="Resize selected element from ${c} corner"></button>`).join('')}</div>`);
    this.stopPreviewDrag=()=>{const pointer=drag?.pointer;drag=undefined;preview.classList.remove('hud-dragging');if(pointer!==undefined&&preview.hasPointerCapture(pointer))preview.releasePointerCapture(pointer);};
    const hit=(event:MouseEvent):ElementName|undefined=>{
      const direct=(event.target as HTMLElement).closest<HTMLElement>('[data-hud-element]')?.dataset.hudElement as ElementName|undefined;
      if(direct)return direct;
      // Small preview text gets a forgiving hit area without changing its displayed size.
      let nearest:ElementName|undefined,distance=12;
      for(const key of Object.keys(elementNames) as ElementName[]){const node=this.previewNodes[key];if(node.hidden)continue;const r=node.getBoundingClientRect(),dx=Math.max(r.left-event.clientX,0,event.clientX-r.right),dy=Math.max(r.top-event.clientY,0,event.clientY-r.bottom),d=Math.hypot(dx,dy);if(d<distance){distance=d;nearest=key;}}
      return nearest;
    };
    preview.addEventListener('pointerdown',e=>{
      if(e.button!==0||drag)return;const corner=(e.target as HTMLElement).closest<HTMLElement>('[data-resize]')?.dataset.resize;
      const key=corner?this.selectedElement:hit(e);if(!key)return;e.preventDefault();this.selectElement(key);const p=this.prefs.elements[key];drag={key,pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,x:p.x,y:p.y};
      if(corner){const r=this.previewNodes[key].getBoundingClientRect(),sx=corner.endsWith('w')?-1:1,sy=corner.startsWith('n')?-1:1,anchorX=r.x+r.width/2-sx*r.width/2,anchorY=r.y+r.height/2-sy*r.height/2;drag.resize={scale:p.scale,width:r.width,height:r.height,anchorX,anchorY,sx,sy,vx:e.clientX-anchorX,vy:e.clientY-anchorY};}
      preview.setPointerCapture(e.pointerId);preview.classList.add('hud-dragging');
    });
    preview.addEventListener('pointermove',e=>{
      if(!drag||drag.pointer!==e.pointerId)return;const rect=preview.getBoundingClientRect(),r=drag.resize;
      if(r){const factor=((e.clientX-r.anchorX)*r.vx+(e.clientY-r.anchorY)*r.vy)/Math.max(1,r.vx*r.vx+r.vy*r.vy),scale=Math.max(50,Math.min(200,this.prefs.gridSnap&&!e.altKey?Math.round(r.scale*factor/5)*5:Math.round(r.scale*factor))),ratio=scale/r.scale;
        this.editElement(drag.key,{scale,x:Math.round((r.anchorX+r.sx*r.width*ratio/2-rect.left-preview.clientLeft)/preview.clientWidth*1000)/10,y:Math.round((r.anchorY+r.sy*r.height*ratio/2-rect.top-preview.clientTop)/preview.clientHeight*1000)/10});
      }else this.editElement(drag.key,{x:snapHudPosition(drag.x+(e.clientX-drag.clientX)/preview.clientWidth*100,this.prefs.gridSnap&&!e.altKey),y:snapHudPosition(drag.y+(e.clientY-drag.clientY)/preview.clientHeight*100,this.prefs.gridSnap&&!e.altKey)});
    });
    const finish=(e:PointerEvent)=>{if(drag?.pointer===e.pointerId)this.stopPreviewDrag();};
    preview.addEventListener('pointerup',finish);preview.addEventListener('pointercancel',finish);preview.addEventListener('lostpointercapture',()=>{drag=undefined;preview.classList.remove('hud-dragging');});
    preview.addEventListener('wheel',e=>{const key=hit(e);if(!key||!e.deltaY)return;e.preventDefault();this.scaleElement(key,e.deltaY<0?5:-5);},{passive:false});
    preview.addEventListener('keydown',e=>{
      const key=(e.target as HTMLElement).dataset.hudElement as ElementName|undefined;if(!key)return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();this.selectElement(key);return;}
      const direction:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(direction[e.key]){e.preventDefault();e.stopPropagation();this.selectElement(key);const p=this.prefs.elements[key],d=direction[e.key],step=e.shiftKey?10:this.prefs.gridSnap&&!e.altKey?2:1;this.editElement(key,{x:snapHudPosition(p.x+d[0]*step,this.prefs.gridSnap&&!e.altKey),y:snapHudPosition(p.y+d[1]*step,this.prefs.gridSnap&&!e.altKey)});}
      else if(['+','=','-'].includes(e.key)){e.preventDefault();e.stopPropagation();this.scaleElement(key,e.key==='-'?-5:5);}
    });
  }
  private style(node:HTMLElement,p:ElementPrefs,preview=false){
    const scale=preview?this.dialog.querySelector<HTMLElement>('.hud-preview')!.clientHeight/window.innerHeight:1;
    const stroke=node.classList.contains('hud-timer')||node.classList.contains('hud-jumps')||node.classList.contains('hud-indicators');
    node.style.cssText=`left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%) scale(${p.scale/100});font-family:"${p.font}",sans-serif;font-size:${p.size*scale}px;color:${p.color};opacity:${p.opacity/100};background:rgba(0,0,0,${p.background/100});border:${p.border?'1px solid #ffffff55':'0'};text-shadow:${p.outline&&!stroke?`${-scale}px ${-scale}px 0 #000,${scale}px ${-scale}px 0 #000,${-scale}px ${scale}px 0 #000,${scale}px ${scale}px 0 #000`:'none'};-webkit-text-stroke:${p.outline&&stroke?scale:0}px #000;paint-order:stroke fill;`;
  }
  private drawCrosshair(node:HTMLElement){const p=this.prefs.crosshair;node.hidden=!p.enabled;node.style.cssText=`--ch-color:${p.color};--ch-length:${p.length}px;--ch-thickness:${p.thickness}px;--ch-gap:${p.gap}px;opacity:${p.opacity/100};`;node.classList.toggle('ch-outline',p.outline);node.querySelector<HTMLElement>('.ch-dot')!.hidden=!p.dot;node.querySelector<HTMLElement>('.ch-top')!.hidden=p.tStyle;}
  private apply(){
    this.onJumpSoundSettings?.(this.prefs.jumpSounds,this.prefs.jumpSoundVolume);
    for(const key of Object.keys(elementNames) as ElementName[])this.style(this.nodes[key],this.prefs.elements[key]);
    this.drawCrosshair(this.crosshair);if(this.snapshot)this.draw(this.nodes,this.snapshot,false);this.renderPreview();
  }
  update(snapshot:HudSnapshot,now:number){
    if(snapshot.jumps!==this.seenJumps){this.seenJumps=snapshot.jumps;this.jumpAt=snapshot.jumps?now:-Infinity;}
    const signature=snapshot.records.map(j=>`${j.id}:${j.distance}`).join('|');if(signature!==this.reportSignature){this.reportSignature=signature;this.reportAt=snapshot.records.length?now:-Infinity;}
    this.snapshot=snapshot;this.draw(this.nodes,snapshot,false,now);
  }
  private draw(nodes:Nodes,s:HudSnapshot,preview:boolean,now=performance.now()){
    const p=this.prefs;
    for(const key of Object.keys(elementNames) as ElementName[])nodes[key].hidden=!p.enabled||!p.elements[key].enabled||(!preview&&['timer','checkpoint','course','keys','indicators'].includes(key)&&!s.active);
    nodes.speed.querySelector('strong')!.textContent=s.speed.toFixed(p.speedDecimals?1:0);nodes.speed.querySelector<HTMLElement>('span')!.hidden=!p.speedUnits;const bar=nodes.speed.querySelector<HTMLElement>('.speed-track')!;bar.hidden=!p.speedBar;bar.querySelector<HTMLElement>('i')!.style.width=`${Math.min(100,s.speed/5)}%`;
    const pre=s.prespeed.toFixed(p.prespeedDecimals?1:0),surround=p.prespeedBorder;nodes.prespeed.textContent=surround==='parentheses'?`(${pre})`:surround==='brackets'?`[${pre}]`:pre;
    nodes.prespeed.style.color=prespeedColor(p,s.perf,s.jumpbug);
    if(!preview&&(p.prespeedShow!=='always'&&s.jumps===0||p.prespeedShow==='brief'&&now-this.jumpAt>1500||p.prespeedShow==='air'&&s.grounded))nodes.prespeed.hidden=true;
    const labels:Record<string,string>={forward:p.keysLetters?'W':'↑',left:p.keysLetters?'A':'←',back:p.keysLetters?'S':'↓',right:p.keysLetters?'D':'→',jump:'JUMP',duck:'DUCK',walk:'WALK'};
    for(const cell of Array.from(nodes.keys.querySelectorAll<HTMLElement>('[data-hud-key]'))){
      const key=cell.dataset.hudKey as keyof Input,down=Boolean(s.input[key]);cell.querySelector<HTMLElement>('.hud-key-label')!.textContent=!down&&p.keysIdle==='underscore'?'_':labels[key];cell.style.visibility=!down&&p.keysIdle==='hide'?'hidden':'visible';cell.classList.toggle('pressed',down);cell.classList.toggle('overlap',p.keysOverlap&&down&&(key==='forward'&&s.input.back||key==='back'&&s.input.forward||key==='left'&&s.input.right||key==='right'&&s.input.left));
    }
    nodes.keys.style.setProperty('--pressed-color',p.keyColor);nodes.keys.classList.toggle('keys-outline',p.elements.keys.outline);nodes.keys.classList.toggle('keys-square',p.keysSquare);nodes.keys.classList.toggle('keys-border',p.keysBorder);nodes.keys.classList.toggle('keys-glow',p.keysGlow);nodes.keys.classList.toggle('keys-fill',p.keysFill);const count=nodes.keys.querySelector<HTMLElement>('.hud-jump-count')!;count.hidden=!p.keysCount;count.textContent=`${s.jumps} jumps`;
    const time=p.timerDetailed?Math.floor(s.elapsed*1000)/1000:Math.floor(s.elapsed),seconds=(time%60).toFixed(p.timerDetailed?3:0).padStart(p.timerDetailed?6:2,'0');nodes.timer.textContent=`${Math.floor(time/60)}:${seconds}${p.timerState?` · ${s.state.toUpperCase()}${s.practice?' · PRACTICE':''}`:''}${p.timerTeleports?` · ${s.teleports} TP`:''}`;
    nodes.checkpoint.textContent=`CP ${s.checkpoints?s.selected+1:0} / ${s.checkpoints} · ${s.teleports} TP`;nodes.course.textContent=p.courseMap?`${s.map}\n${s.course}`:s.course;nodes.indicators.textContent=s.perf;
    if(!preview&&s.perf==='—')nodes.indicators.hidden=true;
    const reports=preview?[{id:0,distance:284.32,takeoffSpeed:274.2,maxSpeed:379.8,strafes:10,maxHeight:57.2,airLoss:0,contactLoss:0,diagnostics:{sync:95.9}}]:s.records.slice(p.jumpHistory?-4:-1).reverse(),kinds=jumpKinds(s.records);
    const reportKey=[s.mode,p.jumpCompact,p.jumpTierColors,...reports.map(j=>[j.id,j.distance,j.takeoffSpeed,j.maxSpeed,j.strafes,j.maxHeight,j.airLoss,j.contactLoss,j.diagnostics?.sync,kinds.get(j.id)].join(":"))].join("|"); if(nodes.jumps.dataset.reportKey!==reportKey){nodes.jumps.dataset.reportKey=reportKey;nodes.jumps.replaceChildren();for(const j of reports){const tier=jumpRating(j.distance,s.mode??'ckz',kinds.get(j.id)??'lj'),report=document.createElement('div');report.className='hud-jump-entry';const heading=document.createElement('span');heading.className='hud-jump-heading';if(p.jumpTierColors&&tier)heading.style.color=tier.color;heading.textContent=p.jumpCompact?`${j.distance.toFixed(2)} u${tier?` · ${tier.label}`:''}`:`FLAT JUMP ${j.distance.toFixed(2)} units${tier?` · ${tier.label.toUpperCase()}`:''}`;report.append(heading);{const detail=document.createElement('span');detail.textContent=`\n${formatJumpStats(j,p.jumpCompact)}`;report.append(detail);}nodes.jumps.append(report);}}
    if(!preview&&(!reports.length||now-this.reportAt>p.jumpDuration*1000))nodes.jumps.hidden=true;
    if(!preview){document.querySelector<HTMLElement>('footer .stats')!.hidden=!p.enabled||!p.stats;document.querySelector<HTMLElement>('footer .mode')!.hidden=!p.enabled||!p.mode;}
  }
  private renderPreview(){if(!this.previewNodes)return;this.dialog.querySelector('.hud-preview')!.classList.toggle('hud-grid',this.prefs.gridSnap);for(const key of Object.keys(elementNames) as ElementName[])this.style(this.previewNodes[key],this.prefs.elements[key],true);this.draw(this.previewNodes,sample,true);this.drawCrosshair(this.previewCrosshair);this.syncResizeFrame();}
}
