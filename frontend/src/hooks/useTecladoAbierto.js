import { useEffect, useState } from 'react';

/**
 * Detecta si el teclado del celular esta abierto.
 *
 * Para que: la barra de navegacion inferior esta con position:fixed, asi que
 * al abrirse el teclado queda flotando justo encima de las teclas. Ademas de
 * verse mal, tapa el campo que estas escribiendo y se toca sin querer. En una
 * app nativa la barra simplemente no esta mientras escribis.
 *
 * Como: visualViewport es la parte de la pagina REALMENTE visible. Cuando
 * sube el teclado, su alto se achica mientras innerHeight queda igual. Si la
 * diferencia pasa el umbral, hay teclado.
 *
 * Android en general dispara resize; iOS mueve el viewport y dispara ambos.
 * Escuchamos los dos. Si el navegador no soporta visualViewport (muy viejo),
 * devolvemos siempre false: la barra se comporta como antes, sin romperse.
 */
const UMBRAL_PX = 160;   // menos que esto suele ser la barra del navegador, no el teclado

export function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const revisar = () => {
      setAbierto(window.innerHeight - vv.height > UMBRAL_PX);
    };

    revisar();
    vv.addEventListener('resize', revisar);
    vv.addEventListener('scroll', revisar);
    return () => {
      vv.removeEventListener('resize', revisar);
      vv.removeEventListener('scroll', revisar);
    };
  }, []);

  return abierto;
}

export default useTecladoAbierto;
