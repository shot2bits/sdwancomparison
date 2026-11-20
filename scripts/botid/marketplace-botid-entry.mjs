// Source for preview/context-space/vendor/botid.js (rebuild: npm run build:botid-client).
// Vercel BotID for the vanilla marketplace: wraps fetch so protected anonymous
// sends carry a BotID challenge that the server checks with checkBotId().
import {initBotId} from 'botid/client/core';
initBotId({protect:[
 {path:'*/api/context-preview/core/identity/pricing-approve',method:'POST'},
 {path:'*/api/lead',method:'POST'},
]});
