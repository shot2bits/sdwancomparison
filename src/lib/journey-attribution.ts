import {acquisitionFromReferrer,measurementPage,sanitiseAttribution,type JourneyAttribution} from './measurement-contract';
/** Shared, consent-gated tab context with the apex. No identifiers or full URLs. */
export function journeyAttribution():JourneyAttribution|undefined {
 if(typeof window==='undefined')return undefined;
 try {
  const cookie=document.cookie.match(/(?:^|; )netify_consent=([^;]*)/);
  const consent=JSON.parse(cookie?decodeURIComponent(cookie[1]):localStorage.getItem('netify_consent')??'null');
  if(consent?.categories?.analytics!==true){sessionStorage.removeItem('netify_journey_v1');return undefined;}
  const prior=JSON.parse(sessionStorage.getItem('netify_journey_v1')??'null'),now=Date.now();
  const clean=prior&&now>=prior.at&&now-prior.at<30*60*1000?sanitiseAttribution(prior.value):undefined;
  const value:JourneyAttribution=clean??{version:1,consent:'granted',landing_page:measurementPage(location.pathname),acquisition:acquisitionFromReferrer(document.referrer)};
  sessionStorage.setItem('netify_journey_v1',JSON.stringify({at:now,value}));return value;
 } catch {return undefined;}
}
