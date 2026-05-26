/**
 * Mailer unificado.
 *
 * - Si está RESEND_API_KEY seteado: envía via Resend (https://resend.com)
 * - Si no: imprime el mail al log y lo descarta (modo dev / pre-Resend).
 *
 * Cuando integremos Resend, el flujo de forgot-password, magic links, recibos
 * de compra, etc. mandan mail real sin tocar nada de los controllers.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM || 'GianQR <noreply@gianqr.com>';

async function sendViaResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return res.json();
}

function logToConsole({ to, subject, text }) {
  // En produccion solo logueamos metadata. El body de un reset-password
  // contiene el link con token — no debe quedar en logs. Si RESEND_API_KEY
  // no esta configurada en prod, los users no van a recibir el mail
  // pero al menos no filtramos el reset link al stdout.
  if (process.env.NODE_ENV === 'production') {
    console.log(`[mail-stub] would send: to=${to} subject="${subject}" (RESEND_API_KEY no configurada)`);
    return;
  }
  console.log('\n📧 MAIL STUB (Resend no configurado):');
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body:    ${text.split('\n').join('\n            ')}`);
  console.log('   (configurar RESEND_API_KEY para envio real)\n');
}

const sendMail = async ({ to, subject, text, html }) => {
  if (RESEND_API_KEY) {
    try {
      await sendViaResend({ to, subject, text, html });
      return { sent: true, provider: 'resend' };
    } catch (err) {
      console.error('Mail send failed via Resend:', err.message);
      // Aun si falla el envio, no rompemos la operacion del caller (el reset
      // password queda generado en DB; el user puede pedirlo de nuevo)
      return { sent: false, error: err.message };
    }
  }
  logToConsole({ to, subject, text });
  return { sent: false, provider: 'stub' };
};

module.exports = { sendMail };
