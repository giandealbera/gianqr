import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// vite-plugin-pwa registra el service worker. registerType:'autoUpdate' en
// vite.config hace que al detectar un deploy nuevo lo active en la
// proxima visita sin pedir reload manual.
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
