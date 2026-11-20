/** Camera and marker view state only. Never changes the buyer's estate or requirements. */
export function locationClusters(sites,zoom,project,radius=72){
 const cells=new Map();
 for(const site of [...sites].sort((a,b)=>a.id.localeCompare(b.id))){
  if(site.lat===null||site.lng===null)continue;
  // World pixels do not change when the viewport pans. Keep membership stable between gestures.
  const p=project([site.lat,site.lng],Math.floor(zoom));
  const key=Math.floor(p.x/radius)+':'+Math.floor(p.y/radius);
  if(!cells.has(key))cells.set(key,[]);cells.get(key).push(site);
 }
 return [...cells.values()].map(group=>{
  const cluster=group.length>1,ids=group.map(s=>s.id);
  const sin=group.reduce((n,s)=>n+Math.sin(s.lng*Math.PI/180),0),cos=group.reduce((n,s)=>n+Math.cos(s.lng*Math.PI/180),0);
  return {key:cluster?'cluster:'+JSON.stringify(ids):'site:'+ids[0],cluster,sites:group,lat:group.reduce((n,s)=>n+s.lat,0)/group.length,lng:cluster?Math.atan2(sin,cos)*180/Math.PI:group[0].lng,count:group.reduce((n,s)=>n+s.count,0)};
 });
}
export function reconcileLocationMarkers(cache,descriptors,adapter){
 const keys=new Set(descriptors.map(d=>d.key));
 for(const [key,entry] of cache)if(!keys.has(key)){adapter.remove(entry.marker);cache.delete(key);}
 for(const descriptor of descriptors){const entry=cache.get(descriptor.key);if(entry){adapter.update(entry.marker,descriptor,entry.data);entry.data=descriptor;}else cache.set(descriptor.key,{marker:adapter.create(descriptor),data:descriptor});}
}
/** Coalesce duplicate zoomend/moveend/resize notifications and defer updates during a gesture. */
export function createMapFrameQueue(draw,{request=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
 let frame=0,moving=false,pending=false;
 const schedule=()=>{pending=true;if(!moving&&!frame)frame=request(()=>{frame=0;if(!moving&&pending){pending=false;draw();}});};
 return {schedule,start(){moving=true;if(frame)cancel(frame);frame=0;},end(){moving=false;if(pending)schedule();},get moving(){return moving;},dispose(){if(frame)cancel(frame);frame=0;pending=false;}};
}
