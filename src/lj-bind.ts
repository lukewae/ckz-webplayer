import type {InputEvent} from './physics/clock';
/** Exact alias edges: release does not restore W/S or add timing/velocity. */
export function longJumpEvents(time:number,pressed:boolean):InputEvent[]{
  return [
    {time,key:'duck',value:pressed},{time,key:'jump',value:pressed},
    ...(pressed?[{time,key:'forward' as const,value:false},{time,key:'back' as const,value:false}]:[]),
  ];
}
export const validLjKey=(key:string)=>key==='None'||/^Mouse[23]$/.test(key)||key==='Space'||/^Key[BFGHIJKLOQTUVXYZ]$/.test(key)||/^F([1-9]|1[0-2])$/.test(key);
