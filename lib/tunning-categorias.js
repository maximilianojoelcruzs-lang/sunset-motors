// Las categorías del menú de tunning, **en el orden en que aparecen en el juego**.
//
// Ese orden es todo el truco de esta pantalla: es el catálogo entero el que se muestra, y se
// baja por él igual que se baja por el menú del juego, rellenando lo que el pedido trae. El
// pedido llega revuelto —primero un color, después un techo, después otro color— y seguirlo
// tal cual obliga a entrar y salir del mismo submenú una y otra vez.
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
  // El vinilo va con la pintura porque en el menú está ahí, pero **sin** `texto`: lo que se
  // elige es el número del diseño, no un color.
  { id: 'vinilo', nombre: 'Vinilo', grupo: 'Colores' },

  { id: 'tipo-rueda', nombre: 'Tipo de rueda', grupo: 'Ruedas' },
  { id: 'llantas', nombre: 'Llantas', grupo: 'Ruedas' },
  { id: 'neumaticos', nombre: 'Neumáticos', grupo: 'Ruedas' },
  // El humo va con las ruedas porque ahí está en el menú, pero lleva `texto` porque lo que se
  // elige es un color, no un número de submenú.
  { id: 'humo', nombre: 'Humo de neumático', grupo: 'Ruedas', texto: true },

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

/**
 * Ordena las piezas como el menú del juego, y dentro de cada categoría por número.
 *
 * Es lo que evita entrar y salir del mismo submenú: se baja una vez por sección y no se vuelve
 * atrás. Las hechas no se mueven de sitio — cambiar la lista bajo los ojos de alguien que está
 * trabajando es la forma más rápida de que instale la pieza equivocada.
 *
 * Vive acá y no en `tunning.js` para que el navegador use **la misma** función al colocar una
 * pieza recién añadida. Con una copia aparte, la fila aparecería en un sitio y saltaría a otro
 * en cuanto el servidor contestara.
 */
export const ordenar = (piezas) =>
  [...piezas].sort(
    (a, b) =>
      ordenDe(a.categoria) - ordenDe(b.categoria) ||
      String(a.valor).localeCompare(String(b.valor), 'es', { numeric: true })
  );
