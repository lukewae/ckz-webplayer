import type {InputEvent} from './physics/clock';
export function jumpbugEvents(time:number,pressed:boolean):InputEvent[]{
  return pressed?[{time,key:'jump',value:true},{time,key:'duck',value:false},{time,key:'forward',value:false}]:[{time,key:'jump',value:false}];
}
/** Every event uses the real input time. No ground sensing or delayed jump. */
export class JumpbugWheel {
  armed=false;
  reset(){this.armed=false;}
  scroll(time:number):InputEvent[]{
    if(!this.armed){this.armed=true;return [{time,key:'duck',value:true}];}
    return [{time,key:'duck',value:false},{time,pulse:true}];
  }
}
