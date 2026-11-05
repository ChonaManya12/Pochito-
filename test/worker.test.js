import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,createECDH,randomBytes} from 'node:crypto';
import webpush from 'web-push';
import worker from '../src/worker.js';
import {defaults} from '../public/schedule.js';
const token='test-access-token-with-at-least-32-characters';
const device='11111111-1111-4111-8111-111111111111';
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
 const wrap=(q,args=[])=>({bind:(...values)=>wrap(q,values),run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}}),first:async()=>sql.prepare(q).get(...args),all:async()=>({results:sql.prepare(q).all(...args)})});
 const keys=webpush.generateVAPIDKeys();
 const env={DB:{prepare:wrap,batch:async stmts=>Promise.all(stmts.map(s=>s.run()))},APP_KEY_HASH:createHash('sha256').update(token).digest('hex'),VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'https://example.com',ASSETS:{fetch:()=>new Response('static')}};
 const ecdh=createECDH('prime256v1');ecdh.generateKeys();
 const subscription={endpoint:'https://web.push.apple.com/test-subscription',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const request=(path,body,key=token,origin='https://pochito.example')=>new Request('https://pochito.example/api/'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+key,'X-Device-ID':device},body:JSON.stringify(body)});
 return {sql,env,subscription,request};
}
test('no revela secretos y rechaza escrituras sin clave u origen',async()=>{
 const {env,request}=setup();
 const config=await (await worker.fetch(new Request('https://pochito.example/api/config'),env)).json();
 assert.deepEqual(Object.keys(config).sort(),['configured','publicKey']);
 assert.equal((await worker.fetch(request('device',{},'wrong'),env)).status,401);
 assert.equal((await worker.fetch(request('device',{},token,'https://other.example'),env)).status,403);
});
test('valida destino push y guarda solo datos del dispositivo',async()=>{
 const {env,request,subscription,sql}=setup();
 const body={subscription,schedule:defaults,zone:'America/Montevideo'};
 assert.equal((await worker.fetch(request('device',{...body,subscription:{...subscription,endpoint:'https://127.0.0.1/private'}}),env)).status,400);
 assert.equal((await worker.fetch(request('device',body),env)).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,1);
 assert.equal((await worker.fetch(request('device',body),env)).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,1);
});
test('cron cifra push y no repite una entrega confirmada',async()=>{
 const {env,request,subscription,sql}=setup();
 await worker.fetch(request('device',{subscription,schedule:[defaults[0]],zone:'America/Montevideo'}),env);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,subscription.endpoint);assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert.ok(options.headers.Authorization.startsWith('vapid '));assert.ok(options.body.length>0);return new Response('',{status:201});};
 try{const event={scheduledTime:Date.parse('2026-11-05T12:00Z')};await worker.scheduled(event,env);await worker.scheduled(event,env);assert.equal(calls,1);assert.equal(sql.prepare('SELECT state FROM deliveries').get().state,'sent');}finally{globalThis.fetch=original;}
});
test('suscripción vencida se elimina',async()=>{
 const {env,request,subscription,sql}=setup();await worker.fetch(request('device',{subscription,schedule:[defaults[0]],zone:'America/Montevideo'}),env);
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:410});
 try{await worker.scheduled({scheduledTime:Date.parse('2026-11-05T12:00Z')},env);assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,0);}finally{globalThis.fetch=original;}
});
