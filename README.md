# Pochito 🐾

App web instalable para el iPhone, en español. Rutina editable de comida y paseos, registro compartido opcional y servicio Web Push mediante Cloudflare Workers + D1. No usa Lovable.

## Estado

Publicada en https://pochito.nachogondel12.workers.dev con Workers Free, D1, cron cada minuto y claves configuradas. No se activó ningún plan de pago ni se compró dominio. Falta instalarla, activar permisos y verificar la recepción en el iPhone. El historial puede conectarse al registro compartido desde Historial con la misma clave en ambos dispositivos. Se actualiza cada 15 segundos mientras está abierta y al volver a abrirla. Sin conexión muestra la última copia y no confirma nuevas escrituras. El modo local se conserva hasta conectarlo; importar el historial anterior es opcional y no lo borra. Los horarios se envían al servidor al guardar si los avisos ya están activados. No hay cuenta de usuario: el servicio es privado mediante una clave aleatoria de acceso.

Horarios iniciales editables (supuestos a confirmar): comida y paseo 09:00, comida y paseo 12:30, paseo 17:00, comida y último paseo 21:00. Zona America/Montevideo. Son horarios de organización, no una recomendación de alimentación.

## Desarrollo

Node 22 o posterior. `npm ci`, `npm test`, `npm run check`, `npm run dev`.

En local, sin secretos configurados, la rutina funciona y los avisos muestran que falta activar el servicio.

## Publicación

1. Crear una cuenta Cloudflare e iniciar sesión con `npx wrangler login`.
2. Crear base: `npx wrangler d1 create pochito`. Copiar su database_id a wrangler.jsonc.
3. Aplicar migración: `npx wrangler d1 migrations apply pochito --remote`.
4. Generar una pareja de claves VAPID una sola vez con `npm run keys`. Conservarlas de forma privada. No pegarlas en chats ni subirlas al repositorio.
5. Configurar con `npx wrangler secret put NOMBRE` cada secreto: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu-email-real o una URL HTTPS de contacto).
6. Crear una clave de acceso aleatoria de al menos 32 caracteres (por ejemplo 32 bytes aleatorios codificados en hexadecimal). Guardarla en un gestor de contraseñas. Configurar su SHA-256 hexadecimal como APP_KEY_HASH mediante `npx wrangler secret put APP_KEY_HASH`. Nunca publicar la clave original. La app pide esa clave original en el iPhone. No reutilizar una contraseña.
7. `npm run deploy`. El despliegue sirve la app, conecta D1 y registra el cron cada minuto. Revisar que aparezca el trigger en Cloudflare; su propagación puede tardar.
8. En iPhone iOS 16.4+: abrir URL en Safari → Compartir → Agregar a inicio. Abrir desde el ícono → Horarios → ingresar clave privada → Activar avisos → Enviar prueba. El permiso debe aceptarlo el usuario.
9. Cambiar temporalmente un horario a unos minutos en el futuro, guardar, cerrar la app y verificar la notificación en el iPhone bloqueado. Restaurar el horario.

No publicar secretos en GitHub. .dev.vars y .env están excluidos. Para rotar claves de acceso, cambiar APP_KEY_HASH y actualizar los dispositivos; para rotar VAPID hay que volver a suscribirlos.

## Entrega y privacidad

El cron calcula el minuto local por zona IANA, también al cambiar horario de verano. Cada cuidado tiene una entrega por dispositivo y día; los avisos se cifran mediante web-push y se envían con fetch desde el Worker. Solo se aceptan endpoints de proveedores push conocidos, evitando usar el servidor para peticiones arbitrarias. Las API privadas requieren clave y mismo origen. El endpoint público de configuración solo revela la clave VAPID pública.

D1 guarda la suscripción push, zona y horarios, sin email. También guarda el historial compartido en care_history, con fecha, cuidado, estado y revisión. Desactivar elimina la suscripción del servidor. Los envíos guardan solo identificadores y estado, con limpieza a los 7 días. El acceso privado es para uso personal; no está pensado como servicio multiusuario abierto.

Los avisos dependen de internet, permisos, modos de concentración, iOS y la disponibilidad del proveedor. No son una alarma exacta ni tienen entrega garantizada: el cron procesa el minuto actual; un fallo prolongado puede omitir un aviso y una caída entre reservar y enviar puede dejarlo sin entregar. Un reintento tras respuesta incierta también puede repetirlo; el tag agrupa la notificación. No usar GitHub Actions como reloj: aquí solo guarda código. La app no finge avisos mediante temporizadores del navegador.

## Validación pendiente

Once pruebas automáticas cubren horarios, zonas, cambio de fecha, validación, autorización de API, persistencia, cifrado push, deduplicación, suscripciones vencidas, historial entre dos dispositivos, conflictos y migración idempotente. El build comprueba el bundle del Worker. La instalación, permiso y recepción real deben comprobarse en el iPhone tras publicar. Sin ese paso no se afirma que los avisos ya lleguen.

## Conectar dos dispositivos

En cada celular, abrir Historial, ingresar la misma clave privada existente y tocar Conectar registro compartido. No hace falta activar notificaciones para compartir el registro. Desde cada dispositivo con datos anteriores se puede tocar Importar mi historial anterior. La importación no duplica cuidados ni revive los que otro dispositivo deshizo. Los horarios siguen siendo propios de cada dispositivo.

Las escrituras modifican un solo cuidado por fecha y requieren su última revisión. Un cambio desactualizado recibe conflicto y refresca el registro en lugar de reemplazarlo. Deshacer conserva una marca en la base para impedir que una importación vieja lo vuelva a activar. Se muestran los últimos 60 cuidados realizados y se sincronizan los últimos 2000 estados; los anteriores permanecen en D1. La clave da acceso al único espacio personal de Pochito; no hay espacios públicos ni registro abierto. La clave y sus secretos no se incluyen en el repositorio.
