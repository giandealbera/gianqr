/**
 * Mailer unificado.
 *
 * - Si está RESEND_API_KEY seteado: envía via Resend (https://resend.com)
 * - Si no: imprime el mail al log y lo descarta (modo dev / pre-Resend).
 *
 * `isMailConfigured()` existe para que los controllers puedan avisarle al
 * usuario que el envio no esta disponible EN VEZ de decirle "te mandamos un
 * mail" y dejarlo esperando algo que nunca iba a salir.
 */

const FROM = process.env.MAIL_FROM || 'GianQR <noreply@gianqr.com>';

// Leemos la env var en cada llamada (no en el import) para que los tests
// puedan setearla/limpiarla sin recargar el modulo.
const apiKey = () => process.env.RESEND_API_KEY;

// Modo de prueba local: MAIL_DEV_STUB=1 hace que el sistema se comporte como
// si el envio estuviera configurado, pero los mails se imprimen al log en vez
// de salir. Sin esto, en una maquina sin RESEND_API_KEY el flujo de reset
// contesta 503 y no hay forma de probarlo de punta a punta.
// Nunca aplica en produccion: alli "no hay API key" tiene que seguir
// significando "el envio NO esta disponible", que es justamente lo que el
// usuario necesita que le avisemos.
const devStub = () =>
  process.env.MAIL_DEV_STUB === '1' && process.env.NODE_ENV !== 'production';

function isMailConfigured() {
  return !!apiKey() || devStub();
}

async function sendViaResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey()}`,
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
  // Solo hay envio real si hay API key; devStub cae al log de abajo.
  if (apiKey()) {
    try {
      await sendViaResend({ to, subject, text, html });
      return { sent: true, provider: 'resend' };
    } catch (err) {
      // Loguemos fuerte: es la unica pista de que un usuario pidio recuperar
      // su clave y el mail no salio.
      console.error(`[mail] FALLO el envio a ${to} ("${subject}"):`, err.message);
      return { sent: false, error: err.message };
    }
  }
  logToConsole({ to, subject, text });
  return { sent: false, provider: 'stub' };
};

// Escapa texto que va embebido en el HTML del mail. Sin esto, un nombre con
// `<` o `&` rompe el markup (y en el peor caso inyecta etiquetas).
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Plantilla HTML comun para los mails transaccionales. Estilos inline
 * porque los clientes de mail ignoran <style> y CSS externo.
 *
 * @param {string}  title      titulo grande dentro del mail
 * @param {string}  intro      parrafo principal (texto plano, se escapa)
 * @param {object}  [cta]      { label, url } boton principal (opcional)
 * @param {string}  [note]     linea chica al pie (texto plano, se escapa)
 */
function renderEmail({ title, intro, cta, note }) {
  const btn = cta
    ? `<tr><td style="padding:8px 0 20px;">
         <a href="${escapeHtml(cta.url)}"
            style="display:inline-block;background:#C9974D;color:#0B0F14;text-decoration:none;
                   font-weight:700;font-size:15px;padding:13px 28px;border-radius:10px;">
           ${escapeHtml(cta.label)}
         </a>
       </td></tr>
       <tr><td style="padding:0 0 18px;color:#6B7280;font-size:12px;line-height:1.6;">
         Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
         <span style="color:#9AA3B2;word-break:break-all;">${escapeHtml(cta.url)}</span>
       </td></tr>`
    : '';

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#0B0F14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#0B0F14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#0D1117;border:1px solid #1E2530;
                    border-radius:16px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,
                    'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:0 0 24px;">
          <span style="font-size:22px;font-weight:900;color:#C9974D;letter-spacing:-0.5px;">GianQR</span>
        </td></tr>
        <tr><td style="padding:0 0 12px;color:#FFFFFF;font-size:19px;font-weight:600;">
          ${escapeHtml(title)}
        </td></tr>
        <tr><td style="padding:0 0 22px;color:#9AA3B2;font-size:14px;line-height:1.65;">
          ${escapeHtml(intro)}
        </td></tr>
        ${btn}
        ${note ? `<tr><td style="padding:16px 0 0;border-top:1px solid #1E2530;
                     color:#6B7280;font-size:12px;line-height:1.6;">
                    ${escapeHtml(note)}
                  </td></tr>` : ''}
      </table>
      <p style="color:#4B5563;font-size:11px;margin:18px 0 0;font-family:-apple-system,
                BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        GianQR — Sistema de entradas
      </p>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = { sendMail, isMailConfigured, renderEmail, escapeHtml };
