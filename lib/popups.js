// Pop-ups: el cartel que sale al entrar a la app.
//
//   { id, titulo, texto, imagen, hasta, creado, creadoPor, activo }
//
// Para lo que hay que leer **antes** de ponerse a trabajar: «hoy cerramos a las 22», «el
// elevador 2 está malo». La campanita sirve para avisar de algo que pasó; esto es para algo
// que hay que ver sí o sí, y por eso tapa la pantalla.
//
// `hasta` es el **tiempo límite**: pasado ese momento el cartel ya no le sale a nadie. Es lo
// que hace que la función se pueda usar sin tener que acordarse de apagarla — un anuncio de
// «hoy cerramos temprano» que sigue saliendo el martes siguiente enseña a la gente a cerrar
// los pop-ups sin leerlos.

import { cambiar, leer } from './almacen.js';
import { normalizarEnlace } from './enlaces.js';

export const POPUPS = 'sunset:popups';

export const MAX_TITULO = 80;
export const MAX_TEXTO = 600;

/** Cuánto se conserva lo ya vencido, para poder volver a usarlo o mirar qué se anunció. */
const MAX_GUARDADOS = 40;

/** ¿Sigue en pie? Sin `hasta` no caduca; con `hasta` pasado, ya no sale. */
export const vigente = (p, ahora = Date.now()) =>
  p.activo !== false && (!p.hasta || Date.parse(p.hasta) > ahora);

const ordenar = (lista) => [...lista].sort((a, b) => b.creado.localeCompare(a.creado));

function validar({ titulo, texto, hasta }) {
  if (typeof titulo !== 'string' || !titulo.trim()) return 'Ponle un título.';
  if (typeof texto !== 'string' || !texto.trim()) return 'Escribe el mensaje.';
  if (hasta) {
    if (Number.isNaN(Date.parse(hasta))) return 'La fecha del tiempo límite no es válida.';
    // Un límite ya pasado deja el cartel muerto al nacer, y quien lo escribió creería que se
    // está mostrando. Vale la pena decirlo en vez de guardarlo.
    if (Date.parse(hasta) <= Date.now()) return 'Ese tiempo límite ya pasó. Pon uno futuro.';
  }
  return null;
}

/** Todos, incluidos los vencidos. Es lo que ve el encargado. */
export async function listar() {
  return ordenar(await leer(POPUPS));
}

/** Los que hay que mostrar ahora. Es lo único que sale hacia el navegador de cualquiera. */
export async function listarVigentes() {
  const ahora = Date.now();
  return ordenar((await leer(POPUPS)).filter((p) => vigente(p, ahora))).map(
    ({ id, titulo, texto, imagen, hasta }) => ({ id, titulo, texto, imagen, hasta })
  );
}

export async function crear(usuario, datos) {
  const error = validar(datos);
  if (error) return { error };

  const { enlace, error: malEnlace } = normalizarEnlace(datos.imagen);
  if (malEnlace) return { error: malEnlace };

  // Fuera del cambio: un reintento tiene que guardar este mismo cartel, no otro.
  const popup = {
    id: crypto.randomUUID(),
    titulo: datos.titulo.trim().slice(0, MAX_TITULO),
    texto: datos.texto.trim().slice(0, MAX_TEXTO),
    imagen: enlace,
    hasta: datos.hasta ? new Date(datos.hasta).toISOString() : null,
    activo: true,
    creado: new Date().toISOString(),
    creadoPor: usuario,
  };

  return cambiar(POPUPS, (lista) => ({
    lista: [popup, ...lista].slice(0, MAX_GUARDADOS),
    valor: { popup },
  }));
}

export async function editar(id, datos) {
  return cambiar(POPUPS, (lista) => {
    const i = lista.findIndex((p) => p.id === id);
    if (i === -1) return { error: 'Ese pop-up no existe.' };

    const mezcla = { ...lista[i], ...datos };
    const error = validar(mezcla);
    if (error) return { error };

    let imagen = lista[i].imagen ?? null;
    if (datos.imagen !== undefined) {
      const limpio = normalizarEnlace(datos.imagen);
      if (limpio.error) return { error: limpio.error };
      imagen = limpio.enlace;
    }

    const copia = [...lista];
    copia[i] = {
      ...copia[i],
      titulo: mezcla.titulo.trim().slice(0, MAX_TITULO),
      texto: mezcla.texto.trim().slice(0, MAX_TEXTO),
      imagen,
      hasta: mezcla.hasta ? new Date(mezcla.hasta).toISOString() : null,
    };
    return { lista: copia, valor: { popup: copia[i] } };
  });
}

/** Apagar o volver a encender sin borrar: el texto se queda para reutilizarlo. */
export async function alternar(id, activo) {
  return cambiar(POPUPS, (lista) => {
    const i = lista.findIndex((p) => p.id === id);
    if (i === -1) return { error: 'Ese pop-up no existe.' };

    const copia = [...lista];
    copia[i] = { ...copia[i], activo: Boolean(activo) };
    return { lista: copia, valor: { popup: copia[i] } };
  });
}

export async function borrar(id) {
  return cambiar(POPUPS, (lista) => {
    if (!lista.some((p) => p.id === id)) return { error: 'Ese pop-up no existe.' };
    return { lista: lista.filter((p) => p.id !== id), valor: { ok: true } };
  });
}
