type LockTarget={requestPointerLock(options?:{unadjustedMovement?:boolean}):Promise<void>|void};

/** Pointer lock must start before fullscreen consumes the click's activation.
 * Settle mouse errors immediately while fullscreen/keyboard permission resolves.
 */
export function requestPlayCapture(target:LockTarget,requestFullscreen?:()=>Promise<void>){
  const mouse=lockMouse(target).then(mode=>({ok:true as const,mode}),error=>({ok:false as const,error}));
  let fullscreen:Promise<void>;
  try{fullscreen=Promise.resolve(requestFullscreen?.()).catch(()=>{});}catch{fullscreen=Promise.resolve();}
  return {mouse,fullscreen};
}

/** Prefer OS-unadjusted relative mouse input; retry only unsupported raw mode.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
 * Older implementations may ignore options, so report the request, not a guarantee.
 */
export async function lockMouse(target:LockTarget):Promise<'RAW REQUESTED'|'STANDARD'> {
  try{
    await target.requestPointerLock({unadjustedMovement:true});
    return 'RAW REQUESTED';
  }catch(error){
    if(!(error instanceof Error)||error.name!=='NotSupportedError')throw error;
    await target.requestPointerLock();
    return 'STANDARD';
  }
}
