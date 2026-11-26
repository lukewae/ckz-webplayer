import {validLjKey} from './lj-bind';
export interface ConsolePrefs {sensitivity:number;m_yaw:number;m_pitch:number;consoleKey:string;ljKey:string;jbKey:string;jbWheel:boolean}
export const consoleDefaults:ConsolePrefs={sensitivity:1.5,m_yaw:.022,m_pitch:.022,consoleKey:'Backquote',ljKey:'Mouse2',jbKey:'None',jbWheel:false};
export const validConsoleKey=(key:string)=>/^(Backquote|Backslash|BracketLeft|BracketRight|F([1-9]|1[0-2])|Key[A-Z]|Digit[0-9]|Insert|Home|End|Delete)$/.test(key);
export const mouseRanges={sensitivity:[0,20],m_yaw:[-.5,.5],m_pitch:[-.5,.5]} as const;
export function normalizeConsolePrefs(raw:unknown):ConsolePrefs {
  const p={...consoleDefaults};if(!raw||typeof raw!=='object')return p;
  const r=raw as Record<string,unknown>;
  for(const name of Object.keys(mouseRanges) as (keyof typeof mouseRanges)[]){const v=r[name],range=mouseRanges[name];if(typeof v==='number'&&Number.isFinite(v)&&v>=range[0]&&v<=range[1])p[name]=v;}
  if(typeof r.consoleKey==='string'&&validConsoleKey(r.consoleKey))p.consoleKey=r.consoleKey;
  if(typeof r.ljKey==='string'&&validLjKey(r.ljKey)&&r.ljKey!==p.consoleKey)p.ljKey=r.ljKey;
  if(typeof r.jbKey==='string'&&validLjKey(r.jbKey)&&r.jbKey!==p.consoleKey&&(r.jbKey==='None'||r.jbKey!==p.ljKey))p.jbKey=r.jbKey;
  if(typeof r.jbWheel==='boolean')p.jbWheel=r.jbWheel;
  return p;
}
/** Deliberately one command per line: no eval, aliases, script execution or command chaining. */
export function parseCommand(line:string){const [name='',...args]=line.trim().split(/\s+/);return {name:name.toLowerCase(),args};}
type Command={help:string;run:(args:string[])=>string|void};
export class DeveloperConsole {
  prefs:ConsolePrefs;commands=new Map<string,Command>();opened=false;
  private panel:HTMLElement;private output:HTMLElement;private input:HTMLInputElement;
  private history:string[]=[];private cursor=0;private draft='';private binding:false|'console'|'lj'|'jb'=false;
  onPrefs=()=>{};
  constructor(root:HTMLElement,private onOpen:()=>void){
    try{this.prefs=normalizeConsolePrefs(JSON.parse(localStorage.getItem('ckz-console-v1')??'null'));}catch{this.prefs={...consoleDefaults};}
    this.panel=document.createElement('section');this.panel.id='developer-console';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','Developer console');
    this.panel.innerHTML='<div class="console-title"><strong>CKZ · Developer console</strong><button type="button" aria-label="Close console">×</button></div><div class="console-output" role="log" aria-label="Console output"></div><form><span aria-hidden="true">]</span><input aria-label="Console command" autocomplete="off" spellcheck="false" placeholder="Type help for commands"><button type="submit">Submit</button></form><small>↑ ↓ History · Tab Complete · Esc Close · Closing leaves the game paused</small>';
    root.append(this.panel);this.output=this.panel.querySelector('.console-output')!;this.input=this.panel.querySelector('input')!;
    this.panel.querySelector('button')!.onclick=()=>this.close();
    this.panel.querySelector('form')!.onsubmit=e=>{e.preventDefault();const line=this.input.value.trim();if(!line)return;this.input.value='';this.history.push(line);if(this.history.length>100)this.history.shift();this.cursor=this.history.length;this.draft='';this.execute(line);};
    this.input.onkeydown=e=>{
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();if(this.cursor===this.history.length)this.draft=this.input.value;this.cursor=Math.max(0,Math.min(this.history.length,this.cursor+(e.key==='ArrowUp'?-1:1)));this.input.value=this.history[this.cursor]??this.draft;}
      if(e.key==='Tab'){e.preventDefault();const names=[...this.commands.keys()].filter(n=>n.startsWith(this.input.value.trim().toLowerCase()));if(names.length===1)this.input.value=names[0]+' ';else if(names.length)this.print(names.join('  '));}
    };
    window.addEventListener('keydown',e=>{
      if(this.binding){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){this.binding=false;this.onPrefs();return;}if(this.setBinding(this.binding,e.code)){this.binding=false;this.save();}return;}
      const target=e.target as HTMLElement,editing=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target.isContentEditable;
      if(e.code===this.prefs.consoleKey&&(!editing||this.opened)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)this.opened?this.close():this.open();return;}
      if(this.opened&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}
    },true);
    window.addEventListener('mousedown',e=>{if(!this.binding||this.binding==='console'||![1,2].includes(e.button))return;e.preventDefault();e.stopImmediatePropagation();if(this.setBinding(this.binding,`Mouse${e.button===2?2:3}`)){this.binding=false;this.save();}},true);
    for(const action of ['lj','jb'] as const)this.add(`bind_${action}`,'[Mouse2 / Mouse3 / key code / None] Assign action',args=>{if(args.length){if(args.length!==1||!this.setBinding(action,args[0]))throw Error('Choose an available key, Mouse2, Mouse3, or None; bindings cannot overlap.');this.save();}return `bind_${action} ${this.prefs[action==='lj'?'ljKey':'jbKey']}`;});
    this.add('jb_wheel','[0/1] Wheel up: duck first, then unduck+jump; W resets',args=>{if(args.length){if(args.length!==1||!['0','1'].includes(args[0]))throw Error('Use jb_wheel 0 or 1.');this.prefs.jbWheel=args[0]==='1';this.save();}return `jb_wheel ${Number(this.prefs.jbWheel)}`;});
    this.add('help','List available commands',()=>[...this.commands].map(([n,c])=>`${n.padEnd(20)} ${c.help}`).join('\n'));
    this.add('clear','Clear console output',()=>{this.output.replaceChildren();});
    this.add('bind_console','[KeyboardEvent code] e.g. Backquote, F2, Backslash',args=>{if(!args.length)return `bind_console ${this.prefs.consoleKey}`;if(args.length!==1||(!validConsoleKey(args[0])||args[0]===this.prefs.ljKey||args[0]===this.prefs.jbKey))throw Error('Use a key code such as Backquote, F2 or Backslash.');this.prefs.consoleKey=args[0];this.save();return `Console key: ${args[0]}`;});
    for(const name of Object.keys(mouseRanges) as (keyof typeof mouseRanges)[])this.add(name,`[value] range ${mouseRanges[name].join(' to ')}`,args=>{
      if(args.length){const n=Number(args[0]),[lo,hi]=mouseRanges[name];if(args.length!==1||!Number.isFinite(n)||n<lo||n>hi)throw Error(`${name}: enter a number from ${lo} to ${hi}.`);this.prefs[name]=n;this.save();}return `${name} ${this.prefs[name]}`;
    });
    this.print('CKZ console ready. Type help. Mouse settings and console key save automatically.\nEvery recorded jump prints its full stats and strafe breakdown here.');
  }
  add(name:string,help:string,run:Command['run']){this.commands.set(name,{help,run});}
  execute(line:string){this.print('] '+line);const {name,args}=parseCommand(line);const command=this.commands.get(name);if(!command){this.print(`Unknown command: ${name}. Type help.`,'error');return;}try{const result=command.run(args);if(result)this.print(result);}catch(e){this.print(e instanceof Error?e.message:String(e),'error');}}
  print(text:string,kind=''){const atBottom=this.output.scrollHeight-this.output.scrollTop-this.output.clientHeight<24;const row=document.createElement('pre');row.textContent=text;row.className=kind;this.output.append(row);while(this.output.children.length>400)this.output.firstElementChild!.remove();if(atBottom)this.output.scrollTop=this.output.scrollHeight;}
  open(){this.onOpen();this.opened=true;this.panel.hidden=false;this.input.focus();this.output.scrollTop=this.output.scrollHeight;}
  close(){this.opened=false;this.panel.hidden=true;this.input.blur();}
  private setBinding(action:'console'|'lj'|'jb',code:string){
    const field=action==='console'?'consoleKey':action==='lj'?'ljKey':'jbKey';
    if(!(action==='console'?validConsoleKey(code):validLjKey(code)))return false;
    if(code!=='None'&&(['consoleKey','ljKey','jbKey'] as const).some(k=>k!==field&&this.prefs[k]===code))return false;
    this.prefs[field]=code;return true;
  }
  captureBinding(action:'console'|'lj'|'jb'='console'){this.binding=action;}
  save(){try{localStorage.setItem('ckz-console-v1',JSON.stringify(this.prefs));}catch{}this.onPrefs();}
}
