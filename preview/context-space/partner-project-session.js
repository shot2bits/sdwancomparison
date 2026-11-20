/** Local test session guard, not production identity. Revocation cannot retract a prior download. */
const projectId=document.body.dataset.partnerProject;
if(projectId){
 const check=async()=>{try{const r=await fetch('/api/context-preview/partners',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'access',projectId})}),d=await r.json();if(!r.ok||!d.allowed)throw Error('Customer authorisation has expired or been revoked. Return to your workspace.');}catch(e){const root=document.querySelector('#netify-space');if(root){root.inert=true;root.hidden=true;}const banner=document.querySelector('.rp-project-banner');if(banner){banner.dataset.blocked='true';banner.querySelector('p').textContent=e.message;}}};
 setInterval(check,15000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});check();
}
