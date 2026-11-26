type LockTarget={requestPointerLock(options?:{unadjustedMovement?:boolean}):Promise<void>|void};

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
