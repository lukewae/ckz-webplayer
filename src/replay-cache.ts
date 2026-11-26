import type {Replay} from './replay';
/** Separate from small leaderboard metadata: replays exceed localStorage quotas. */
async function access<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  return new Promise((resolve,reject)=>{const open=indexedDB.open('ckz-replays-v1',1);open.onupgradeneeded=()=>open.result.createObjectStore('pending');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('pending',mode),request=action(tx.objectStore('pending'));tx.oncomplete=()=>{db.close();resolve(request.result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};};});
}
export const cacheReplay=(id:string,replay:Replay)=>access('readwrite',s=>s.put(replay,id));
export const readReplay=(id:string)=>access<Replay|undefined>('readonly',s=>s.get(id));
export const removeReplay=(id:string)=>access('readwrite',s=>s.delete(id));
