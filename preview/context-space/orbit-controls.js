/** Quaternion orbit controls. Pointer gestures never modify the procurement project. */
export const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export const axisAngle=(axis,angle)=>[...axis.map(n=>n*Math.sin(angle/2)),Math.cos(angle/2)];
export function rotateVector(q,v){const r=multiply(multiply(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]);return r.slice(0,3);}
export function interpolateOrientation(a,b,t){let dot=a.reduce((n,v,i)=>n+v*b[i],0);const end=dot<0?b.map(v=>-v):b;dot=Math.abs(dot);if(dot>.9995){const q=a.map((v,i)=>v+(end[i]-v)*t),norm=Math.hypot(...q);return q.map(v=>v/norm);}const angle=Math.acos(Math.min(1,dot)),sin=Math.sin(angle);return a.map((v,i)=>(v*Math.sin((1-t)*angle)+end[i]*Math.sin(t*angle))/sin);}
export function orbitState(){let q=[0,0,0,1],zoom=1,target=[0,0,0];return {get orientation(){return [...q];},get zoom(){return zoom;},get target(){return [...target];},setOrientation(next){if(next.length===4&&next.every(Number.isFinite)){const norm=Math.hypot(...next);if(norm>0)q=next.map(v=>v/norm);}},faceLevel(front=true){q=front?[0,0,0,1]:multiply(axisAngle([1,0,0],-.12),axisAngle([0,1,0],.15));},setView(nextTarget,nextZoom){if(nextTarget.length===3&&nextTarget.every(Number.isFinite))target=[...nextTarget];if(Number.isFinite(nextZoom))zoom=Math.max(.45,Math.min(6,nextZoom));},rotate(dx,dy,width=800,height=600){q=multiply(multiply(axisAngle([1,0,0],dy/height*Math.PI*2),axisAngle([0,1,0],dx/width*Math.PI*2)),q);const norm=Math.hypot(...q);q=q.map(v=>v/norm);},zoomBy(ratio){if(Number.isFinite(ratio)&&ratio>0)zoom=Math.max(.45,Math.min(6,zoom*ratio));},reset(){q=multiply(axisAngle([1,0,0],-.12),axisAngle([0,1,0],.15));zoom=1;target=[0,0,0];},project(v,width,height,spread=100){const [x,y,z]=rotateVector(q,v.map((x,i)=>x-target[i])),depth=9/Math.max(3,9+z),scale=Math.min(width/8.3,Math.max(160,height-180)/7.8)*(spread/100)*zoom;return {x:width/2+x*scale*depth,y:height*.46-y*scale*depth,z,s:Math.max(.55,Math.min(1.65,depth)),depth};}};}
export function createOrbitController(element,onChange){
 const view=orbitState();view.reset();const pointers=new Map();
 let dragged=false,suppressUntil=0,lastTime=0,vx=0,vy=0,raf=0,focusRaf=0,redrawRaf=0,zoomRaf=0,zoomTarget=1,pinch=0,last=null;
 const reduced=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const stop=()=>{for(const id of [raf,focusRaf,zoomRaf])cancelAnimationFrame(id);raf=focusRaf=zoomRaf=0;};
 // Input can arrive much faster than the screen refreshes. Paint the latest camera once per frame.
 const paint=()=>{redrawRaf=0;element.dataset.zoom=Math.round(view.zoom*100);onChange();};
 const changed=()=>{if(reduced())paint();else if(!redrawRaf)redrawRaf=requestAnimationFrame(paint);};
 const distance=()=>{const [a,b]=[...pointers.values()];return b?Math.hypot(a.x-b.x,a.y-b.y):0;};
 const ignore=e=>Boolean(e.target.closest('.ns-map-workflow-bar,.ns-orbit-tools,input,textarea,select,a,button:not([data-node])'));
 function inertia(){if(reduced())return;let then=performance.now();function frame(now){const dt=Math.min(40,now-then);then=now;const decay=Math.exp(-dt*.022),travel=(1-decay)/.022;view.rotate(vx*travel,vy*travel,element.clientWidth,element.clientHeight);vx*=decay;vy*=decay;changed();if(Math.hypot(vx,vy)>.008)raf=requestAnimationFrame(frame);else raf=0;}raf=requestAnimationFrame(frame);}
 element.addEventListener('pointerdown',e=>{if(ignore(e)||e.button>0)return;stop();suppressUntil=0;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){last={x:e.clientX,y:e.clientY};dragged=false;lastTime=performance.now();vx=vy=0;}else{pinch=distance();dragged=true;suppressUntil=performance.now()+400;}},true);
 element.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){const d=distance();if(pinch>0)view.zoomBy(d/pinch);pinch=d;dragged=true;vx=vy=0;}else{if(!dragged&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<(e.pointerType==='touch'?8:4))return;dragged=true;const dt=Math.max(8,performance.now()-lastTime),dx=(e.clientX-old.x)*.65,dy=(e.clientY-old.y)*.65;view.rotate(dx,dy,element.clientWidth,element.clientHeight);const blend=1-Math.exp(-dt/35);vx+=(Math.max(-1.5,Math.min(1.5,dx/dt))-vx)*blend;vy+=(Math.max(-1.5,Math.min(1.5,dy/dt))-vy)*blend;lastTime=performance.now();}e.preventDefault();try{element.setPointerCapture(e.pointerId);}catch{}element.classList.add('ns-dragging');changed();},{capture:true,passive:false});
 function finish(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);try{element.releasePointerCapture(e.pointerId);}catch{}if(pointers.size){last=[...pointers.values()][0];pinch=0;vx=vy=0;lastTime=performance.now();return;}element.classList.remove('ns-dragging');if(dragged){suppressUntil=performance.now()+350;if(e.type!=='pointercancel'&&performance.now()-lastTime<80)inertia();}last=null;pinch=0;}
 element.addEventListener('pointerup',finish,true);element.addEventListener('pointercancel',finish,true);
 function smoothZoom(ratio){if(!Number.isFinite(ratio)||ratio<=0)return;const start=zoomRaf?zoomTarget:view.zoom;stop();zoomTarget=Math.max(.45,Math.min(6,start*ratio));if(reduced()){view.setView(view.target,zoomTarget);changed();return;}let then=performance.now();function frame(now){const dt=Math.max(1,Math.min(40,now-then));then=now;const next=view.zoom+(zoomTarget-view.zoom)*(1-Math.exp(-dt/65));view.setView(view.target,Math.abs(next-zoomTarget)<.001?zoomTarget:next);changed();if(view.zoom!==zoomTarget)zoomRaf=requestAnimationFrame(frame);else zoomRaf=0;}zoomRaf=requestAnimationFrame(frame);}
 element.addEventListener('wheel',e=>{if(ignore(e))return;e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?element.clientHeight:1);smoothZoom(Math.exp(-Math.max(-400,Math.min(400,pixels))*.0012));},{passive:false});
 element.addEventListener('keydown',e=>{if(ignore(e))return;const keys={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(!keys[e.key])return;e.preventDefault();stop();view.rotate(...keys[e.key],element.clientWidth,element.clientHeight);changed();});
 function focusTo(target,zoom=1){stop();const from=view.target,startZoom=view.zoom,orientation=view.orientation,end=[0,0,0,1];
  if(reduced()){view.setView(target,zoom);view.setOrientation(end);changed();return;}
  const start=performance.now();function frame(now){const t=Math.min(1,(now-start)/420),ease=t*t*(3-2*t);view.setView(from.map((v,i)=>v+(target[i]-v)*ease),Math.exp(Math.log(startZoom)+(Math.log(zoom)-Math.log(startZoom))*ease));view.setOrientation(interpolateOrientation(orientation,end,ease));changed();if(t<1)focusRaf=requestAnimationFrame(frame);else focusRaf=0;}focusRaf=requestAnimationFrame(frame);
 }
 return {...view,focusTo,faceLevel(front=true){stop();view.faceLevel(front);changed();},get target(){return view.target;},get zoom(){return view.zoom;},get orientation(){return view.orientation;},project:(...args)=>view.project(...args),rotate(dx,dy){stop();view.rotate(dx,dy,element.clientWidth,element.clientHeight);changed();},zoomBy:smoothZoom,reset(){stop();view.reset();changed();},shouldSuppressClick(){return performance.now()<suppressUntil;}};
}

/** Remove every interval under a card, including unrelated cards crossed by a connection. */
export function connectionSegments(a,b,rects,gap=3){
 const dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<.01)return [];
 const blocked=[];
 for(const r of rects){let lo=0,hi=1;const bounds=[[a.x,dx,r.left-gap,r.right+gap],[a.y,dy,r.top-gap,r.bottom+gap]];let hit=true;
  for(const [v,d,min,max] of bounds){if(Math.abs(d)<1e-10){if(v<min||v>max){hit=false;break;}}else{let p=(min-v)/d,q=(max-v)/d;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>=hi){hit=false;break;}}}
  if(hit&&hi>0&&lo<1)blocked.push([Math.max(0,lo),Math.min(1,hi)]);
 }
 blocked.sort((a,b)=>a[0]-b[0]);const intervals=[];let end=0;for(const [lo,hi] of blocked){if(lo>end)intervals.push([end,lo]);end=Math.max(end,hi);}if(end<1)intervals.push([end,1]);
 return intervals.map(([lo,hi])=>({from:{x:a.x+dx*lo,y:a.y+dy*lo},to:{x:a.x+dx*hi,y:a.y+dy*hi}}));
}

/** Keep projected labels readable while their anchors still follow the 3D camera. */
export function separateMapCards(cards,bounds,gap=18){
 const result=cards.map(c=>({...c}));
 const clamp=c=>{c.x=Math.max(bounds.left+c.width/2,Math.min(bounds.right-c.width/2,c.x));c.y=Math.max(bounds.top+c.height/2,Math.min(bounds.bottom-c.height/2,c.y));};
 result.forEach(clamp);
 for(let pass=0;pass<100;pass++){let moved=false;
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++){
   const a=result[i],b=result[j],dx=b.x-a.x,dy=b.y-a.y;
   const ox=(a.width+b.width)/2+gap-Math.abs(dx),oy=(a.height+b.height)/2+gap-Math.abs(dy);
   if(ox<=.1||oy<=.1)continue;
   if(ox<oy){const d=(dx<0?-1:1)*(ox/2+.1);a.x-=d;b.x+=d;}else{const d=(dy<0?-1:1)*(oy/2+.1);a.y-=d;b.y+=d;}
   clamp(a);clamp(b);moved=true;
  }
  if(!moved)break;
 }
 const overlaps=result.some((a,i)=>result.slice(i+1).some(b=>Math.abs(a.x-b.x)<(a.width+b.width)/2+gap-1&&Math.abs(a.y-b.y)<(a.height+b.height)/2+gap-1));
 if(overlaps){
  const width=bounds.right-bounds.left,height=bounds.bottom-bounds.top,maxW=Math.max(...result.map(c=>c.width)),maxH=Math.max(...result.map(c=>c.height));
  const candidates=Array.from({length:result.length},(_,i)=>i+1).filter(cols=>width/cols>=maxW+gap&&height/Math.ceil(result.length/cols)>=maxH+gap);
  if(candidates.length){const cols=candidates.sort((a,b)=>Math.abs(width/a/(height/Math.ceil(result.length/a))-maxW/maxH)-Math.abs(width/b/(height/Math.ceil(result.length/b))-maxW/maxH))[0],rows=Math.ceil(result.length/cols);
   result.forEach((c,i)=>{c.x=bounds.left+(i%cols+.5)*width/cols;c.y=bounds.top+(Math.floor(i/cols)+.5)*height/rows;});
  }
 }
 return result;
}
