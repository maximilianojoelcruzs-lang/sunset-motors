// Leer una captura de la bodega y compararla con lo que ya hay. **Sin tocar el almacén.**
//
// Aparte de lib/inventario.js porque la pantalla necesita esto en el navegador —la tabla de
// confirmación se pinta antes de mandar nada— y aquel arrastra lib/almacen.js, que usa node:fs.
// Mismo caso que tunning-categorias.js y fichas-limites.js.

export const MAX_NOMBRE = 60;
export const MAX_CANTIDAD = 99999;

/**
 * Con qué se reconoce un artículo entre dos capturas. **Por el peso, no por el nombre.**
 *
 * En la bodega del juego los nombres largos salen cortados: hay dos tarjetas distintas que se
 * leen «KIT DE REPARACI…», una de 28,00 kg y otra de 8,28 kg. Llevando el inventario por
 * nombre, esas dos se juntarían en una sola fila con la suma de las dos cantidades, y nadie lo
 * notaría hasta ir a buscar la pieza. El peso, en cambio, sale entero en todas las tarjetas.
 *
 * Si algún artículo llegara sin peso se cae al nombre, para no perderlo.
 */
export const claveDe = (a) =>
  a.peso ? `p:${Number(a.peso).toFixed(2)}` : `n:${normalizarNombre(a.nombre)}`;

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
  const porClave = new Map(actuales.map((a) => [claveDe(a), a]));
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

    const clave = claveDe({ nombre, peso });
    const antesEnLaTanda = yaSalio.get(clave);

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

    const antes = porClave.get(clave);
    const fila = !antes
      ? { nombre, peso, cantidad, clave, estado: 'nuevo' }
      : antes.cantidad !== cantidad
        ? {
            nombre: antes.nombre,
            peso,
            cantidad,
            clave,
            estado: 'cambia',
            antes: antes.cantidad,
            diferencia: cantidad - antes.cantidad,
          }
        : { nombre: antes.nombre, peso, cantidad, clave, estado: 'igual' };

    yaSalio.set(clave, fila);
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
  const salieron = new Set(filas.filter((f) => f.clave).map((f) => f.clave));
  return actuales
    .filter((a) => !salieron.has(claveDe(a)))
    .map((a) => ({
      nombre: a.nombre,
      peso: a.peso,
      cantidad: 0,
      clave: claveDe(a),
      estado: 'cambia',
      antes: a.cantidad,
      diferencia: -a.cantidad,
      noVisto: true,
    }));
}

/** Lo que de verdad se escribe: lo legible y sin contradicciones entre capturas. */
export const aplicables = (filas) =>
  filas.filter((f) => f.estado !== 'ilegible' && f.estado !== 'discrepa');
