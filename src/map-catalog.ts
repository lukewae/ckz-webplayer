import {mapAssetUrl} from './map-assets';
// Demo order: Phamous first, then ascending runtime download size.
// Main-course TP tiers and Workshop credits; see docs/MAP-CARDS.md for sources.
export const maps=[
  {id:'3104579274',name:'kz_phamous',assets:mapAssetUrl('/maps/3104579274'),author:'Phinx',port:'GameChaos',tier:1,vnlTier:1},
  {id:'3551310998',name:'kz_kiwiexultation',assets:mapAssetUrl('/maps/3551310998'),author:'Kiwi',port:'',tier:7,vnlTier:7},
  {id:'3801640043',name:'kz_slide_dydanhomon2',assets:mapAssetUrl('/maps'),author:'dydka',port:'Reeed & 涅普姬雅',tier:5,vnlTier:10},
  {id:'3366047597',name:'kz_faded',assets:mapAssetUrl('/maps/3366047597'),author:'leetly',port:'',tier:3,vnlTier:4},
] as const;
export const tierNames=['Very easy','Easy','Medium','Advanced','Hard','Very hard','Extreme','Death','Unfeasible','Impossible'] as const;
export let selectedMap=maps.find(map=>map.id===new URLSearchParams(location.search).get('map'))??maps[0];
export function selectMap(id:string,push=true){
  const map=maps.find(map=>map.id===id);if(!map||id===selectedMap.id)return false;
  selectedMap=map;
  if(push){const url=new URL(location.href);url.searchParams.set('map',id);url.searchParams.delete('replay');history.pushState(null,'',url.href);}
  return true;
}
