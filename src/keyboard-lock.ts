// Captured Escape opens menus; the browser retains its hold-Escape fullscreen exit gesture.
export const GAME_KEYS=['KeyW','KeyA','KeyS','KeyD','KeyC','KeyR','KeyN','KeyM','KeyP','Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight','F2','Tab','Escape'];
export type KeyboardCapture={lock(keys:string[]):Promise<void>;unlock():void};
export const keyboardCapture=()=> (navigator as Navigator&{keyboard?:KeyboardCapture}).keyboard;
export async function captureGameKeys(fullscreen:boolean,keyboard:KeyboardCapture|undefined):Promise<boolean>{
  if(!fullscreen||!keyboard)return false;
  try{await keyboard.lock(GAME_KEYS);return true;}catch{return false;}
}
