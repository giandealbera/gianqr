// Controlador de 2FA / TOTP.
//
// Flujo:
//   1. Setup: GET /api/auth/2fa/setup
//      -> backend genera un secreto, lo guarda como "pending" en
//         users.totp_secret (con totp_enabled aun en 0). Devuelve el
//         otpauth_uri + QR base64 + secret en texto plano (el usuario lo
//         agrega a su app y/o lo anota).
//   2. Confirmacion: POST /api/auth/2fa/enable { token }
//      -> backend verifica el primer codigo con el secreto guardado. Si
//         matchea, totp_enabled=1 y se generan 10 recovery codes (devueltos
//         UNA sola vez en claro al usuario). A partir de aca, login pide 2FA.
//   3. Desactivacion: POST /api/auth/2fa/disable { password, token }
//      -> exige password + codigo TOTP valido (o recovery). Limpia secret,
//         enabled, recovery codes.
//   4. Regenerar recovery codes: POST /api/auth/2fa/recovery/regenerate
//      -> exige password + token. Borra y regenera los 10.
//
// El verify de login esta en authController, no aca, porque mezcla con el
// flujo de password.

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const {
  generateSecret, otpauthUri, otpauthQrDataUrl,
  verifyToken, generateRecoveryCodes, hashRecoveryCode,
} = require('../utils/tfa');
const { logAudit } = require('../utils/auditLog');

// GET /api/auth/2fa/setup
// Devuelve secreto + uri + QR. NO marca enabled todavia.
const setup = async (req, res) => {
  try {
    // Si ya esta enabled, no permitimos re-setup sin disable previo (evita
    // que un atacante con sesion robada reset el segundo factor sin saberlo
    // el usuario).
    const cur = await db.query('SELECT email, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const u = cur.rows[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (u.totp_enabled) {
      return res.status(409).json({ error: '2FA ya está habilitado. Desactivalo primero si querés cambiarlo.' });
    }

    const secret = generateSecret();
    // Guardamos el secret pendiente. Si el usuario nunca confirma, el
    // proximo setup lo sobreescribe (no hay UI para "cancelar").
    await db.query('UPDATE users SET totp_secret = ? WHERE id = ?', [secret, req.user.id]);

    const uri = otpauthUri(u.email, secret);
    const qr  = await otpauthQrDataUrl(uri);
    res.json({ secret, otpauth_uri: uri, qr_data_url: qr });
  } catch (err) {
    console.error('2fa setup error:', err);
    res.status(500).json({ error: 'Error iniciando 2FA' });
  }
};

// POST /api/auth/2fa/enable { token }
const enable = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Falta el código' });
  try {
    const cur = await db.query('SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const u = cur.rows[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (u.totp_enabled) return res.status(409).json({ error: '2FA ya está habilitado' });
    if (!u.totp_secret) return res.status(400).json({ error: 'Primero pedí /2fa/setup' });

    if (!verifyToken(token, u.totp_secret)) {
      return res.status(401).json({ error: 'Código incorrecto. Verificá el reloj de tu dispositivo.' });
    }

    // Generar recovery codes en una transaccion atomica.
    const codes = generateRecoveryCodes(10);
    await db.transaction(async (conn) => {
      await conn.execute('UPDATE users SET totp_enabled = 1 WHERE id = ?', [req.user.id]);
      // Borrar codigos viejos (no deberian existir, pero por las dudas).
      await conn.execute('DELETE FROM totp_recovery_codes WHERE user_id = ?', [req.user.id]);
      for (const c of codes) {
        await conn.execute(
          'INSERT INTO totp_recovery_codes (id, user_id, code_hash) VALUES (?,?,?)',
          [uuidv4(), req.user.id, hashRecoveryCode(c)]
        );
      }
    });

    logAudit(req, 'TFA_ENABLED', { resourceType: 'user', resourceId: req.user.id });

    // Devolvemos los codes UNA sola vez. Despues solo se ven re-generando.
    res.json({
      message: '2FA habilitado',
      recovery_codes: codes,
    });
  } catch (err) {
    console.error('2fa enable error:', err);
    res.status(500).json({ error: 'Error habilitando 2FA' });
  }
};

// POST /api/auth/2fa/disable { password, token }
// Exige password + codigo (TOTP o recovery). Asi una sesion robada no
// puede desactivar 2FA sin conocer la password del usuario.
const disable = async (req, res) => {
  const { password, token } = req.body;
  if (!password || !token)
    return res.status(400).json({ error: 'Password y código (TOTP o recovery) son requeridos' });
  try {
    const cur = await db.query('SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const u = cur.rows[0];
    if (!u || !u.totp_enabled) return res.status(404).json({ error: '2FA no estaba habilitado' });

    const pwOk = await bcrypt.compare(password, u.password_hash);
    if (!pwOk) return res.status(401).json({ error: 'Password incorrecta' });

    const codeOk = verifyToken(token, u.totp_secret) || await consumeRecoveryCode(req.user.id, token);
    if (!codeOk) return res.status(401).json({ error: 'Código incorrecto' });

    await db.transaction(async (conn) => {
      await conn.execute('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [req.user.id]);
      await conn.execute('DELETE FROM totp_recovery_codes WHERE user_id = ?', [req.user.id]);
    });

    logAudit(req, 'TFA_DISABLED', { resourceType: 'user', resourceId: req.user.id });

    res.json({ message: '2FA desactivado' });
  } catch (err) {
    console.error('2fa disable error:', err);
    res.status(500).json({ error: 'Error desactivando 2FA' });
  }
};

// POST /api/auth/2fa/recovery/regenerate { password, token }
const regenerateRecoveryCodes = async (req, res) => {
  const { password, token } = req.body;
  if (!password || !token)
    return res.status(400).json({ error: 'Password y código son requeridos' });
  try {
    const cur = await db.query('SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const u = cur.rows[0];
    if (!u || !u.totp_enabled) return res.status(400).json({ error: '2FA no está habilitado' });

    const pwOk = await bcrypt.compare(password, u.password_hash);
    if (!pwOk) return res.status(401).json({ error: 'Password incorrecta' });

    if (!verifyToken(token, u.totp_secret)) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    const codes = generateRecoveryCodes(10);
    await db.transaction(async (conn) => {
      await conn.execute('DELETE FROM totp_recovery_codes WHERE user_id = ?', [req.user.id]);
      for (const c of codes) {
        await conn.execute(
          'INSERT INTO totp_recovery_codes (id, user_id, code_hash) VALUES (?,?,?)',
          [uuidv4(), req.user.id, hashRecoveryCode(c)]
        );
      }
    });

    logAudit(req, 'TFA_RECOVERY_REGENERATED', { resourceType: 'user', resourceId: req.user.id });

    res.json({ recovery_codes: codes });
  } catch (err) {
    console.error('2fa regenerate error:', err);
    res.status(500).json({ error: 'Error regenerando códigos' });
  }
};

// GET /api/auth/2fa/status — consultable por el usuario logueado.
const status = async (req, res) => {
  try {
    const cur = await db.query('SELECT totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const u = cur.rows[0];
    res.json({ enabled: !!u?.totp_enabled });
  } catch {
    res.status(500).json({ error: 'Error consultando estado 2FA' });
  }
};

// Helper expuesto para authController.verifyTwoFactor durante el login.
// Consume un recovery code: si matchea uno no usado, lo marca como usado
// y devuelve true. Idempotente: codigos ya usados no validan dos veces.
async function consumeRecoveryCode(userId, candidateCode) {
  if (!candidateCode || typeof candidateCode !== 'string') return false;
  const norm = candidateCode.trim().toUpperCase();
  if (!/^[A-F0-9]{4}-?[A-F0-9]{4}$/.test(norm)) return false;
  const normalized = norm.length === 8 ? `${norm.slice(0,4)}-${norm.slice(4,8)}` : norm;
  const hash = hashRecoveryCode(normalized);
  const r = await db.query(
    'SELECT id FROM totp_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1',
    [userId, hash]
  );
  if (!r.rows[0]) return false;
  await db.query('UPDATE totp_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [r.rows[0].id]);
  return true;
}

module.exports = {
  setup, enable, disable, regenerateRecoveryCodes, status,
  consumeRecoveryCode,
};
