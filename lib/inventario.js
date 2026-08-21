// El inventario de la bodega: qué hay y cuánto, actualizado desde capturas del juego.
//
//   { id, peso, nombre, cantidad, visto, vistoPor }
//
// Una captura **no es la bodega entera**: es la pantalla que se ve. Por eso cargar una captura
// es un upsert y no un reemplazo — lo que no sale en la foto se queda como estaba, con su fecha
// de «visto» sin tocar, que es justamente lo que permite darse cuenta de que hace días que
// nadie mira ese artículo.

import { cambiar, leer } from './almacen.js';
// `export *` reexporta, pero no trae los nombres al ámbito de este archivo: lo que se usa acá
// dentro hay que importarlo aparte.
import {
  aplicables,
  completar,
  normalizarCantidad,
  normalizarNombre,
  normalizarPeso,
  partesNombre,
} from './inventario-lectura.js';

// Se reexporta para que quien ya importa `lib/inventario.js` en el servidor no tenga que saber
// que la parte pura vive aparte.
export * from './inventario-lectura.js';

export const INVENTARIO = 'sunset:inventario';
export const CARGAS = 'sunset:inventario-cargas';

const MAX_CARGAS = 30;

export async function listar() {
  const todos = await leer(INVENTARIO);
  // Por nombre, que es como se busca una pieza; el peso solo desempata.
  return [...todos].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || (a.peso ?? 0) - (b.peso ?? 0)
  );
}

/**
 * Guarda las filas confirmadas. Upsert: lo que no venía en la captura no se toca.
 *
 * Una sola lectura y una sola escritura, aunque vengan cuarenta artículos: cada llamada al
 * almacén lee y reescribe la colección entera.
 */
export async function aplicar(usuario, filas) {
  const buenas = aplicables(filas);
  if (!buenas.length) return { error: 'No hay nada que actualizar.' };

  const cuando = new Date().toISOString();

  // Por `cambiar` y no con leer+guardar: dos personas contando la bodega a la vez —o la misma
  // subiendo dos capturas seguidas— se pisaban, y la segunda escritura borraba la primera.
  const resultado = await cambiar(INVENTARIO, (actuales) => {
    const porId = new Map(actuales.map((a) => [a.id, a]));

    let nuevos = 0;
    let cambiados = 0;

    for (const fila of buenas) {
      // La comparación ya decidió con qué artículo casa cada fila. Acá no se vuelve a adivinar:
      // si trae `id` y ese artículo existe, se actualiza; si no, es uno nuevo.
      const antes = fila.id ? porId.get(fila.id) : null;
      const cantidad = normalizarCantidad(fila.cantidad);
      const nombre = normalizarNombre(fila.nombre);
      if (cantidad === null || !nombre) continue;

      if (!antes) {
        nuevos += 1;
        const id = crypto.randomUUID();
        porId.set(id, {
          id,
          nombre,
          // Lo que el lector dedujo mirando la foto. Se guarda pero **no se aplica**: el nombre
          // sigue siendo el literal hasta que una persona acepte la propuesta.
          sugerido: completar(nombreLeido(fila), fila.sugerencia),
          peso: normalizarPeso(fila.peso) ?? null,
          cantidad,
          visto: cuando,
          vistoPor: usuario,
        });
        continue;
      }

      if (antes.cantidad !== cantidad) cambiados += 1;
      // **El peso guardado no se toca**: el lector lo trae con erratas y solo sirve para
      // desempatar homónimos.
      //
      // El nombre tampoco, salvo en un caso: si el guardado está cortado y llega uno entero que
      // empieza igual, se queda el entero. Así una captura con la ventana más ancha arregla los
      // «RAMPA DE REMO…» que dejó una anterior, en vez de que el nombre se quede a medias para
      // siempre. Un nombre escrito a mano nunca está cortado, así que no se pisa.
      const guardado = partesNombre(antes.nombre);
      const llega = partesNombre(nombreLeido(fila));
      const mejora =
        guardado.truncado && !llega.truncado && llega.base.startsWith(guardado.base)
          ? nombreLeido(fila)
          : antes.nombre;

      porId.set(antes.id, {
        ...antes,
        nombre: mejora,
        // La sugerencia se refresca aunque el nombre no cambie: una captura mejor puede traer una
        // deducción mejor, y solo se aplicará si alguien la acepta.
        sugerido: completar(nombreLeido(fila), fila.sugerencia) || antes.sugerido || '',
        cantidad,
        visto: cuando,
        vistoPor: usuario,
      });
    }

    return {
      lista: [...porId.values()],
      valor: { nuevos, cambiados, total: buenas.length },
    };
  });

  // La carga se anota **después** de que el inventario quedó guardado: apuntar una carga que
  // no se aplicó sería peor que no apuntarla.
  if (!resultado.error) {
    await anotarCarga({
      usuario,
      cuando,
      nuevos: resultado.nuevos,
      cambiados: resultado.cambiados,
      total: buenas.length,
    });
  }

  return resultado;
}

/** El nombre tal como vino de la captura, no el que ya estaba guardado. */
const nombreLeido = (fila) => normalizarNombre(fila.leido ?? fila.nombre);

/** Quién cargó qué y cuándo. Un inventario sin rastro de quién lo tocó no se puede discutir. */
async function anotarCarga(carga) {
  const fila = { id: crypto.randomUUID(), ...carga };
  await cambiar(CARGAS, (lista) => ({
    lista: [fila, ...lista].slice(0, MAX_CARGAS),
    valor: { ok: true },
  }));
}

export async function listarCargas() {
  return leer(CARGAS);
}

/** Corregir a mano: el nombre cortado por el juego, o una cantidad que la foto leyó mal. */
export async function corregir(id, { nombre, cantidad }) {
  return cambiar(INVENTARIO, (lista) => {
    const i = lista.findIndex((a) => a.id === id);
    if (i === -1) return { error: 'Ese artículo no existe.' };

    const copia = [...lista];
    const limpio = normalizarNombre(nombre ?? copia[i].nombre);
    const cuantos = cantidad === undefined ? copia[i].cantidad : normalizarCantidad(cantidad);
    if (!limpio) return { error: 'El artículo necesita un nombre.' };
    if (cuantos === null) return { error: 'La cantidad no es un número válido.' };

    copia[i] = { ...copia[i], nombre: limpio, cantidad: cuantos };
    return { lista: copia, valor: { articulo: copia[i] } };
  });
}

/**
 * Renombra varios de una vez: una lectura y una escritura, no una por artículo.
 *
 * Lo usa el completado de nombres cortados, que toca doce filas de golpe.
 */
export async function corregirVarios(cambios) {
  return cambiar(INVENTARIO, (lista) => {
    const porId = new Map(lista.map((a) => [a.id, a]));
    let tocados = 0;

    for (const { id, nombre } of cambios) {
      const antes = porId.get(id);
      const limpio = normalizarNombre(nombre);
      if (!antes || !limpio || limpio === antes.nombre) continue;
      porId.set(id, { ...antes, nombre: limpio });
      tocados += 1;
    }

    // Sin nada que tocar no se escribe: `cambiar` devuelve el valor igual.
    if (!tocados) return { lista: null, valor: { tocados: 0 } };
    return { lista: [...porId.values()], valor: { tocados } };
  });
}

export async function borrar(id) {
  return cambiar(INVENTARIO, (lista) => {
    if (!lista.some((a) => a.id === id)) return { error: 'Ese artículo no existe.' };
    return { lista: lista.filter((a) => a.id !== id), valor: { ok: true } };
  });
}
