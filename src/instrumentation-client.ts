import {initBotId} from 'botid/client/core';

/** Same BotID client as the marketplace send guard: wrap fetch so the web email-verification gate can be checked server-side. */
initBotId({protect:[
 {path:'*/api/access/request',method:'POST'},
 {path:'*/api/access/request/',method:'POST'},
]});
