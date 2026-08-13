// Las categorías del menú de tunning, **en el orden en que aparecen en el juego**.
//
// Ese orden es todo el truco de esta pantalla. El pedido llega revuelto —primero un color,
// después un techo, después otro color— y seguirlo tal cual obliga a entrar y salir del
// mismo submenú una y otra vez. Ordenando la lista igual que el menú, se baja una sola vez
// por cada sección y no se vuelve atrás.
//
// `orden` no se escribe: es la posición en este arreglo. Mover una categoría de sitio acá
// cambia el orden de trabajo en toda la app.
//
// Aparte de lib/tunning.js porque la pantalla lo necesita en el navegador y aquel arrastra
// lib/almacen.js, que usa node:fs.

/**
 * `texto: true` marca las que no llevan número sino una descripción —los colores, que en el
 * pedido vienen como «METÁLICO - RGB(84,118,204)»—. El resto son el número que hay que
 * elegir dentro del submenú, que es lo único que se mira mientras se instala.
 */
export const CATEGORIAS = [
  { id: 'color-primario', nombre: 'Color primario', grupo: 'Colores', texto: true },
  { id: 'color-secundario', nombre: 'Color secundario', grupo: 'Colores', texto: true },
  { id: 'color-perlado', nombre: 'Color perlado', grupo: 'Colores', texto: true },
  { id: 'color-llantas', nombre: 'Color de llantas', grupo: 'Colores', texto: true },
  { id: 'color-interior', nombre: 'Color interior', grupo: 'Colores', texto: true },
  { id: 'color-tablero', nombre: 'Color del tablero', grupo: 'Colores', texto: true },

  { id: 'tipo-rueda', nombre: 'Tipo de rueda', grupo: 'Ruedas' },
  { id: 'llantas', nombre: 'Llantas', grupo: 'Ruedas' },
  { id: 'neumaticos', nombre: 'Neumáticos', grupo: 'Ruedas' },

  { id: 'motor', nombre: 'Motor', grupo: 'Mecánica' },
  { id: 'transmision', nombre: 'Transmisión', grupo: 'Mecánica' },
  { id: 'frenos', nombre: 'Frenos', grupo: 'Mecánica' },
  { id: 'suspension', nombre: 'Suspensión', grupo: 'Mecánica' },
  { id: 'turbo', nombre: 'Turbo', grupo: 'Mecánica' },

  { id: 'parachoques', nombre: 'Parachoques', grupo: 'Carrocería' },
  { id: 'parachoques-del', nombre: 'Parachoques delantero', grupo: 'Carrocería' },
  { id: 'parachoques-tra', nombre: 'Parachoques trasero', grupo: 'Carrocería' },
  { id: 'faldon', nombre: 'Faldón', grupo: 'Carrocería' },
  { id: 'escape', nombre: 'Escape', grupo: 'Carrocería' },
  { id: 'rejilla', nombre: 'Rejilla', grupo: 'Carrocería' },
  { id: 'capo', nombre: 'Capó', grupo: 'Carrocería' },
  { id: 'techo', nombre: 'Techo', grupo: 'Carrocería' },
  { id: 'aleron', nombre: 'Alerón', grupo: 'Carrocería' },
  { id: 'espejos', nombre: 'Espejos', grupo: 'Carrocería' },
  { id: 'guardabarros', nombre: 'Guardabarros', grupo: 'Carrocería' },
  { id: 'estribos', nombre: 'Estribos', grupo: 'Carrocería' },
  { id: 'antenas', nombre: 'Antenas', grupo: 'Carrocería' },
  { id: 'chasis', nombre: 'Chasis', grupo: 'Carrocería' },

  { id: 'tinte', nombre: 'Tinte de ventanas', grupo: 'Detalles' },
  { id: 'xenon', nombre: 'Xenón', grupo: 'Detalles' },
  { id: 'neon', nombre: 'Neón', grupo: 'Detalles' },
  { id: 'claxon', nombre: 'Claxon', grupo: 'Detalles' },
  { id: 'placa', nombre: 'Placa', grupo: 'Detalles' },

  { id: 'volante', nombre: 'Volante', grupo: 'Interior' },
  { id: 'palanca', nombre: 'Palanca de cambios', grupo: 'Interior' },
  { id: 'asientos', nombre: 'Asientos', grupo: 'Interior' },
];

export const GRUPOS = [...new Set(CATEGORIAS.map((c) => c.grupo))];

export const categoria = (id) => CATEGORIAS.find((c) => c.id === id) ?? null;

/**
 * Dónde va una pieza en el orden de trabajo. Lo que no está en el catálogo —una categoría
 * que el servidor tenga y acá no— se va al final en vez de perderse.
 */
export const ordenDe = (id) => {
  const i = CATEGORIAS.findIndex((c) => c.id === id);
  return i === -1 ? CATEGORIAS.length : i;
};

/** El nombre que se lee y se canta. Las de fuera del catálogo llevan el suyo escrito. */
export const nombreDe = (pieza) => categoria(pieza.categoria)?.nombre ?? pieza.etiqueta;
