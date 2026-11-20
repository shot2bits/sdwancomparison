/** Startup wrapper only. The accepted map and interface sources remain untouched. */
export function withPlatformLoading(html:string){
 return html.replace('<head>','<head><style id="netify-platform-startup-style">html:not([data-platform-ready]) #netify-space{visibility:hidden}#netify-platform-startup{position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:12px;text-align:center;background:#f3f7f8;color:#24473e;font:16px system-ui,sans-serif;padding:24px}html[data-platform-ready] #netify-platform-startup{display:none}#netify-platform-startup a{color:inherit}</style><script defer src="/marketplace/assets/platform-loading.js"></script>')
 .replace(/(<body[^>]*>)/,'$1<div id="netify-platform-startup" role="status" aria-live="polite"><span id="netify-platform-startup-message">Loading your workspace…</span><a id="netify-platform-retry" href="" hidden>Retry loading</a><noscript>Enable JavaScript to use the interactive workspace.</noscript></div>');
}

export const platformLoadingScript=String.raw`(()=>{
 const doc=document,root=doc.documentElement,notice=doc.getElementById('netify-platform-startup');
 const entry=new URL(location.href);if(!entry.searchParams.has('core')&&!entry.searchParams.has('partner_project')){entry.searchParams.set('core','new');history.replaceState(null,'',entry.pathname+entry.search+entry.hash);}
 let observer,timer,finished=false;
 const ready=()=>!!doc.querySelector('#location-studio #ls-sector button')&&!!doc.querySelector('#ls-map.leaflet-container')&&!!doc.querySelector('#ns-pricing-workspace')&&!!doc.querySelector('#ls-provider-top button');
 const reveal=()=>{if(finished||!ready())return;finished=true;root.setAttribute('data-platform-ready','true');observer?.disconnect();clearTimeout(timer);notice?.remove();};
 const failed=()=>{if(finished)return;doc.getElementById('netify-platform-startup-message').textContent='Your workspace could not finish loading. Please retry.';const retry=doc.getElementById('netify-platform-retry');retry.href=location.href;retry.hidden=false;};
 observer=new MutationObserver(reveal);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','id']});
 timer=setTimeout(failed,20000);reveal();
})();`;
