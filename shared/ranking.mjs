export const VNL_RANKED_PHYSICS='csgo-vnl-v6-64-aa12';
export function rankedMode(physics){
  if(physics===VNL_RANKED_PHYSICS||['csgo-vnl-v1-64-aa12','csgo-vnl-v2-64-aa12','csgo-vnl-v3-64-aa12','csgo-vnl-v4-64-aa12','csgo-vnl-v5-64-aa12'].includes(physics))return 'vnl';
  if(physics===undefined||['ckz-browser-2026-10-11','ckz-browser-2026-10-12-slopes','ckz-browser-2026-10-12-takeoff','ckz-browser-2026-10-12-contact','ckz-browser-2026-10-13-duck','ckz-browser-2026-10-13-ladder','ckz-browser-2026-10-17-landing','ckz-browser-2026-11-27-ground-crop'].includes(physics))return 'ckz';
  return null;
}
