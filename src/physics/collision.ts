import { type V, add, sub, mul, dot, cross, unit, len } from './math';
export interface Trace { fraction: number; end: V; normal: V; startSolid: boolean }
export interface Collider { trace(start: V,end: V,height: number,radius?:number): Trace }
type Bounds = { min: V; max: V };
type Tri = Bounds & { a: V; b: V; c: V; axes: V[] };
type Node = Bounds & { left?: Node; right?: Node; triangles?: Tri[] };
const BASIS: V[] = [[1,0,0],[0,1,0],[0,0,1]];
const EPS = 0.03125;
const overlaps = (a: Bounds,b: Bounds) => a.min.every((v,i)=>v<=b.max[i] && a.max[i]>=b.min[i]);
function bounds(items: Bounds[]): Bounds {
  const min: V=[Infinity,Infinity,Infinity], max: V=[-Infinity,-Infinity,-Infinity];
  for(const t of items) for(let i=0;i<3;i++){min[i]=Math.min(min[i],t.min[i]);max[i]=Math.max(max[i],t.max[i]);}
  return {min,max};
}
function build(ts: Tri[]): Node {
  const b=bounds(ts);
  if(ts.length<=12)return {...b,triangles:ts};
  const size=sub(b.max,b.min), axis=size.indexOf(Math.max(...size));
  ts.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));
  const half=ts.length>>1;
  return {...b,left:build(ts.slice(0,half)),right:build(ts.slice(half))};
}
/** Continuous SAT: translate a Source AABB against native physics triangles.
 * This is a surface query, not Valve's closed-volume Rubikon trace. */
export class TriangleWorld implements Collider {
  root: Node; triangleCount=0; queries=0;
  constructor(vertices: ArrayLike<number>) {
    const tris: Tri[]=[];
    for(let i=0;i<vertices.length;i+=9){
      const a: V=[vertices[i],vertices[i+1],vertices[i+2]], b: V=[vertices[i+3],vertices[i+4],vertices[i+5]], c: V=[vertices[i+6],vertices[i+7],vertices[i+8]];
      const edges=[sub(b,a),sub(c,b),sub(a,c)], n=unit(cross(edges[0],sub(c,a)));
      if(len(n)<0.5)continue;
      const axes=[n,...BASIS];
      for(const e of edges)for(const axis of BASIS){const v=unit(cross(e,axis));if(len(v)>0.5&&!axes.some(n=>Math.abs(dot(n,v))>0.999999))axes.push(v);}
      tris.push({a,b,c,axes,min:[0,1,2].map(j=>Math.min(a[j],b[j],c[j])) as V,max:[0,1,2].map(j=>Math.max(a[j],b[j],c[j])) as V});
    }
    this.triangleCount=tris.length;this.root=build(tris);
  }
  trace(start: V,end: V,height: number,radius=16): Trace {
    this.queries++;
    const delta=sub(end,start), center=add(start,[0,0,height/2]), half: V=[radius,radius,height/2];
    const swept: Bounds={min:[0,1,2].map(i=>Math.min(start[i],end[i])-(i===2?0:radius)-EPS) as V,max:[0,1,2].map(i=>Math.max(start[i],end[i])+(i===2?height:radius)+EPS) as V};
    // Select the first actual impact; the returned skin-backed fraction is a
    // different quantity and must not hide a nearer triangle visited later.
    let fraction=1, hitFraction=1, normal: V=[0,0,0], startSolid=false;
    const visit=(node: Node)=>{
      if(!overlaps(node,swept))return;
      if(node.left){visit(node.left);visit(node.right!);return;}
      for(const t of node.triangles!){
        if(!overlaps(t,swept))continue;
        let enter=-Infinity,leave=Infinity,hit: V=[0,0,0],inside=true,skip=false;
        for(const axis of t.axes){
          const ps=[dot(t.a,axis),dot(t.b,axis),dot(t.c,axis)], radius=half[0]*Math.abs(axis[0])+half[1]*Math.abs(axis[1])+half[2]*Math.abs(axis[2]);
          const lo=Math.min(...ps)-radius,hi=Math.max(...ps)+radius, pos=dot(center,axis),d=dot(delta,axis);
          if(pos<=lo+1e-5 || pos>=hi-1e-5)inside=false;
          if(Math.abs(d)<1e-10){if(pos<lo-1e-6||pos>hi+1e-6){skip=true;break;}continue;}
          const near=d>0?(lo-pos)/d:(hi-pos)/d,far=d>0?(hi-pos)/d:(lo-pos)/d;
          if(near>enter){enter=near;hit=mul(axis,d>0?-1:1);}
          leave=Math.min(leave,far);
          if(enter>leave){skip=true;break;}
        }
        if(skip)continue;
        if(inside){startSolid=true;continue;}
        if(enter>=-1e-7 && enter<=leave && enter<hitFraction && leave>1e-8 && dot(delta,hit)<-1e-8){
          hitFraction=enter;
          fraction=Math.max(0,enter-EPS/Math.abs(dot(delta,hit)));normal=hit;
        }
      }
    };
    visit(this.root);
    return {fraction,end:add(start,mul(delta,fraction)),normal,startSolid};
  }
}
