import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,localClock,dueItems,validateSchedule} from '../public/schedule.js';
test('Uruguay: 12 UTC entrega comida y paseo de las 9',()=>{
 const due=dueItems(defaults,new Date('2026-11-05T12:00:00Z'),'America/Montevideo');
 assert.deepEqual(due.map(x=>x.kind),['food','walk']);
 assert.equal(due[0].occurrence,'2026-11-05:morning-food');
});
test('no entrega fuera del minuto ni tareas desactivadas',()=>{
 assert.equal(dueItems(defaults,new Date('2026-11-05T12:01Z'),'America/Montevideo').length,0);
 assert.equal(dueItems(defaults.map(x=>({...x,enabled:false})),new Date('2026-11-05T12:00Z'),'America/Montevideo').length,0);
});
test('respeta fecha local al cruzar medianoche y horario de verano',()=>{
 assert.deepEqual(localClock(new Date('2026-11-05T01:00Z'),'America/Montevideo'),{day:'2026-11-04',time:'22:00'});
 assert.equal(localClock(new Date('2026-07-05T07:00Z'),'Europe/Madrid').time,'09:00');
 assert.equal(localClock(new Date('2026-01-05T08:00Z'),'Europe/Madrid').time,'09:00');
});
test('rechaza horarios, zonas e identificadores inválidos',()=>{
 assert.ok(validateSchedule(defaults,'America/Montevideo'));
 assert.equal(validateSchedule(defaults,'invalid'),false);
 assert.equal(validateSchedule([{...defaults[0],time:'25:10'}],'America/Montevideo'),false);
 assert.equal(validateSchedule([defaults[0],defaults[0]],'America/Montevideo'),false);
 assert.equal(validateSchedule([{...defaults[0],id:'<script>'}],'America/Montevideo'),false);
});
