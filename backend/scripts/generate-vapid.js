// Genera un par de claves VAPID para Web Push.
// Uso: `node backend/scripts/generate-vapid.js`
//
// Imprime la public y private. Pega cada una en Railway como env var:
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_CONTACT=mailto:tu@email.com  (opcional, default no-reply)
//
// Hasta que esten las 3, el push backend queda en modo no-op (acepta
// subscribes pero no envia nada — no rompe nada).

const webpush = require('web-push');
const k = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
console.log('VAPID_CONTACT=mailto:tu@email.com');
