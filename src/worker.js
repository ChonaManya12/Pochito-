import webpush from 'web-push';
import {dueItems,validateSchedule} from '../public/schedule.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function validSubscription(s) {
  try { const u=new URL(s.endpoint); return u.protocol==='https:' && (u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com') && !u.port && typeof s.keys?.auth==='string' && s.keys.auth.length<100 && typeof s.keys?.p256dh==='string' && s.keys.p256dh.length<200; } catch {return false;}
}
async function notify(env,sub,payload) {
  const request=webpush.generateRequestDetails(sub,JSON.stringify(payload),{TTL:300,urgency:'normal',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
  return fetch(request.endpoint,{method:request.method,headers:request.headers,body:request.body,redirect:'error'});
}
export default {
  async fetch(req,env) {
    const url=new URL(req.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const configured=!!(env.DB&&env.APP_KEY_HASH&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);
    if(url.pathname==='/api/config'&&req.method==='GET') return json({configured,publicKey:configured?env.VAPID_PUBLIC_KEY:null});
    if(!configured) return json({error:'Falta activar el servicio de avisos.'},503);
    if(req.headers.get('Origin')!==url.origin) return json({error:'Origen no permitido.'},403);
    const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
    if(token.length<32||await digest(token)!==env.APP_KEY_HASH) return json({error:'La clave de acceso no es válida.'},401);
    const device=req.headers.get('X-Device-ID')||'';
    if(!/^[a-f0-9-]{36}$/.test(device)) return json({error:'Dispositivo no válido.'},400);
    try {
      if(url.pathname==='/api/device'&&req.method==='DELETE') {
        await env.DB.batch([env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device),env.DB.prepare('DELETE FROM deliveries WHERE device=?').bind(device)]); return json({ok:true});
      }
      if(req.method!=='POST') return json({error:'Ruta no disponible.'},404);
      const raw=await req.text(); if(raw.length>16000) return json({error:'Solicitud demasiado grande.'},413);
      const body=JSON.parse(raw);
      if(url.pathname==='/api/device') {
        if(!validSubscription(body.subscription)||!validateSchedule(body.schedule,body.zone)) return json({error:'Revisá los horarios o la suscripción.'},400);
        await env.DB.prepare('INSERT INTO devices VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,schedule=excluded.schedule,zone=excluded.zone,updated=excluded.updated').bind(device,JSON.stringify(body.subscription),JSON.stringify(body.schedule),body.zone,Date.now()).run(); return json({ok:true});
      }
      if(url.pathname==='/api/test') {
        const row=await env.DB.prepare('SELECT subscription FROM devices WHERE id=?').bind(device).first();
        if(!row) return json({error:'Activá primero los avisos.'},400);
        const result=await notify(env,JSON.parse(row.subscription),{title:'¡Hola! Soy Pochito 🐾',body:'Los avisos están funcionando. ¡Gracias por cuidarme!',tag:'test'});
        if(!result.ok) return json({error:'El servicio push rechazó la prueba. Volvé a activar los avisos.'},502);
        return json({ok:true});
      }
      return json({error:'Ruta no disponible.'},404);
    } catch {return json({error:'No se pudo guardar. Intentá nuevamente.'},500);}
  },
  async scheduled(event,env) {
    if(!env.APP_KEY_HASH||!env.VAPID_PRIVATE_KEY) return;
    const now=new Date(event.scheduledTime);
    const {results}=await env.DB.prepare('SELECT * FROM devices').all();
    for(const row of results) {
      for(const item of dueItems(JSON.parse(row.schedule),now,row.zone)) {
        // One claim per device/day/item; failures are released for another invocation in this minute.
        const claim=await env.DB.prepare('INSERT OR IGNORE INTO deliveries VALUES (?,?,?,?)').bind(row.id,item.occurrence,'sending',Date.now()).run();
        if(!claim.meta.changes) continue;
        try {
          const result=await notify(env,JSON.parse(row.subscription),{title:item.kind==='food'?'¡Hora de comer, Pochito! 🥣':'¡Vamos de paseo, Pochito! 🐾',body:item.kind==='food'?'Prepará su comida y marcala cuando esté lista.':'Un ratito afuera juntos. Marcá el paseo cuando vuelvan.',tag:item.occurrence});
          if(result.status===404||result.status===410) await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(row.id).run();
          if(!result.ok) throw new Error('Push rejected');
          await env.DB.prepare("UPDATE deliveries SET state='sent' WHERE device=? AND occurrence=?").bind(row.id,item.occurrence).run();
        } catch {
          console.error('No se pudo entregar un aviso');
          await env.DB.prepare('DELETE FROM deliveries WHERE device=? AND occurrence=?').bind(row.id,item.occurrence).run();
        }
      }
    }
    await env.DB.prepare('DELETE FROM deliveries WHERE updated<?').bind(Date.now()-7*86400000).run();
  }
};
