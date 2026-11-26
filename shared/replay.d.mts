export interface Replay {version:1;hz:64|128;movement?:{mode:"vnl";timing:"64"|"128"|"64x128";airAccelerate:number};physics:string;map:string;course:string;mapHash:string;collisionHash:string;duration:number;preRoll?:number;frames:number[][]}
export const REPLAY_VERSION:number;
export const REPLAY_PHYSICS:string;
export const MAX_REPLAY_SECONDS:number;
export const MAX_REPLAY_BYTES:number;
export function validateReplay(value:unknown):Replay;
