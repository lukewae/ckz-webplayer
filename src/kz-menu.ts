export type KzAction='checkpoint'|'teleport'|'previous'|'next'|'undo'|'pause'|'restart'|'noclip'|'jumpstats'|'clear'|'collision'|'settings'|'hud';
export class KzMenu {
  visible=true;options=false;private signature='';
  element:HTMLElement;clock:HTMLElement;
  constructor(root:HTMLElement,public action:(action:KzAction)=>void,private mode='CKZ'){
    this.element=document.createElement('aside');this.element.id='kz-menu';this.element.hidden=true;this.element.setAttribute('aria-label','KZ advanced menu');root.append(this.element);
    this.clock=document.createElement('div');this.clock.id='run-clock';this.clock.hidden=true;root.append(this.clock);
    this.element.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');if(button)this.key(`Digit${button.dataset.key}`);});
  }
  key(code:string){
    if(code==='KeyM'){this.visible=!this.visible;return true;}
    if(!this.visible||!/^Digit[0-9]$/.test(code))return false;
    const key=Number(code.slice(-1));
    if(key===0){if(this.options)this.options=false;else this.visible=false;return true;}
    if(!this.options&&key===8){this.options=true;return true;}
    const action=this.options?({1:'jumpstats',2:'clear',3:'collision',4:'settings',5:'hud'} as const)[key as 1]:({1:'checkpoint',2:'teleport',3:'previous',4:'next',5:'undo',6:'pause',7:'restart',9:'noclip'} as const)[key as 1];
    if(action)this.action(action);return true;
  }
  update(active:boolean,debug:boolean,paused:boolean,count:number,selected:number,teleports:number,state:string,elapsed:number,practice:boolean,jumpstats:boolean){
    this.element.hidden=!active||debug||!this.visible;this.clock.hidden=!active;
    const minutes=Math.floor(elapsed/60),seconds=(elapsed%60).toFixed(3).padStart(6,'0');
    this.clock.textContent=`${minutes}:${seconds}  ·  ${paused?'PAUSED':state.toUpperCase()}${practice?' · PRACTICE':''}  ·  ${teleports} TP`;
    const ms=Math.max(0,Math.floor(elapsed*1000)),hours=Math.floor(ms/3600000),menuTime=`${hours?`${hours}h `:''}${Math.floor(ms/60000)%60}m ${Math.floor(ms/1000)%60}s ${ms%1000}ms`;
    const signature=[this.options,count,selected,paused,jumpstats,teleports].join(':');
    if(signature!==this.signature){this.signature=signature;
      const items=this.options?[[1,`Jump stats: ${jumpstats?'On':'Off'}`],[2,'Clear checkpoints'],[3,'Collision overlay'],[4,'Mouse settings'],[5,'HUD options'],[0,'Back']]:[[1,`Checkpoint #${count}`],[2,`Teleport #${teleports}`],[3,'Prev CP'],[4,'Next CP'],[5,'Undo TP'],[6,paused?'Resume':'Pause'],[7,'Restart'],[8,'Options'],[9,'Noclip'],[0,'Exit']];
      this.element.innerHTML=`<div class="kz-menu-heading"><span>${this.mode}${this.options?' · Options':''}</span><strong class="kz-menu-time"></strong></div>${items.map(([key,label])=>`<button type="button" data-key="${key}"${key===0?' class="kz-menu-exit"':''}><span>${key}.</span> ${label}</button>`).join('')}`;
    }
    this.element.querySelector('.kz-menu-time')!.textContent=menuTime;
  }
}
