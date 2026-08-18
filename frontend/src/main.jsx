import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// El registro del service worker ahora vive en UpdatePrompt (dentro de App):
// necesita avisar en pantalla cuando hay una version nueva, y para eso tiene
// que ser un componente. Registrarlo tambien aca duplicaria el listener.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
