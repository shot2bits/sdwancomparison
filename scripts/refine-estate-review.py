from pathlib import Path
p=Path('preview/context-space/location-workspace.js');s=p.read_text()
# Use one compiled schedule for validation, document sync and exports; never shorten it.
a=s.index(' function planningText()');b=s.index(' function userFields()',a)
block=s[a:b].replace('function planningText(){const r=readiness(),u=estate.planning?.users;', 'function planningText(target=estate){const r=estateReadiness(target,read().input,siteDrafts.size),u=target.planning?.users;').replace('estate.sites','target.sites').replace('sitePlanning(estate,s)','sitePlanning(target,s)').replace('estate.planning','target.planning').replace('siteReviewSignature(estate,s)','siteReviewSignature(target,s)')
s=s[:a]+block+s[b:]
s=s.replace("if(scheduleText(valid,defs()).length>19500)","if((scheduleText(valid,defs())+'\\n\\n'+planningText(valid)).length>19500)")
s=s.replace('<strong>${esc(p.name)}</strong><small>${fits?', '<strong title="${esc(p.name)}">${esc(p.name.split(\',\')[0])}</strong><small>${fits?')
# Show review state in the document itself after every change, including unsaved site drafts.
s=s.replace("renderProviderBorder();status('Site draft kept", "renderProviderBorder();renderDocument();status('Site draft kept")
p.write_text(s)
p=Path('preview/context-space/client.js');s=p.read_text()
s=s.replace("requirementsReady()?'Edits are in sync with the map and provider comparison.':'Add sector, scope, one known count and service regions to compare providers.'", "providerRecommendationsReady()?'Edits are in sync with the map and provider comparison.':locationWorkspace?'Your Living RFP is in sync. Next: '+locationWorkspace.readiness().label+'. Provider recommendations wait for site and user review.':'Add sector, scope, one known count and service regions to begin.'")
p.write_text(s)
