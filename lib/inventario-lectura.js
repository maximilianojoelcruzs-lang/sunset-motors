// Leer una captura de la bodega y compararla con lo que ya hay. **Sin tocar el almacén.**
//
// Aparte de lib/inventario.js porque la pantalla necesita esto en el navegador —la tabla de
// confirmación se pinta antes de mandar nada— y aquel arrastra lib/almacen.js, que usa node:fs.
// Mismo caso que tunning-categorias.js y fichas-limites.js.

export const MAX_NOMBRE = 60;
export const MAX_CANTIDAD = 99999;

/**
 * Cómo se reconoce el mismo artículo entre dos capturas. **Por el nombre, casando prefijos.**
 *
 * Dos ideas anteriores se cayeron midiendo:
 *
 * 1. Por el peso, porque los nombres largos salen cortados. Pero el lector trae el peso con
 *    erratas —«36.00kg» leído «38.00kg»—, y un dígito mal convertía un artículo conocido en uno
 *    nuevo.
 * 2. Por el nombre exacto. Y **el corte depende del ancho de la ventana del juego**: la misma
 *    pieza sale «RAMPA DE REMO…» en una captura y «RAMPA DE REMOLQUE» en otra. Cada foto de un
 *    tamaño distinto creaba la colección entera otra vez. Es el fallo que se vio en producción.
 *
 * Así que se compara ignorando tildes y mayúsculas, y **un nombre cortado casa con cualquiera
 * que empiece igual**. Sin la marca de corte se exige igualdad: «FRENOS» y «FRENOS DE DISCO»
 * pueden ser dos piezas distintas de verdad, y juntarlas sería peor que separarlas.
 */
// Diez letras y no cinco: con cinco, «KIT DE…» casaba con «KIT DE PARCHE». En la bodega real
// el corte más corto medido son trece letras («RAMPA DE REMO»), así que diez no pierde ningún
// caso de verdad. Si algún día apareciera un corte más corto, se quedaría sin casar y saldría
// como artículo nuevo — molesto pero visible, mientras que juntar dos piezas distintas no se ve.
const MIN_PREFIJO = 10;

/** Separa el texto útil de la marca de corte: «RAMPA DE REMO…» → { base, truncado: true }. */
export function partesNombre(nombre) {
  const plano = String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  // El juego usa «...» y el lector a veces devuelve «…»; y a veces con espacio delante.
  const truncado = /(\.{2,}|…)$/.test(plano);
  return { base: plano.replace(/[\s.…]+$/, ''), truncado };
}

/** ¿Son la misma pieza? */
export function casanNombres(a, b) {
  const x = partesNombre(a);
  const y = partesNombre(b);
  if (!x.base || !y.base) return false;
  if (x.base === y.base) return true;

  const [corto, largo] = x.base.length <= y.base.length ? [x, y] : [y, x];
  // Solo el cortado puede ser prefijo del otro, y con letras suficientes para no juntar
  // «KIT DE…» con cualquier cosa que empiece por «KIT».
  return corto.truncado && corto.base.length >= MIN_PREFIJO && largo.base.startsWith(corto.base);
}

/** Agrupa solo para acelerar; el que manda es `casanNombres`. */
export const claveDe = (a) => partesNombre(a.nombre).base;

/**
 * ¿Dos pesos son «el mismo», contando con que el lector se equivoca de dígito?
 *
 * Un 20% de margen: «36 kg» leído «38 kg» es la misma pieza (5% de diferencia), y los dos
 * «KIT DE REPARACI…» de la bodega —28 kg y 8,28 kg— siguen siendo distintos por mucho.
 * Sin peso se responde que sí: ante la duda, no duplicar.
 */
export function pesosParecidos(a, b) {
  if (a == null || b == null) return true;
  return Math.abs(a - b) <= Math.max(a, b) * 0.2;
}

/** De entre varios candidatos, el del peso más parecido. Con uno solo, ese. */
export function masCercano(candidatos, peso) {
  if (candidatos.length <= 1 || peso == null) return candidatos[0] ?? null;
  return candidatos.reduce((mejor, c) =>
    Math.abs((c.peso ?? 0) - peso) < Math.abs((mejor.peso ?? 0) - peso) ? c : mejor
  );
}

export const normalizarNombre = (nombre) =>
  String(nombre ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOMBRE);

/**
 * «140x» → 140. Lo que no traiga ni un dígito vuelve `null`, no 0.
 *
 * La diferencia importa: `0` es una cantidad legítima —se acabó ese repuesto— y si una lectura
 * ilegible se colara como 0, cargar una captura borrosa vaciaría el stock de verdad sin que
 * nadie lo viera. Con `null` la fila sale marcada como ilegible y no se guarda.
 */
export function normalizarCantidad(valor) {
  const digitos = String(valor ?? '').replace(/[^\d]/g, '');
  if (!digitos) return null;
  const n = Number(digitos);
  return Number.isFinite(n) && n <= MAX_CANTIDAD ? n : null;
}

/**
 * «28.00kg» → 28 · «210g» → 0.21. Devuelve `null` si no se entiende, y manda el nombre.
 *
 * **La unidad hay que mirarla.** La bodega enseña las dos: los kits pesan kilos y el arrancador
 * 210 g. Quedándose solo con los dígitos, ese arrancador entraba como 210 kg — mal en pantalla,
 * y peor como clave, porque un artículo de 210 kg de verdad lo pisaría.
 */
export function normalizarPeso(valor) {
  const texto = String(valor ?? '').toLowerCase().replace(',', '.');
  const n = Number(texto.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;

  // «kg» primero: «210g» y «28.00kg» acaban los dos en «g».
  const enGramos = !texto.includes('kg') && texto.includes('g');
  return Math.round((enGramos ? n / 1000 : n) * 100) / 100;
}

/**
 * Compara lo leído contra lo que ya hay, **sin escribir nada**.
 *
 * `leidos` es el conjunto de **todas las capturas de una tanda**: la bodega no cabe en una
 * pantalla y hay que bajar y subir. Eso no complica nada porque la clave es el peso y no el
 * sitio en la rejilla: que dos fotos consecutivas repitan las mismas tarjetas es lo normal —es
 * el pegamento entre las dos— y la repetida se colapsa sola.
 *
 * Se separa de `aplicar()` a propósito: la pantalla enseña esto y recién después se guarda. Un
 * lector de imágenes que se equivoca en un dígito —140 por 40— deja el inventario mintiendo, y
 * eso no se descubre hasta que alguien va a la bodega a buscar algo que no está.
 */
export function comparar(leidos, actuales) {
  const usados = new Set();
  const yaSalio = new Map();
  const filas = [];

  for (const crudo of leidos) {
    const nombre = normalizarNombre(crudo.nombre);
    const cantidad = normalizarCantidad(crudo.cantidad);
    const peso = normalizarPeso(crudo.peso);

    if (!nombre || cantidad === null) {
      filas.push({ ...crudo, estado: 'ilegible' });
      continue;
    }

    const clave = claveDe({ nombre });
    // Se recorren los artículos en vez de mirar un mapa: la coincidencia es por prefijo, no por
    // igualdad, y con unas decenas de artículos el barrido no se nota.
    const libres = actuales.filter((a) => !usados.has(a.id) && casanNombres(a.nombre, nombre));
    const antes = masCercano(libres, peso);
    // La identidad de la fila es el artículo con el que casó; si es nuevo, el nombre más el
    // orden en que salió, para que dos tarjetas homónimas de una misma captura no se pisen.
    const id = antes?.id ?? `${clave}#${filas.filter((f) => f.clave?.startsWith(clave)).length}`;

    const antesEnLaTanda = yaSalio.get(id);
    if (antesEnLaTanda) {
      // Con el mismo número es el solape entre dos capturas: se calla y sigue. Con números
      // distintos hay que decirlo — o el lector falló, o las dos fotos son de momentos
      // distintos, y adivinar cuál vale sería inventarse el inventario.
      if (antesEnLaTanda.cantidad !== cantidad) {
        antesEnLaTanda.estado = 'discrepa';
        antesEnLaTanda.otra = cantidad;
      }
      continue;
    }

    if (antes) usados.add(antes.id);

    // Una tarjeta que aún no está en el inventario puede venir repetida en la misma tanda: el
    // lector la lee dos veces, una bien y otra con un dígito de menos, y antes entraban como
    // dos artículos («140» en una fila y «40» en otra). Mismo nombre y peso parecido es la
    // misma tarjeta; los dos «KIT DE REPARACI…» de verdad se distinguen por el peso.
    if (!antes) {
      const gemela = filas.find(
        (f) =>
          f.estado !== 'ilegible' &&
          !f.id &&
          casanNombres(f.nombre, nombre) &&
          pesosParecidos(f.peso, peso)
      );
      if (gemela) {
        if (gemela.cantidad !== cantidad) {
          gemela.estado = 'discrepa';
          gemela.otra = cantidad;
        }
        continue;
      }
    }

    const fila = !antes
      ? {
          nombre,
          leido: nombre,
          // El nombre entero que el lector dedujo mirando la foto. No casa nada: solo se
          // guarda para poder proponerlo después en el panel de nombres.
          sugerencia: normalizarNombre(crudo.sugerencia ?? ''),
          peso,
          cantidad,
          clave: id,
          id: null,
          estado: 'nuevo',
        }
      : antes.cantidad !== cantidad
        ? {
            nombre: antes.nombre,
            leido: nombre,
            sugerencia: normalizarNombre(crudo.sugerencia ?? ''),
            peso: antes.peso ?? peso,
            cantidad,
            clave: id,
            id: antes.id,
            estado: 'cambia',
            antes: antes.cantidad,
            diferencia: cantidad - antes.cantidad,
          }
        : {
            nombre: antes.nombre,
            leido: nombre,
            sugerencia: normalizarNombre(crudo.sugerencia ?? ''),
            peso: antes.peso ?? peso,
            cantidad,
            clave: id,
            id: antes.id,
            estado: 'igual',
          };

    yaSalio.set(id, fila);
    filas.push(fila);
  }

  return filas;
}

/**
 * Lo que el inventario tiene y esta tanda de capturas no vio.
 *
 * Es la única forma de saber si se recorrió la bodega entera o media. Se enseña aparte y no se
 * toca solo: declarar un conteo completo es una decisión de la persona —«sí, bajé hasta el
 * final»—, y las filas en cero pasan por la misma tabla de confirmación que el resto. Poner en
 * cero por omisión lo que no salió en la foto vaciaría el inventario con media captura.
 */
export function noVistos(actuales, filas) {
  const salieron = new Set(filas.map((f) => f.id).filter(Boolean));
  return actuales
    .filter((a) => !salieron.has(a.id))
    .map((a) => ({
      nombre: a.nombre,
      peso: a.peso,
      cantidad: 0,
      clave: a.id,
      id: a.id,
      estado: 'cambia',
      antes: a.cantidad,
      diferencia: -a.cantidad,
      noVisto: true,
    }));
}

/** Lo que de verdad se escribe: lo legible y sin contradicciones entre capturas. */
export const aplicables = (filas) =>
  filas.filter((f) => f.estado !== 'ilegible' && f.estado !== 'discrepa');
