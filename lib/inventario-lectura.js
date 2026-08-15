// Leer una captura de la bodega y compararla con lo que ya hay. **Sin tocar el almacén.**
//
// Aparte de lib/inventario.js porque la pantalla necesita esto en el navegador —la tabla de
// confirmación se pinta antes de mandar nada— y aquel arrastra lib/almacen.js, que usa node:fs.
// Mismo caso que tunning-categorias.js y fichas-limites.js.

export const MAX_NOMBRE = 60;
export const MAX_CANTIDAD = 99999;

/**
 * Con qué se agrupa un artículo entre dos capturas: **el nombre**.
 *
 * Empezó siendo el peso, porque en la bodega los nombres largos salen cortados y hay dos
 * tarjetas que se leen «KIT DE REPARACI…». Medido contra el lector, esa idea se cae: las
 * cantidades salen exactas pero **el peso se lee con erratas** —«36.00kg» leído como «38.00kg»,
 * «560g» como «580g»—. Con el peso de clave, un dígito mal convierte un artículo conocido en
 * uno nuevo y el inventario se llena de duplicados en cada conteo.
 *
 * Así que manda el nombre, y el peso solo desempata cuando dos artículos se llaman igual —y
 * por cercanía, no por igualdad exacta, justamente porque puede venir con una errata.
 */
export const claveDe = (a) => normalizarNombre(a.nombre).toLowerCase();

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
  // Por nombre; dentro de cada nombre pueden convivir varios (los «KIT DE REPARACI…»).
  const porNombre = new Map();
  for (const a of actuales) {
    const k = claveDe(a);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(a);
  }

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
    const libres = (porNombre.get(clave) ?? []).filter((a) => !usados.has(a.id));
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

    const fila = !antes
      ? { nombre, peso, cantidad, clave: id, id: null, estado: 'nuevo' }
      : antes.cantidad !== cantidad
        ? {
            nombre: antes.nombre,
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
