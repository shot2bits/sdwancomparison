import assert from 'node:assert/strict';
import {privateMailEnabled,sendPrivateVerification} from '../src/lib/core-mail';
const env={...process.env},original=globalThis.fetch;let sent:any;
try{
 process.env.NETIFY_CORE_MAIL_MODE='capture';assert(!privateMailEnabled());await assert.rejects(()=>sendPrivateVerification({to:'owner@netify.co.uk',subject:'Test',url:'https://netify.co.uk/sase/locations/#verify=synthetic'},'one'));
 process.env.NETIFY_CORE_MAIL_MODE='live';process.env.NETIFY_CORE_MAIL_READY='1';process.env.NETIFY_CORE_SECURITY_TRACKING_OFF='1';process.env.RESEND_API_KEY='synthetic-key';process.env.NETIFY_CORE_MAIL_TEST_TO='owner@netify.co.uk';
 globalThis.fetch=async(_url,options)=>{sent=JSON.parse(String(options?.body));assert.equal(new Headers(options?.headers).get('idempotency-key'),'netify-private-one');return Response.json({id:'synthetic-delivery'});};
 await assert.rejects(()=>sendPrivateVerification({to:'different@buyer.example',subject:'Test',url:'https://netify.co.uk/sase/locations/#verify=synthetic'},'one'));
 await assert.rejects(()=>sendPrivateVerification({to:'owner@netify.co.uk',subject:'Test',url:'https://attacker.example/#verify=synthetic'},'one'));
 await sendPrivateVerification({to:'owner@netify.co.uk',subject:'Test',url:'https://netify.co.uk/sase/locations/#verify=synthetic'},'one');assert.equal(sent.from,'Netify <no-reply@mail.netify.co.uk>');assert(!sent.html);assert(sent.text.includes('15 minutes'));assert(!sent.text.includes('publish_opportunity'));
 console.log('PASS: capture by default, explicit readiness and tracking gates, owner-only test recipient, trusted HTTPS links and retry idempotency. No real email sent.');
}finally{process.env=env;globalThis.fetch=original;}
