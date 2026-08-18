// Identificador del build, inyectado por vite.config (__APP_BUILD__) con el
// commit y la fecha: "27d2ee3 · 2026-08-18 21:40".
//
// Para que sirve: la app es una PWA y guarda sus archivos en el telefono. Si
// queda una version vieja cacheada, sin esto no hay forma de saberlo y se
// terminan persiguiendo bugs que ya estaban arreglados. Con el sello a la
// vista alcanza con mirar la pantalla para comparar contra lo que se subio.
export const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

// Version corta para mostrar al lado del nombre.
export const APP_VERSION = 'v1.0';
