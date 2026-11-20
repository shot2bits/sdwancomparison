import assert from 'node:assert/strict';
import {orbitState,rotateVector,createOrbitController,connectionSegments,separateMapCards} from '../preview/context-space/orbit-controls.js';
const near=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-9));
const orbit=orbitState(),point=[1,2,3];orbit.rotate(800,0,800,600);near(rotateVector(orbit.orientation,point),point);orbit.rotate(0,600,800,600);near(rotateVector(orbit.orientation,point),point);
const half=orbitState();const front=half.project([0,0,2],800,600);half.rotate(400,0,800,600);const back=half.project([0,0,2],800,600);assert(front.z>0&&back.z<0);assert(back.s>front.s);
for(let i=0;i<10000;i++)orbit.rotate(17,-31,800,600);assert(Math.abs(Math.hypot(...orbit.orientation)-1)<1e-12);
orbit.zoomBy(100);assert.equal(orbit.zoom,6);orbit.zoomBy(.00001);assert.equal(orbit.zoom,.45);orbit.zoomBy(NaN);assert.equal(orbit.zoom,.45);orbit.reset();assert.equal(orbit.zoom,1);
globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>1;globalThis.matchMedia=()=>({matches:true});
class Surface extends EventTarget {clientWidth=800;clientHeight=600;dataset={};classList={add(){},remove(){}};closest(){return null;}setPointerCapture(){}releasePointerCapture(){}}
const surface=new Surface();let changes=0;const controls=createOrbitController(surface,()=>changes++);
function pointer(type,id,x,y){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0});surface.dispatchEvent(e);}
pointer('pointerdown',1,0,0);pointer('pointermove',1,200,80);pointer('pointerup',1,200,80);assert(changes>0);assert(controls.shouldSuppressClick());
pointer('pointerdown',2,10,10);pointer('pointerup',2,10,10);assert(!controls.shouldSuppressClick());
controls.reset();pointer('pointerdown',3,100,100);pointer('pointerdown',4,200,100);pointer('pointermove',4,300,100);assert.equal(controls.zoom,2);pointer('pointerup',4,300,100);pointer('pointermove',3,125,125);pointer('pointerup',3,125,125);assert(controls.shouldSuppressClick());
controls.reset();assert.equal(controls.zoom,1);
console.log('PASS: complete horizontal and vertical revolutions, depth reversal, stable quaternion rotation, zoom limits, touch drag, pinch, one-finger continuation, tap versus drag selection, reset and reduced-motion handling.');

// A plane focus centres the intended world point without changing its stored coordinates.
const plane=orbitState();plane.setView([8,-4.6,-6],.95);let centred=plane.project([8,-4.6,-6],900,600);assert.equal(centred.x,450);assert.equal(centred.y,276);
plane.rotate(900,0,900,600);centred=plane.project([8,-4.6,-6],900,600);assert.equal(centred.x,450);assert.equal(centred.y,276);
controls.focusTo([-8,4.6,-6],.95);near(controls.target,[-8,4.6,-6]);assert.equal(controls.zoom,.95);controls.reset();near(controls.target,[0,0,0]);
// Endpoint cards and unrelated crossing cards must all mask the visible connection.
const rects=[{left:-10,right:10,top:-10,bottom:10},{left:40,right:60,top:-10,bottom:10},{left:90,right:110,top:-10,bottom:10}];
const segments=connectionSegments({x:0,y:0},{x:100,y:0},rects);assert.equal(segments.length,2);assert.deepEqual(segments.map(s=>[Math.round(s.from.x),Math.round(s.to.x)]),[[13,37],[63,87]]);
assert.equal(connectionSegments({x:0,y:0},{x:0,y:0},rects).length,0);
assert.equal(connectionSegments({x:0,y:0},{x:5,y:0},rects).length,0);
const overlapping=[{left:-2,right:2,top:10,bottom:30},{left:-2,right:2,top:20,bottom:40}];
const vertical=connectionSegments({x:0,y:0},{x:0,y:50},overlapping,0);assert.deepEqual(vertical.map(s=>[s.from.y,s.to.y]),[[0,10],[40,50]]);
for(const segment of segments)for(let i=0;i<=10;i++){const t=i/10,x=segment.from.x+(segment.to.x-segment.from.x)*t,y=segment.from.y+(segment.to.y-segment.from.y)*t;assert(!rects.some(r=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom));}
console.log('PASS: camera focus keeps world positions stable, reduced-motion focus/reset, and connections avoid endpoint, crossing and overlapping cards.');

for(const [width,count] of [[840,6],[840,9],[350,6],[350,9]]){
 const bounds={left:20,right:width-20,top:95,bottom:480};
 const cards=Array.from({length:count},(_,i)=>({id:String(i),x:width/2+i*3,y:250+i*2,width:width<400?120:145,height:count===9?54:66}));
 const placed=separateMapCards(cards,bounds);
 for(const [i,a] of placed.entries()){
  assert(a.x-a.width/2>=bounds.left-.1&&a.x+a.width/2<=bounds.right+.1);
  assert(a.y-a.height/2>=bounds.top-.1&&a.y+a.height/2<=bounds.bottom+.1);
  for(const b of placed.slice(i+1))assert(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,'Projected labels must not overlap');
 }
 assert.deepEqual(cards.map(c=>c.id),placed.map(c=>c.id));
}
console.log('PASS: crowded business and requirements labels stay separate and inside desktop/mobile map bounds.');
