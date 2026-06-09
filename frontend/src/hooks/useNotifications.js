import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

// Hook para activar/desactivar notificaciones push. Encapsula:
//   - Pedir permission al browser
//   - Bajarse la VAPID public key del backend
//   - Llamar a pushManager.subscribe()
//   - POSTear la subscription al backend
//   - Mantener el estado UI (granted/denied/default/loading)
//
// Soporte:
//   - iOS Safari 16.4+ SOLO en PWA standalone (apple-mobile-web-app-capable)
//   - Android Chrome / Edge / desktop browsers serios
//   - Si Notification o PushManager no existen, supported=false y el toggle
//     se esconde en la UI.

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const norm = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(norm);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function useNotifications() {
  const supported = typeof window !== 'undefined' &&
                    'Notification' in window &&
                    'PushManager' in window &&
                    'serviceWorker' in navigator;
  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied');
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true); // hasta probar

  // Chequea el estado al montar.
  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch { /* SW no disponible */ }
      try {
        const r = await api.get('/push/public-key');
        setServerEnabled(!!r.data?.enabled);
      } catch { setServerEnabled(false); }
    })();
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return { ok: false, reason: 'unsupported' };
    setLoading(true);
    try {
      // 1) Pedir permiso.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return { ok: false, reason: 'denied' };

      // 2) Public key del backend.
      const keyRes = await api.get('/push/public-key');
      const key = keyRes.data?.key;
      if (!key) return { ok: false, reason: 'server-not-configured' };

      // 3) Subscribirse al PushManager con la VAPID key.
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      // 4) Guardar en backend.
      await api.post('/push/subscribe', sub.toJSON());
      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      console.error('push enable', err);
      return { ok: false, reason: 'error', error: err };
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, serverEnabled, enable, disable };
}
