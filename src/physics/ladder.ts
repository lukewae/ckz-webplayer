import {type V, add, sub, mul, dot, cross, unit} from './math';

// Source view basis, including pitch. Keep each held axis at full climb speed:
// normalizing the sum would remove the diagonal fast-ladder technique.
export function ladderWish(yawDegrees:number,pitchDegrees:number,forward:number,right:number):V {
  const yaw=yawDegrees*Math.PI/180,pitch=pitchDegrees*Math.PI/180;
  return mul([
    Math.cos(pitch)*Math.cos(yaw)*forward+Math.sin(yaw)*right,
    Math.cos(pitch)*Math.sin(yaw)*forward-Math.cos(yaw)*right,
    -Math.sin(pitch)*forward,
  ],200);
}

/** Map inward intent to ladder-up, retaining view-up and sideways intent.
 * CKZ sets ladder scale and lateral dampening to 1; no extra boost/cap is needed.
 * Behavioral reference: Source SDK LadderMove; native CS2 transitions unverified.
 */
export function ladderVelocity(wish:V,normal:V,onFloor:boolean,vanilla=false):V {
  const inward=dot(wish,normal);
  const up=cross(normal,unit(cross([0,0,1],normal)));
  let tangent=sub(wish,mul(normal,inward));
  if(vanilla){
    const side=unit(cross([0,0,1],normal)),lateral=dot(tangent,side);
    if(dot(unit(add(mul(side,lateral),mul(normal,inward))),normal)<-.707)tangent=add(mul(up,dot(tangent,up)),mul(side,lateral*.2));
  }
  return add(mul(sub(tangent,mul(up,inward)),vanilla?.78:1),mul(normal,onFloor&&inward>0?200:0));
}
