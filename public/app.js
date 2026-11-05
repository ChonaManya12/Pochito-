import {defaults,localClock} from '/schedule.js';
const $=s=>document.querySelector(s);
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
let schedule=read('pochito.schedule',defaults),zone=read('pochito.zone','America/Montevideo'),history=read('pochito.history',[]),config=null,registration=null;
let device=localStorage.getItem('pochito.device');if(!device){device=crypto.randomUUID();localStorage.setItem('pochito.device',device);}
$('#access-key').value=localStorage.getItem('pochito.key')||'';
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',5000);}
const label=x=>x.kind==='food'?'Hora de comer':'Un paseo juntos';
const emoji=x=>x.kind==='food'?'🥣':'🐾';
function render(){
 const day=localClock(new Date(),zone).day;
 $('#date').textContent=new Intl.DateTimeFormat('es-UY',{timeZone:zone,weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();
 const tasks=schedule.filter(x=>x.enabled).sort((a,b)=>a.time.localeCompare(b.time));
 const done=tasks.filter(x=>history.some(h=>h.day===day&&h.id===x.id)).length;
 $('#progress').textContent=`${done} de ${tasks.length} cuidados`;
 $('#tasks').replaceChildren(...tasks.map(x=>{
  const completed=history.some(h=>h.day===day&&h.id===x.id),el=document.createElement('article');el.className=`task ${x.kind} ${completed?'done':''}`;
  el.innerHTML=`<span class="emoji" aria-hidden="true">${emoji(x)}</span><div class="description"><strong>${label(x)}</strong><small>${x.time} · ${completed?'Hecho, con cariño':'Su momento del día'}</small></div><button>${completed?'Deshacer':'Ya lo hice'}</button>`;
  el.querySelector('button').onclick=()=>{history=completed?history.filter(h=>!(h.day===day&&h.id===x.id)):[{id:x.id,day,kind:x.kind,at:new Date().toISOString()},...history].slice(0,500);localStorage.setItem('pochito.history',JSON.stringify(history));render();};return el;
 }));
 if(!tasks.length) $('#tasks').textContent='No hay cuidados activos. Podés activarlos en Horarios.';
 $('#log').replaceChildren(...history.slice(0,60).map(h=>{const el=document.createElement('article');el.className='task';const icon=document.createElement('span');icon.className='emoji';icon.textContent=emoji(h);const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=label(h);const small=document.createElement('small');small.textContent=new Date(h.at).toLocaleString('es-UY',{timeZone:zone,dateStyle:'medium',timeStyle:'short'});text.append(strong,small);el.append(icon,text);return el;}));
 if(!history.length)$('#log').textContent='Todavía no hay cuidados registrados. El primero empieza hoy 🐾';
}
$('#editors').replaceChildren(...schedule.map(x=>{const el=document.createElement('div');el.className='editor';el.innerHTML=`<input type="checkbox" id="enabled-${x.id}" ${x.enabled?'checked':''}><label for="enabled-${x.id}">${emoji(x)} ${label(x)}</label><input aria-label="Horario de ${label(x)}" type="time" required value="${x.time}">`;el.dataset.id=x.id;return el;}));
if(![...$('#zone').options].some(x=>x.value===zone))$('#zone').add(new Option(zone,zone));$('#zone').value=zone;
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>{const active=b===button;b.setAttribute('aria-pressed',active);$('#'+b.dataset.tab).hidden=!active;});render();});
async function api(path,method='POST',body){const key=$('#access-key').value.trim();const res=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'X-Device-ID':device},body:body?JSON.stringify(body):undefined});let data;try{data=await res.json();}catch{throw Error('El servicio de avisos no está disponible.');}if(!res.ok)throw Error(data.error||'No se pudo completar.');localStorage.setItem('pochito.key',key);return data;}
async function sync(){const sub=await registration?.pushManager.getSubscription();if(!sub)throw Error('Primero activá los avisos.');await api('device','POST',{subscription:sub.toJSON(),schedule,zone});localStorage.setItem('pochito.synced','true');}
$('#schedule-form').onsubmit=async e=>{e.preventDefault();schedule=schedule.map(x=>{const el=document.querySelector(`[data-id="${x.id}"]`);return {...x,enabled:el.querySelector('[type=checkbox]').checked,time:el.querySelector('[type=time]').value};});zone=$('#zone').value;localStorage.setItem('pochito.schedule',JSON.stringify(schedule));localStorage.setItem('pochito.zone',JSON.stringify(zone));render();try{if(await registration?.pushManager.getSubscription()){await sync();toast('Horarios guardados y enviados al servicio de avisos.');}else toast('Horarios guardados aquí. Activá los avisos para recibirlos.');}catch(err){localStorage.removeItem('pochito.synced');$('#push-status').textContent='Horarios pendientes de sincronizar. Guardalos otra vez con conexión.';toast('Guardados en este dispositivo. '+err.message);}};
async function busy(button,fn){button.disabled=true;try{await fn();}catch(err){toast(err.message);}finally{button.disabled=false;}}
$('#enable').onclick=e=>busy(e.target,async()=>{
 if(!config?.configured)throw Error('Todavía falta publicar y configurar el servicio de avisos.');
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)throw Error('Agregá Pochito a inicio y abrilo desde su ícono.');
 if(!registration||!('PushManager' in window))throw Error('Este navegador no admite avisos. En iPhone usá la app desde inicio con iOS 16.4 o posterior.');
 if($('#access-key').value.trim().length<32)throw Error('Ingresá la clave privada configurada al publicar.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('No se concedió permiso. Revisá los ajustes de notificaciones del iPhone.');
 const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
 await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});await sync();$('#push-status').textContent='Avisos activados en este iPhone. Enviá una prueba para comprobarlos.';toast('Avisos activados.');
});
$('#test').onclick=e=>busy(e.target,async()=>{await api('test','POST',{});toast('Prueba enviada. Comprobá la notificación en tu iPhone.');});
$('#disable').onclick=e=>busy(e.target,async()=>{await api('device','DELETE');const sub=await registration?.pushManager.getSubscription();await sub?.unsubscribe();localStorage.removeItem('pochito.synced');$('#push-status').textContent='Avisos desactivados en este iPhone.';toast('Avisos desactivados.');});
render();setInterval(render,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
async function init(){try{const response=await fetch('/api/config');config=await response.json();if('serviceWorker'in navigator)registration=await Promise.race([navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready),new Promise((_,reject)=>setTimeout(()=>reject(Error('No se pudo activar la app. Recargá la página.')),10000))]);const sub=await registration?.pushManager.getSubscription();$('#push-status').textContent=!config.configured?'El servicio de avisos todavía no está configurado. Podés usar la rutina y el registro.':sub&&localStorage.getItem('pochito.synced')?'Este dispositivo tiene avisos activados. Podés enviar una prueba.':'Servicio listo. Activá los avisos en este iPhone.';}catch{$('#push-status').textContent='Sin conexión con el servicio de avisos. La rutina sigue disponible.';}}
init();
