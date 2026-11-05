export const defaults = [
  {id:'morning-food',kind:'food',time:'09:00',enabled:true},
  {id:'morning-walk',kind:'walk',time:'09:00',enabled:true},
  {id:'noon-food',kind:'food',time:'12:30',enabled:true},
  {id:'noon-walk',kind:'walk',time:'12:30',enabled:true},
  {id:'afternoon-walk',kind:'walk',time:'17:00',enabled:true},
  {id:'night-food',kind:'food',time:'21:00',enabled:true},
  {id:'night-walk',kind:'walk',time:'21:00',enabled:true}
];
export function localClock(date, zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function validateSchedule(value,zone) {
  try { localClock(new Date(),zone); } catch { return false; }
  return typeof zone==='string' && Array.isArray(value) && value.length<=20 && value.length>0 && new Set(value.map(x=>x.id)).size===value.length && value.every(x=>/^[a-z0-9-]{1,40}$/.test(x.id)&&['food','walk'].includes(x.kind)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)&&typeof x.enabled==='boolean');
}
export function dueItems(schedule,date,zone) {
  const clock=localClock(date,zone);
  return schedule.filter(x=>x.enabled&&x.time===clock.time).map(x=>({...x,occurrence:`${clock.day}:${x.id}`}));
}
