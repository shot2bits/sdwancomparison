/** Startup wrapper only. The accepted map and interface sources remain untouched. */
const landingHeading = '<h1>Shortlist SASE &amp; SD-WAN providers.<br><span>Build your RFP. Get comparable bids.</span></h1><p>Compare vendors and managed providers against your sector, locations and requirements. Build one brief for supplier proposals.</p>';

const loadingStatus = '<div id="netify-platform-startup" role="status" aria-live="polite"><span id="netify-platform-startup-message">Loading your workspace…</span><a id="netify-platform-retry" href="" hidden>Retry loading</a><noscript><style>#netify-platform-startup-message{display:none}</style>Enable JavaScript to use the interactive workspace.</noscript></div>';

const landingStartup = `<section id="netify-marketplace-startup" aria-label="Netify marketplace">
  <header>${landingHeading}
    <nav aria-label="Marketplace research">
      <a href="/sase/research/">All provider research</a>
      <a href="/sase/compare/">All comparisons</a>
      <a href="/sase/rfp-builder/questions/">SASE and SD-WAN RFP question bank</a>
    </nav>
  </header>
  <div class="netify-startup-map" aria-label="Map loading area">${loadingStatus}</div>
</section>`;

const landingStyles = `
#netify-marketplace-startup{max-width:1280px;margin:0 auto;padding:24px;color:#24473e;font:16px/1.5 system-ui,sans-serif}
#netify-marketplace-startup h1{font-size:clamp(24px,3vw,38px);line-height:1.15;margin:0 0 10px}
#netify-marketplace-startup p{margin:0 0 10px}
#netify-marketplace-startup nav{display:flex;flex-wrap:wrap;gap:4px 18px;margin-bottom:16px}
#netify-marketplace-startup a{color:#1f6b4a;text-decoration:underline}
.netify-startup-map{display:grid;min-height:clamp(220px,36vh,360px);border:1px solid #d4e1df;border-radius:8px;background:#f3f7f8}
#netify-marketplace-startup #netify-platform-startup{position:static;background:transparent}
html[data-platform-ready] #netify-marketplace-startup{display:none}
`;

export function withPlatformLoading(html: string, showLanding = false) {
 const styles = 'html:not([data-platform-ready]) #netify-space{visibility:hidden}#netify-platform-startup{position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:12px;text-align:center;background:#f3f7f8;color:#24473e;font:16px system-ui,sans-serif;padding:24px}html[data-platform-ready] #netify-platform-startup{display:none}#netify-platform-startup a{color:inherit}';
 const head = `<head><style id="netify-platform-startup-style">${styles}${showLanding ? landingStyles : ''}</style><script defer src="/marketplace/assets/platform-loading.js"></script>`;
 return html.replace('<head>', () => head)
  .replace(/<body[^>]*>/, body => body + (showLanding ? landingStartup : loadingStatus));
}

export const platformLoadingScript=String.raw`(()=>{
 const doc=document,root=doc.documentElement,notice=doc.getElementById('netify-platform-startup');
 const entry=new URL(location.href);if(!entry.searchParams.has('core')&&!entry.searchParams.has('partner_project')){entry.searchParams.set('core','new');history.replaceState(null,'',entry.pathname+entry.search+entry.hash);}
 let observer,timer,finished=false;
 const ready=()=>!!doc.querySelector('#location-studio #ls-sector button')&&!!doc.querySelector('#ls-map.leaflet-container')&&!!doc.querySelector('#ns-pricing-workspace')&&!!doc.querySelector('#ls-provider-top button');
 const reveal=()=>{if(finished||!ready())return;finished=true;root.setAttribute('data-platform-ready','true');observer?.disconnect();clearTimeout(timer);(notice?.closest('#netify-marketplace-startup') ?? notice)?.remove();};
 const failed=()=>{if(finished)return;doc.getElementById('netify-platform-startup-message').textContent='Your workspace could not finish loading. Please retry.';const retry=doc.getElementById('netify-platform-retry');retry.href=location.href;retry.hidden=false;};
 observer=new MutationObserver(reveal);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','id']});
 timer=setTimeout(failed,20000);reveal();
})();`;
