'use client';

import { PREMIOS } from '../../../lib/wager-limites';

const fichas = (n) => new Intl.NumberFormat('es-CL').format(n ?? 0);

/**
 * Las reglas del top, dentro de la propia pantalla.
 *
 * Estaban solo en una página publicada aparte, así que había que tener el enlace a mano para
 * saber cómo funciona lo que se está mirando. Acá se abren sobre la tabla y se cierran.
 *
 * Los premios salen de `wager-limites.js`, los mismos que usa el cierre del ciclo: escribir
 * «los 3 primeros» a mano acá es lo que dejaría las reglas mintiendo el día que alguien
 * agregue un cuarto premio.
 */

/* Los pasos del ciclo van numerados porque **son** una secuencia: se abre, se juega, se
   cierra, se paga. Numerar una lista que no lo es sería adorno. */
const PASOS = [
  {
    titulo: 'Se abre',
    texto:
      'Todos los contadores en cero. La fecha de apertura sale arriba, junto al total apostado.',
  },
  {
    titulo: 'Se juega',
    texto:
      'Cada apuesta suma en el momento. La tabla se pone al día sola cada veinte segundos: no ' +
      'hay que recargar para ver cómo te mueves.',
  },
  {
    titulo: 'Lo cierra el encargado',
    texto:
      'No hay fecha automática. El ciclo se cierra a mano, y hasta que se cierre todo lo que ' +
      'juegues sigue contando.',
  },
  {
    titulo: 'Te pagan en el juego',
    texto:
      'A cada uno del podio se le crea una solicitud de devolución con su premio, y el encargado ' +
      'se lo entrega en plata dentro del juego. Los contadores vuelven a cero y el podio queda ' +
      'guardado en Ciclos cerrados.',
  },
];

const REGLAS = [
  {
    titulo: 'Las recargas no cuentan',
    texto:
      'Que el encargado te dé fichas no sube tu wager ni un punto. Solo cuenta lo que pones en ' +
      'una mesa.',
  },
  {
    titulo: 'Empate: gana quien apostó más fuerte',
    texto:
      'Con el mismo wager queda por delante quien lo hizo en menos jugadas. Dos apuestas de ' +
      '1.000 le ganan a veinte de 100.',
  },
  {
    titulo: 'El puesto no se reserva',
    texto:
      'Cuenta lo que tengas en el instante en que se cierra el ciclo. Ir primero toda la semana ' +
      'no sirve de nada si te pasan la última noche.',
  },
  {
    titulo: 'Te dice cuánto te falta',
    texto:
      'Si estás fuera del podio, debajo de la tabla aparece cuántas fichas de wager necesitas ' +
      'para entrar.',
  },
];

/* Una tarde de dos personas: es lo que explica en tres segundos por qué el que ganó va
   último. Sin el ejemplo, «cuenta lo apostado, no lo ganado» se lee y no se entiende. */
const EJEMPLO = [
  { quien: 'Ana', mesa: 'ruleta', apuesta: 500, resultado: 'pierde', wager: 500 },
  { quien: 'Ana', mesa: 'ruleta', apuesta: 500, resultado: '+1.000', wager: 1000 },
  { quien: 'Ana', mesa: 'dados', apuesta: 1000, resultado: 'pierde', wager: 2000 },
  { quien: 'Bruno', mesa: 'blackjack', apuesta: 100, resultado: '+200', wager: 100 },
  { quien: 'Bruno', mesa: 'blackjack', apuesta: 100, resultado: '+200', wager: 200 },
];

export default function Reglas() {
  return (
    <section className="reglas" aria-label="Cómo funciona el top de wager">
      <p className="reglas-entrada">
        Cada ficha que apuestas en la sala cuenta para el ranking. No importa si ganas o si
        pierdes: importa <strong>cuánto has jugado</strong>. Los {PREMIOS.length} primeros al
        cerrar el ciclo se llevan un premio <strong>en plata del juego</strong>, no en fichas.
      </p>

      <div className="reglas-bloque">
        <h3 className="reglas-titulo">Qué es el wager</h3>
        {/* Acá va la versión larga, no `QUE_ES_WAGER`: esa frase ya está justo arriba, sobre la
            tabla, y repetirla palabra por palabra a dos dedos de distancia es ruido. */}
        <p className="reglas-texto">
          Wager es <strong>la suma de todo lo que apuestas</strong>. Pones 100 al rojo: tu wager
          sube 100, tanto si sale rojo como si sale negro. Vuelves a poner 100: van 200. Y así.
        </p>
        <p className="reglas-texto">
          Cuenta por igual en todas las mesas de la sala. Da lo mismo dónde juegues.
        </p>
      </div>

      <div className="reglas-bloque">
        <h3 className="reglas-titulo">Ganar no sube el wager</h3>
        <div className="reglas-tabla-caja">
          <table className="reglas-tabla">
            <thead>
              <tr>
                <th>Jugada</th>
                <th>Apuesta</th>
                <th>Resultado</th>
                <th>Wager</th>
              </tr>
            </thead>
            <tbody>
              {EJEMPLO.map((f, i) => (
                <tr key={i}>
                  <td>
                    {f.quien} · {f.mesa}
                  </td>
                  <td className="cifra">{fichas(f.apuesta)}</td>
                  <td className={f.resultado === 'pierde' ? 'pierde' : 'gana'}>{f.resultado}</td>
                  <td className="cifra">{fichas(f.wager)}</td>
                </tr>
              ))}
              <tr className="reglas-total">
                <td>Ana</td>
                <td>—</td>
                <td className="pierde">perdió fichas</td>
                <td className="cifra">2.000</td>
              </tr>
              <tr className="reglas-total">
                <td>Bruno</td>
                <td>—</td>
                <td className="gana">ganó fichas</td>
                <td className="cifra">200</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="reglas-texto">
          Ana va primera aunque acabó la tarde perdiendo, y Bruno último aunque ganó las dos
          manos. El ranking premia jugar, no acertar.
        </p>
      </div>

      <div className="reglas-bloque">
        <h3 className="reglas-titulo">Cómo va el ciclo</h3>
        <ol className="reglas-pasos">
          {PASOS.map((p) => (
            <li key={p.titulo}>
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="reglas-bloque">
        <h3 className="reglas-titulo">Reglas que conviene saber</h3>
        <ul className="reglas-lista">
          {REGLAS.map((r) => (
            <li key={r.titulo}>
              <strong>{r.titulo}</strong>
              <span>{r.texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="reglas-pie">
        Las fichas del casino son de rol: no se compran, no valen dinero de verdad y no se
        convierten en dinero de verdad. El premio del podio tampoco: se paga en plata
        <strong>del juego</strong>, como cualquier otra devolución del taller. El resultado de
        cada mesa lo sortea el
        servidor, nunca el navegador, y el cierre de cada ciclo queda anotado con el nombre de
        quien lo cerró.
      </p>
    </section>
  );
}
