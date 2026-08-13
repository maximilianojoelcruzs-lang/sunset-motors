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

// ---------------------------------------------------------------------------
// Pegar el pedido entero
// ---------------------------------------------------------------------------
//
// Cargar treinta piezas de a una son treinta idas al servidor y treinta oportunidades de
// perder el hilo. Acá se pega la lista tal como la canta la tablet y se interpreta línea a
// línea; lo que sale se muestra en pantalla **antes** de guardar, porque un intérprete que
// adivina mal en silencio es peor que escribirlo a mano.

/** Cómo llama la gente a cada cosa. La tablet y el pedido no siempre usan el mismo nombre. */
const ALIAS = {
  'color-primario': ['color 1', 'primario', 'pintura primaria', 'color principal'],
  'color-secundario': ['color 2', 'secundario', 'pintura secundaria'],
  'color-perlado': ['perlado', 'perla', 'nacarado'],
  'color-llantas': ['color de rines', 'color rines', 'color ruedas'],
  'color-interior': ['interior', 'color del interior'],
  'color-tablero': ['tablero', 'color de tablero', 'salpicadero'],

  'tipo-rueda': ['tipo de ruedas', 'tipo rueda', 'set de ruedas'],
  llantas: ['rines', 'ruedas', 'aros'],
  neumaticos: ['ruedas de goma', 'gomas', 'cubiertas'],

  motor: ['motor mejorado', 'mejora de motor'],
  transmision: ['caja', 'caja de cambios'],
  frenos: ['freno'],
  suspension: ['suspensiones'],
  turbo: ['turbocompresor'],

  parachoques: ['paragolpes', 'bumper'],
  'parachoques-del': ['paragolpes delantero', 'parachoque delantero', 'bumper delantero'],
  'parachoques-tra': ['paragolpes trasero', 'parachoque trasero', 'bumper trasero'],
  faldon: ['faldones', 'faldones laterales', 'estribos laterales'],
  escape: ['tubo de escape', 'escapes', 'mofle'],
  rejilla: ['parrilla', 'mascara'],
  capo: ['capot', 'cofre'],
  techo: ['toldo'],
  aleron: ['spoiler', 'aleron trasero'],
  espejos: ['retrovisores', 'espejo'],
  guardabarros: ['guardabarro', 'guardafango', 'guardafangos'],
  estribos: ['bajos', 'estribo'],
  antenas: ['antena'],
  chasis: ['bastidor'],

  tinte: ['polarizado', 'polarizados', 'vidrios', 'ventanas', 'tinte de vidrios'],
  xenon: ['luces', 'luces xenon', 'faros'],
  neon: ['neones', 'luces neon'],
  claxon: ['bocina', 'corneta'],
  placa: ['matricula', 'patente', 'placas'],

  volante: ['manubrio', 'timon'],
  palanca: ['palanca de cambio', 'palanca'],
  asientos: ['asiento', 'butacas'],
};

const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Todos los nombres posibles, del más largo al más corto. El orden importa: si «Parachoques»
// se probara antes que «Parachoques delantero», todo delantero quedaría como parachoques a
// secas y el número apuntaría a otro submenú.
const NOMBRES = CATEGORIAS.flatMap((c) => [c.nombre, ...(ALIAS[c.id] ?? [])].map((n) => ({ id: c.id, clave: sinTildes(n) })))
  .sort((a, b) => b.clave.length - a.clave.length);

/** Lo que queda tras el nombre de la categoría: «: 4», « - 4», «= 4» son todos el 4. */
const valorDe = (resto) => resto.replace(/^[\s:=.\-–—>»)]+/, '').trim().slice(0, 40);

/**
 * Interpreta una línea del pedido. Devuelve `null` si es puro relleno.
 *
 * Lo que no reconoce **no se tira**: vuelve con `categoria: null` y el texto tal cual, que es
 * exactamente lo que hace la pantalla con una categoría escrita a mano. Perder una línea por
 * no entenderla sería el peor de los dos errores posibles.
 */
export function interpretarLinea(linea) {
  const cruda = String(linea ?? '')
    .replace(/^[\s•*·▪◦–—-]+/, '')
    .replace(/^\d+\s*[.)\-]\s+/, '')
    .trim();
  if (!cruda || /^-+$/.test(cruda)) return null;

  const plana = sinTildes(cruda);
  for (const { id, clave } of NOMBRES) {
    // Solo si lo que sigue no es otra letra: «Motor» no puede comerse «Motorizado».
    if (!plana.startsWith(clave) || /[a-z0-9]/.test(plana[clave.length] ?? '')) continue;
    return { categoria: id, etiqueta: null, valor: valorDe(cruda.slice(clave.length)) };
  }

  // Categoría desconocida. «Lo que sea: 4» y «Lo que sea 4» son la misma línea.
  const dosPuntos = cruda.indexOf(':');
  if (dosPuntos > 0) {
    return {
      categoria: null,
      etiqueta: cruda.slice(0, dosPuntos).trim().slice(0, 40),
      valor: valorDe(cruda.slice(dosPuntos + 1)),
    };
  }

  const cola = cruda.match(/^(.+?)[\s.:=\-]+(\d{1,3})$/);
  if (cola) return { categoria: null, etiqueta: cola[1].trim().slice(0, 40), valor: cola[2] };

  return { categoria: null, etiqueta: cruda.slice(0, 40), valor: '' };
}

/** El pedido pegado, línea por línea. Las vacías desaparecen; las demás se muestran. */
export const interpretarLista = (texto) =>
  String(texto ?? '')
    .split(/\r?\n/)
    .map(interpretarLinea)
    .filter(Boolean);
