export const HUD_STORAGE='ckz-hud-v1';
export const elementNames={speed:'Speed',prespeed:'Prespeed',keys:'Movement keys',timer:'Timer',checkpoint:'Checkpoints',course:'Map / course',indicators:'Jump indicator',jumps:'Jump report'};
export type ElementName=keyof typeof elementNames;
export interface ElementPrefs {enabled:boolean;x:number;y:number;size:number;scale:number;font:string;outline:boolean;opacity:number;color:string;background:number;border:boolean}
export interface HudPrefs {
  enabled:boolean;stats:boolean;mode:boolean;gridSnap:boolean;elements:Record<ElementName,ElementPrefs>;
  speedDecimals:boolean;speedBar:boolean;speedUnits:boolean;prespeedDecimals:boolean;prespeedBorder:string;prespeedShow:string;
  prespeedPerfColorEnabled:boolean;prespeedPerfColor:string;
  prespeedJumpbugColorEnabled:boolean;prespeedJumpbugColor:string;
  keysIdle:string;keysLetters:boolean;keysSquare:boolean;keysBorder:boolean;keysGlow:boolean;keysFill:boolean;keysOverlap:boolean;keysCount:boolean;keyColor:string;
  timerDetailed:boolean;timerState:boolean;timerTeleports:boolean;courseMap:boolean;
  jumpCompact:boolean;jumpHistory:boolean;jumpDuration:number;jumpTierColors:boolean;jumpSounds:boolean;jumpSoundVolume:number;
  crosshair:{enabled:boolean;color:string;opacity:number;length:number;thickness:number;gap:number;dot:boolean;outline:boolean;tStyle:boolean};
}
export function defaultHud():HudPrefs {
  const element=(enabled:boolean,x:number,y:number,size:number):ElementPrefs=>({enabled,x,y,size,scale:100,font:'Verdana',outline:true,opacity:100,color:'#ffffff',background:0,border:false});
  return {enabled:true,stats:false,mode:false,gridSnap:true,elements:{speed:element(true,50,74,48),prespeed:element(true,50,82,20),keys:element(false,50,66,15),timer:element(true,50,92,18),checkpoint:element(false,88,8,12),course:element(false,88,16,12),indicators:element(false,50,58,14),jumps:element(false,22,86,11)},
    speedDecimals:false,speedBar:false,speedUnits:false,prespeedDecimals:false,prespeedBorder:'parentheses',prespeedShow:'brief',keysIdle:'show',keysLetters:true,keysSquare:false,keysBorder:true,keysGlow:false,keysFill:true,keysOverlap:true,keysCount:false,keyColor:'#ffffff',timerDetailed:true,timerState:true,timerTeleports:true,courseMap:true,jumpCompact:false,jumpHistory:false,jumpDuration:8,
    prespeedPerfColorEnabled:true,prespeedPerfColor:'#8ee6ac',jumpTierColors:true,jumpSounds:false,jumpSoundVolume:35,
    prespeedJumpbugColorEnabled:true,prespeedJumpbugColor:'#ff9f43',
    crosshair:{enabled:true,color:'#00ff00',opacity:90,length:6,thickness:1,gap:3,dot:false,outline:false,tStyle:false}};
}
export function prespeedColor(p:HudPrefs,perf:string,jumpbug=false){
  if(jumpbug&&p.prespeedJumpbugColorEnabled)return p.prespeedJumpbugColor;
  return p.prespeedPerfColorEnabled&&perf==='PERF'?p.prespeedPerfColor:p.elements.prespeed.color;
}
export function snapHudPosition(value:number,snap:boolean){return Math.min(95,Math.max(5,snap?Math.round(value/2)*2:Math.round(value*10)/10));}
// Whitelist stored fields and bound layout values; corrupt or older settings never leak into CSS.
export function normalizeHud(raw:unknown):HudPrefs {
  const defaults=defaultHud();
  const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
  const obj=record(raw);
  const read=(fallback:unknown,v:unknown,key:string):any=>{
    if(typeof fallback==='boolean')return typeof v==='boolean'?v:fallback;
    if(typeof fallback==='number'){const bounds:Record<string,[number,number]>={x:[5,95],y:[5,95],size:[8,80],scale:[50,200],opacity:[0,100],background:[0,100],jumpDuration:[1,30],length:[1,30],thickness:[1,8],gap:[0,20]};const [min,max]=bounds[key]??[0,100];return typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;}
    const choices:Record<string,string[]>={font:['Arial','Verdana','Tahoma','Courier New'],prespeedBorder:['none','parentheses','brackets'],prespeedShow:['brief','air','always'],keysIdle:['show','hide','underscore']};
    if(choices[key])return typeof v==='string'&&choices[key].includes(v)?v:fallback;
    return typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v:fallback;
  };
  const merge=(fallback:Record<string,any>,input:Record<string,unknown>)=>Object.fromEntries(Object.entries(fallback).map(([key,val])=>[key,read(val,input[key],key)]));
  const result=merge(defaults as unknown as Record<string,any>,obj) as unknown as HudPrefs;
  result.elements=Object.fromEntries(Object.entries(defaults.elements).map(([key,val])=>[key,merge(val,record(record(obj.elements)[key]))])) as HudPrefs['elements'];
  result.crosshair=merge(defaults.crosshair,record(obj.crosshair)) as HudPrefs['crosshair'];
  return result;
}
export function loadHud():HudPrefs {try{return normalizeHud(JSON.parse(localStorage.getItem(HUD_STORAGE)??'null'));}catch{return defaultHud();}}
export function saveHud(prefs:HudPrefs){try{localStorage.setItem(HUD_STORAGE,JSON.stringify(prefs));}catch{/* Session preferences still work when storage is blocked. */}}
