// Enlaces de imágenes pegados a mano.
//
// Las imágenes de la app **se pegan como URL, no se suben**: la captura del juego ya queda
// subida en algún sitio y sale un enlace, así que obligar a bajarla y volver a subirla es
// trabajo por nada. Lo usan los flyers, los pop-ups y las devoluciones.
//
// Va en su propio archivo, sin tocar el almacén, para que lo puedan importar también las
// pantallas: así el navegador avisa del enlace malo antes de mandar nada.

/**
 * Comprueba un enlace y lo devuelve normalizado, o dice qué tiene de malo.
 *
 * **Se valida pero no se descarga.** Que el servidor fuera a buscar una URL que escribe
 * cualquiera es pedir que le pidan cosas de la red interna. La imagen la carga el navegador
 * de quien mira la pantalla, como cualquier otro enlace.
 */
export function normalizarEnlace(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) return { enlace: null };
  if (limpio.length > 600) return { error: 'Ese enlace es demasiado largo.' };

  let url;
  try {
    url = new URL(limpio);
  } catch {
    return { error: 'Ese enlace no se entiende. Pega la URL completa.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: 'El enlace tiene que empezar por http:// o https://' };
  }
  return { enlace: url.toString() };
}

/**
 * Lo mismo, pero exigiendo que haya enlace. Para donde la imagen **es** el contenido, como un
 * flyer: un flyer sin imagen no es nada.
 */
export function exigirEnlace(valor) {
  const { enlace, error } = normalizarEnlace(valor);
  if (error) return { error };
  if (!enlace) return { error: 'Pega el enlace de la imagen.' };
  return { enlace };
}
