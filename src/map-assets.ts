// Set at release build time; includes a unique release path for safe immutable caching.
const base=(import.meta.env?.VITE_MAP_BASE_URL??'').replace(/\/$/,'');
export function mapAssetUrl(path:string){return path.startsWith('/maps/')||path==='/maps'?base+path:path;}
