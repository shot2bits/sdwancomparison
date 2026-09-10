/** Analytics uses route categories, never a buyer's query, token or document title. */
const ROUTES = ["/sase-sd-wan-rfp-builder/", "/sase/home/", "/sase/shortlist/", "/sase/best/", "/sase/compare/", "/sase/vendors/", "/sase/examples/", "/sase/cost-estimator/", "/sase/pricing/", "/sase/circuit-pricing/", "/sase/connector/", "/sase/opportunities/", "/sase/rfp-builder/", "/sase/workspace/", "/sase/account/", "/sase/admin/"];
export function analyticsPath(value: string): string {
 try { const path=new URL(value,"https://netify.co.uk").pathname;return ROUTES.find(route=>path===route.slice(0,-1)||path.startsWith(route))??"/sase/"; } catch {return "/sase/";}
}
export function analyticsReferrer(value:string):string {
 try {const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.origin:"";}catch{return "";}
}
export function analyticsLocation(value:string):string {return "https://netify.co.uk"+analyticsPath(value);}
export function analyticsProps(data:Record<string,unknown>):Record<string,string> {
 const out:Record<string,string>={};
 const numeric=["step","provider_count","matched","invited","gapCount","count"];
 const flags=["has_title","opt_in","aiUsed"];
 const enums:Record<string,readonly string[]>={source:["rfp_builder","shortlist","marketplace","sector","mcp","standing_action","route_diagnosis"],from:["link","hero"],flow:["submit","review"],method:["email","phone"],family:["cost","best","compare","sector","vendor"],intent:["pricing","research","project"],channel:["web","mcp"],field:["search","scope","sector","region","responseMode"]};
 for(const [key,value] of Object.entries(data)){
  if(numeric.includes(key)&&/^\d{1,6}$/.test(String(value)))out[key]=String(value);
  else if(flags.includes(key)&&["yes","no","true","false","1","0"].includes(String(value)))out[key]=String(value);
  else if(enums[key]?.includes(String(value)))out[key]=String(value);
 }
 return out;
}
