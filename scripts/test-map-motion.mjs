import assert from 'node:assert/strict';
import {createOrbitController,interpolateOrientation,axisAngle} from '../preview/context-space/orbit-controls.js';
let now=0,sequence=0;const queue=new Map();globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=fn=>{queue.set(++sequence,fn);return sequence;};globalThis.cancelAnimationFrame=id=>queue.delete(id);globalThis.matchMedia=()=>({matches:false});
function frame(dt=16){now+=dt;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));}
function settle(){for(let i=0;queue.size&&i<300;i++)frame();assert.equal(queue.size,0,'Motion must settle without an idle animation loop');}
class Surface extends EventTarget{clientWidth=900;clientHeight=650;dataset={};classList={add(){},remove(){}};closest(){return null;}setPointerCapture(){}releasePointerCapture(){}}
const s=new Surface();let paints=0;const orbit=createOrbitController(s,()=>paints++);
function pointer(type,x,y){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,clientX:x,clientY:y,pointerType:'mouse',button:0});s.dispatchEvent(e);}
pointer('pointerdown',0,0);for(let i=1;i<=100;i++)pointer('pointermove',i,50);assert.equal(paints,0);frame();assert.equal(paints,1,'Many input events share one screen repaint');pointer('pointercancel',100,50);settle();
const q=axisAngle([0,1,0],Math.PI*.8),half=interpolateOrientation(q,[0,0,0,1],.5);assert(Math.abs(Math.hypot(...half)-1)<1e-10);assert.notDeepEqual(half,q);assert.notDeepEqual(half,[0,0,0,1]);
const old=orbit.orientation;orbit.focusTo([8,-4,-6],.95);assert.deepEqual(orbit.orientation,old,'Starting a focus must not snap orientation');frame(210);assert(orbit.target[0]>0&&orbit.target[0]<8);assert.notDeepEqual(orbit.orientation,old);settle();assert.deepEqual(orbit.target,[8,-4,-6]);assert.equal(orbit.zoom,.95);assert.deepEqual(orbit.orientation,[0,0,0,1]);
const wheel=(deltaY,deltaMode=0)=>{const e=new Event('wheel',{cancelable:true});Object.assign(e,{deltaY,deltaMode});s.dispatchEvent(e);assert(e.defaultPrevented);};
wheel(8,1);const before=orbit.zoom;assert.equal(before,.95,'Zoom is eased rather than jumping on a wheel event');frame();assert(orbit.zoom<before);settle();assert(Math.abs(orbit.zoom-before*Math.exp(-128*.0012))<1e-10);
for(let i=0;i<20;i++)wheel(-10);assert(queue.size<=2);settle();assert(orbit.zoom>before);
wheel(-300);frame();pointer('pointerdown',10,10);const interrupted=orbit.zoom;settle();assert.equal(orbit.zoom,interrupted,'Dragging interrupts a pending zoom');pointer('pointerup',10,10);
console.log('PASS: input coalescing, shortest-path orientation interpolation, non-snapping camera focus, damped normalized wheel zoom, bounded animation completion and direct gesture interruption.');
