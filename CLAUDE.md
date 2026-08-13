# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm start        # servir el build (necesita SUNSET_SECRETO definida)

npm run usuarios listar
npm run usuarios crear <usuario> <clave> -- --admin   # el -- pasa la bandera a través de npm
```

La base parte vacía: sin crear un usuario no se puede entrar ni siquiera en local.

**Nunca corras `npm run build` con el dev server encendido.** Los dos escriben en `.next` y el
build de producción le cambia los chunks debajo al de desarrollo; el síntoma es un
`Cannot find module './###.js'` en el navegador. Se arregla con `rm -rf .next` y relanzar.

No hay linter, tests ni TypeScript configurados. El único chequeo real es `npm run build`.

Para probar el login end-to-end sin navegador, levanta el dev server con una clave explícita y
ejerce las rutas con curl guardando la cookie (`curl -c/-b`): `GET /` sin cookie debe dar 307 a
`/login`, `POST /api/login` con clave mala 401, y una cookie con el payload alterado debe volver
a redirigir.

## Qué es

Calculadora de cobros del taller Sunset Motors (juego de rol). Next.js 15 App Router + React 19,
JavaScript puro, sin dependencias más allá de Next/React. El cálculo entero corre en el cliente:
no hay base de datos ni persistencia — las cantidades viven en `useState` y mueren al cerrar la
pestaña. Lo único que toca el servidor es el login.

Requiere la variable de entorno `SUNSET_SECRETO` en producción (ver más abajo).

## Arquitectura

La calculadora:

- **[lib/catalogo.js](lib/catalogo.js)** — `SECCIONES` (la semilla de precios, ver abajo), más
  `COMANDOS`, `CODIGOS` y `TINTES`, que sí son fijos.
- **[app/boleta.js](app/boleta.js)** — un solo componente cliente (`'use client'`) con toda la
  lógica: filtro de búsqueda, acordeón de secciones, contadores, subtotales, total animado y
  exportación a texto. Recibe `nombre` por props.
- **[app/page.js](app/page.js)** — componente servidor mínimo: lee la cookie de sesión y le pasa
  el nombre a `<Boleta>`. Nada más.
- **[app/globals.css](app/globals.css)** — CSS plano, sin framework. Paleta y tipografías por
  variables CSS en `:root`; las fuentes se inyectan desde [app/layout.js](app/layout.js) como
  `--font-ui`, `--font-data`, `--font-stencil`.

El acceso:

- **[middleware.js](middleware.js)** — corre en Edge; sin cookie válida redirige todo a `/login`.
  El `matcher` excluye `login`, `api/login` y estáticos. Si agregas una ruta que deba ser pública,
  va en ese `matcher`, no en un chequeo aparte.
- **[lib/usuarios.js](lib/usuarios.js)** — alta, baja, verificación y rol, todo contra la base.
- **[lib/sesion.js](lib/sesion.js)** — firma y verifica la cookie con HMAC-SHA256 vía Web Crypto.
  Web Crypto y no `node:crypto` **a propósito**: el mismo módulo tiene que correr en Edge
  (middleware) y en Node (route handlers). Es el único de `lib/` que el middleware puede importar.
- **[scripts/usuarios.mjs](scripts/usuarios.mjs)** — administración por terminal. Los parámetros
  PBKDF2 están en [lib/hash.mjs](lib/hash.mjs) para que script y app no se desincronicen; subir
  `ITERACIONES` invalida todos los hashes existentes.
- **[app/admin/mecanicos.js](app/admin/mecanicos.js)** — la misma administración desde el panel.

`package.json` declara `"type": "module"` para que `scripts/usuarios.mjs` pueda importar `lib/`
directamente. Por eso los imports relativos dentro de `lib/` **llevan extensión** (`./almacen.js`):
webpack acepta ambas formas, Node exige la explícita.

### Cómo funcionan usuarios y sesión

**Las cuentas viven en la base de datos, no en el código.** `lib/usuarios.js` es la capa de
acceso, no la lista: guarda `{ usuario, sal, hash, admin }` con PBKDF2-SHA256 (200k iteraciones,
sal de 16 bytes). Todas sus funciones son asíncronas porque consultan el almacén.

Esa decisión es la que permite publicar el repositorio sin exponer hashes, y dar de alta gente sin
volver a desplegar. Si alguna vez se te ocurre "simplificar" volviendo a una lista fija en el
código, estarías deshaciendo justamente eso.

Bootstrap: la base parte vacía y sin usuarios no entra nadie. El primer administrador se crea con
`npm run usuarios crear <u> <c> -- --admin`; `scripts/usuarios.mjs` lee `.env.local` para poder
apuntar a la base de producción desde la máquina de uno. El login responde **503** con un mensaje
propio cuando no hay usuarios, en vez de un 401 confuso.

**El secreto de firma es aparte de las claves.** `SUNSET_SECRETO` firma las cookies; los hashes de
usuario no participan. Cambiar `SUNSET_SECRETO` cierra todas las sesiones abiertas. Sin esa
variable: en desarrollo cae a un valor fijo; en producción `secretoFirma()` devuelve `null` y
**nadie puede entrar** — fallo cerrado intencional.

Detalles que parecen accidentes pero no lo son:

- El usuario se compara y se guarda en minúsculas, la clave no.
- `verificarUsuario()` deriva el hash igual cuando el usuario no existe, con una sal de relleno,
  para no delatar por tiempo de respuesta qué usuarios son válidos. No borres esa rama.
- El login responde el mismo `Usuario o clave incorrectos.` en ambos casos de fallo.
- `borrarUsuario()` y `cambiarRol()` se niegan a dejar el sistema sin ningún administrador.
- La API de usuarios nunca devuelve `sal` ni `hash`: los filtra con `publico()`.
- Un admin no puede borrarse ni quitarse el rol a sí mismo — se quedaría fuera del panel a mitad
  de sesión, sin aviso. Tampoco puede sacarse del taller.
- **`cambiarClave()` reemplaza la sal y el hash, no la ficha entera.** Escribir encima con
  `fichaNueva()` borraba `casino`, `taller` y `discord`, porque esa función solo devuelve
  `{ usuario, sal, hash, admin }`. Un invitado del casino que cambiaba su clave aparecía en la
  calculadora del taller y no podía volver al casino. Pasó en producción. Cualquier campo nuevo
  de la ficha se conserva solo mientras se siga escribiendo `{ ...copia[i], sal, hash }`.

### El rol NO se comprueba en el middleware

`middleware.js` corre en Edge y **no puede leer la base** (`lib/almacen.js` usa `node:fs`).
Por eso el middleware solo verifica que haya sesión, y la autorización vive en
`app/admin/page.js` y en cada route handler, que corren en Node.

No muevas `esAdmin()` al middleware: rompe el build. Y no lo guardes en la cookie para poder
hacerlo: quitarle el rol a alguien dejaría de surtir efecto hasta que caduque su sesión.

## Casino (fachada)

**[app/casino/](app/casino/)** — otro producto dentro de la misma app: entretención de rol, sin
dinero real. **Por ahora es solo la vista**: no hay ningún juego, y las fichas que muestra son
una constante escrita a mano en `casino.js`.

### Cuatro categorías, no una escala

`admin`, `casino` y `taller` son banderas **independientes**. De ahí salen cuatro cuentas:

| | `admin` | `casino` | `taller` | Entra a |
|---|---|---|---|---|
| Mecánico | | | | solo el taller |
| Invitado del casino | | ✔ | | solo el casino |
| Mecánico con casino | | ✔ | ✔ | a las dos, con botón para cambiar |
| Administrador | ✔ | | | a todo, más el panel |

**`taller` solo significa algo junto a `casino`.** Un mecánico común no la trae y no le hace
falta: sin `casino`, ya está en el taller. Va como bandera aparte y no cambiando el sentido de
`casino` porque **las cuentas que ya existen no la traen**: sin `taller`, un invitado del casino
sigue siendo solo del casino, exactamente como antes. Nadie gana ni pierde acceso por desplegar.

- `esCasino()` — puede ver el casino (los admin también).
- `soloCasino()` — casino sin admin y sin taller: no tiene nada que hacer en el taller.
- `accesosDe()` — las tres puertas de una sola lectura del almacén. Es lo que usan las páginas.

**`cambiarCasino(u, true)` deja también el taller** a quien lo tenía. Si no, dar el casino a un
mecánico lo echaría de la calculadora sin que nadie lo pidiera. Para dejar a alguien solo de
casino está `cambiarTaller(u, false)`, que es explícito.

`POST /api/login` devuelve un `destino` según la categoría, y el login redirige ahí.

**Toda página del taller empieza con `sesionDeTaller()`** ([lib/servidor.js](lib/servidor.js)),
que manda al login a quien no tenga sesión y al casino a quien sea solo de casino. Si agregas una
página del taller y usas `sesionActual()` en su lugar, un invitado del casino la va a ver.

El chequeo va ahí y no en el middleware por lo de siempre: el rol se consulta contra la base y el
middleware corre en Edge.

### El botón de cambiar de vista, y por qué los accesos bajan por props

`<Barra accesos={{ casino, taller }}>` enseña el botón solo cuando se puede entrar a las dos
vistas. La barra **no lo consulta sola**: cada página llama a `accesosDe()` y lo pasa hacia
abajo, igual que `admin`. Podría pedirlo por `fetch` al montarse, pero entonces el botón
aparecería un instante después de la página; y no puede ir en la cookie, por lo de siempre —
quitarle un acceso a alguien no surtiría efecto hasta que caduque su sesión.

`variante` es **en qué vista estamos**; `accesos` es **a cuáles se puede entrar**. Confundir las
dos es lo que dejaba a un mecánico con casino sin puerta de vuelta: la barra del casino escondía
todos los enlaces del taller porque asumía que quien está en el casino solo tiene casino.

Si añades una página con barra, pásale `accesos`. Sin la prop, el valor por omisión reproduce lo
de antes (taller para todos, casino para los admin), así que el fallo no se ve hasta que un
mecánico con casino abre justo esa página.

### Reglas del casino que no se negocian

**El resultado lo saca el servidor. Siempre.** Si un juego se resolviera en el navegador,
cualquiera con las herramientas de desarrollo se declara ganador. El cliente manda *qué y cuánto
apuesta*; recibe el resultado ya sorteado y lo anima. La rueda de la ruleta gira **hacia** el
número que ya vino, no al revés.

**El saldo también.** `lib/fichas.js` descuenta y paga en una sola operación (`resolver()`), y
nunca acepta un saldo que venga del cliente. Si el descuento se hiciera allá, bastaría con no
llamar a la API para jugar gratis.

**`girar()` descarta el sobrante en vez de repartirlo.** Un `% 37` sobre un byte tendría sesgo
—256 no es múltiplo de 37— y los números bajos saldrían un pelo más seguido. Verificado con un
millón de tiradas: chi-cuadrado 32,7 con 36 grados de libertad (crítico 51,0).

### La ventaja de la casa está en los pagos, no en trampas

Ruleta europea: 37 casillas, pero los pagos se calculan como si hubiera 36. De ahí sale el
**2,70% en todas las apuestas por igual** — pleno, rojo o docena dan el mismo 97,30% de retorno.
Medido con un millón de tiradas por tipo de apuesta y coincide con lo teórico.

Nadie "ajusta" nada ni hay que hacerlo. Si algún día alguien quiere subir la ventaja, se cambia
el pago, no el sorteo. Con doble cero (americana) sería 5,26%; no se usa porque es peor para
quien juega y no aporta nada.

### El pago de la ruleta sale de una fórmula, no de una tabla

`pagaDe(cuantos) = 36 / cuantos − 1`. De ahí salen los 35:1 del pleno, los 17:1 del caballo y los
2:1 de la docena, y por eso **ninguna apuesta puede quedar descuadrada respecto de las otras**:
todas dan exactamente 2,7027%. Una tabla escrita a mano se desincroniza en cuanto alguien agrega
una apuesta; la fórmula no.

Las 145 apuestas interiores (37 plenos, 60 caballos, 12 calles, 22 cuadros, 11 seisenas, 2 tríos
y los cuatro primeros) **se generan**, no están escritas a mano. A mano se olvida alguna y, peor,
se cuela alguna que en una mesa real no existe. Cada una trae **dónde va la ficha en el paño**, y
eso es parte del juego y no de la pantalla: en una mesa de verdad el sitio donde se pone la ficha
*es* la apuesta. `app/casino/ruleta/pano.js` dibuja una rejilla donde las casillas **y los bordes
entre casillas** son pistas propias, y coloca cada sitio en las coordenadas que trae el catálogo.

**El navegador manda el sitio de cada ficha, nunca la lista de números.** Si mandara los números,
se podría pedir un «caballo» entre el 1 y el 36 y cobrar 17:1 por dos números que no se tocan. El
servidor busca el sitio por su identificador y de ahí saca a qué cubre y cuánto paga.

Se apuesta a varios sitios en la misma tirada; el cuerpo es `{ apuestas: [{ id, monto }] }`. Se
valida cada ficha por separado y **la suma contra el saldo**, y se rechaza el mismo sitio dos
veces: si no, dos fichas al mismo lugar contarían distinto según cómo se sumaran.

### Cada mesa y su retorno, todos verificados por muestreo

| Mesa | Juego | Retorno | Ventaja de la casa |
|---|---|---|---|
| [lib/ruleta.js](lib/ruleta.js) | Ruleta europea | 97,30% | 2,70% en todas las apuestas |
| [lib/dados.js](lib/dados.js) | Sic Bo, 3 dados | varía | 2,78% las sencillas · hasta 16,2% los triples |
| [lib/rasca.js](lib/rasca.js) | Raspadito | 92,00% | 8,00% |
| [lib/tragamonedas.js](lib/tragamonedas.js) | 3 rodillos, 1 línea | 94,27% | 5,73% |
| [lib/poker.js](lib/poker.js) | Vídeo póker, Jacks or Better 9/6 | hasta 99,5% | 0,5% con juego perfecto |
| [lib/blackjack.js](lib/blackjack.js) | Blackjack, 6 mazos S17 | ~99,4% | ~0,5% con estrategia básica |
| [lib/plinko.js](lib/plinko.js) | Plinko, 12 filas | ~97,0% | ~3,0% en los tres riesgos |
| [lib/surf.js](lib/surf.js) | Carrera de surf | 95,00% | 5,00% en los seis surfistas |
| [lib/duelo.js](lib/duelo.js) | Duelo de cartas (Dragon Tiger) | 96,3% / 88,8% | 3,70% al bando · 11,25% al empate |
| [lib/fortuna.js](lib/fortuna.js) | Ruleta de la suerte, 40 gajos | 97,50% | 2,50% |
| [lib/mines.js](lib/mines.js) | Mines, 25 casillas | 97,00% | 3,00% te plantes donde te plantes |

Los números salen de tablas de pago reales, no inventadas. Antes de tocar cualquiera,
compruébalo por muestreo: medio millón de tiradas basta para ver si la ventaja se movió.

En el póker y el blackjack el retorno **depende de cómo se juegue**, no solo de la tabla: son los
únicos dos donde las decisiones de la persona mueven el margen. Por eso las cifras dicen «con
juego perfecto» y no son una promesa.

**Rasca:** el premio se sortea primero de la tabla de pesos y el cartón se arma después para
contar esa historia — como un raspadito de papel, que viene impreso de fábrica. `armarCarton()`
garantiza que un cartón sin premio no forme un trío por accidente, y que uno premiado forme
exactamente uno. Cada premio lleva su propio `simbolo` en la tabla: deducirlo del índice hacía
que los dos premios más altos compartieran símbolo y la tabla se contradijera.

**Dados:** cada apuesta muestra su ventaja real en pantalla, y varían mucho (2,78% contra 16,2%).
Eso es deliberado: en una mesa de verdad las apuestas vistosas son las malas, y esconderlo sería
menos honesto que mostrarlo.

**Tragamonedas:** los rodillos llevan **pesos**, que es como funcionan las máquinas reales — el 7
es raro porque hay pocos sietes en la cinta, no porque el programa corrija el resultado al final.
El premio de «dos cerezas» existe para subir la frecuencia de premio del 5,5% al 24%: sin él la
máquina se siente muerta aunque el retorno sea el mismo. `retornoTeorico()` calcula el RTP desde
la tabla, así que si tocas un peso o un pago, la pantalla muestra el número nuevo sola.

### Las tablas que se calculan solas

Tres mesas nuevas siguen el mismo principio que la ruleta — **el pago sale de una fórmula, no
de una tabla escrita a mano** — y por eso ninguna puede quedar descuadrada:

- **Plinko** ([lib/plinko.js](lib/plinko.js)): `pago(k) ∝ (1/probabilidad(k)) ^ dureza`, escalado
  para que el retorno sea 97%. `dureza` es lo único que separa las tres tablas de riesgo. A mano
  se descuadró en el primer intento: la tabla alta pagaba **103%** y la casa perdía en cada
  bolita. Elegir riesgo cambia cómo se gana, no cuánto.
- **Carrera de surf** ([lib/surf.js](lib/surf.js)): `cuota = RETORNO / probabilidad`. Es el
  sobrerredondeo de una casa de apuestas: los seis surfistas dejan el mismo 5%, así que apostar
  al favorito o al que nadie mira da igual a la larga. El sorteo usa los pesos tal cual — nunca
  se toca para "corregir" un pago.
- **Duelo de cartas** ([lib/duelo.js](lib/duelo.js)): es el Dragon Tiger de siempre. La ventaja
  sale de **perder la mitad cuando hay empate**, no de un pago recortado: sin esa regla, apostar
  a un bando sería una apuesta justa y la casa no ganaría nada. Empate 7,40%, bando 3,70% de
  ventaja, empate a 11:1 el 11,25%. `repartir()` **no baraja**: saca dos posiciones del zapato
  de 312 y corre la segunda si choca con la primera. Barajar 312 cartas para usar dos es el
  mismo resultado y trescientas veces más trabajo — con el barajado, medio millón de manos de
  prueba no terminaban.

### Se apuesta con fichas, no escribiendo una cifra

`FICHAS` en [lib/fichas-limites.js](lib/fichas-limites.js) es la única lista: 50, 100, 500,
1.000 y 5.000. La cifra en pantalla **se mira, no se escribe** — es un `<output>`, no un
`<input>`. Antes era un campo libre y se podía apostar 501, que es una cantidad que en una mesa
no existe porque no hay combinación de fichas que la forme.

Eso es la pantalla, y la pantalla nunca decide: el servidor lo comprueba igual.

- `validarApuesta()` exige **una ficha exacta**. Lo usan las mesas de apuesta simple.
- `esPilaDeFichas()` acepta cualquier suma armable con esas fichas —o sea, múltiplos de 50— y lo
  usan la ruleta, el surf y el duelo, donde se apilan fichas en varios sitios y el total de un
  sitio no tiene por qué ser el valor de una ficha suelta.

Si agregas una ficha nueva que no sea múltiplo de 50, `esPilaDeFichas()` deja de describir lo
que se puede armar y hay que cambiarla.

### Lo que hacía lento al blackjack

Cada acción encadenaba **cinco viajes al almacén**: leer la partida, leer el saldo, leer otra vez
las partidas para guardar, escribir, y al cerrar otro tanto. Contra Supabase cada uno es una ida
y vuelta por la red. Dos cambios:

- `lib/blackjack-partida.js` expone el mapa entero (`leerPartidas`/`escribirPartidas`) y el route
  handler lo lee **una vez por petición** y lo escribe una vez. `guardarPartida()` con un `leer`
  por dentro parecía cómodo y era un viaje de más en cada carta pedida.
- `moverSaldo()` en [lib/fichas.js](lib/fichas.js) suma al saldo con una lectura y una escritura.
  Antes `saldoDe()` + `ponerSaldo()` eran dos lecturas y una escritura, y una mano encadena
  varias (cobrar, doblar, separar, pagar).

Medido en local: repartir 278 ms y cada acción 145 ms. Si vuelve a sentirse lento, cuenta los
`leer`/`guardar` por petición antes de tocar la animación — casi siempre es eso.

### Mines: el pago sale de la probabilidad, no de una tabla

`pago(k) = RETORNO × C(25,k) / C(25−m,k)`, o sea el inverso de la probabilidad de haber
llegado hasta ahí. De ahí sale lo que define el juego: **da igual dónde te plantes**, en la
primera casilla o en la vigésima el retorno es el mismo 97%. Y por lo mismo no hay forma de
"elegir bien" una casilla — todas las tapadas son iguales.

**Las minas se siembran antes de la primera casilla** y `sembradas` no sale del servidor hasta
que la partida termina. Si se sortearan al destapar, el juego podría decidir sobre la marcha
que justo esa tenía mina.

**Cuantas más minas, más rápido sube el multiplicador**, y eso no es un ajuste: el pago sale
de la probabilidad de seguir vivo. Con 10 minas la escalera va x1,62 · x2,77 · x4,90 · x8,99 ·
x17,16 y se dispara en cinco casillas. Por eso `MINAS` quedó en 1, 3 y 5 — la forma de que
suba más despacio es menos minas, no otra tabla de pagos.

`TOPE_PAGO` corta la escalera. Sin él, destapar las 15 limpias con 10 minas paga **x3.170.697**:
matemáticamente correcto y una bomba para una economía de fichas que reparte el encargado a
mano. El tope no cambia el retorno — cada escalón sigue pagando lo suyo, solo deja de haber
escalones más allá.

### Las mesas de dos pasos guardan el mazo en el servidor

El póker y el blackjack no se resuelven en una sola llamada: reparten, esperan una decisión y
recién ahí pagan. Entre medio, **el resto del mazo y la carta tapada del crupier se quedan en el
servidor**, en [lib/poker-mano.js](lib/poker-mano.js) y
[lib/blackjack-partida.js](lib/blackjack-partida.js). Si viajaran al navegador, quien mire la
respuesta vería lo que viene antes de decidir, que es justamente lo que el juego no puede
permitir. La `vista()` del blackjack existe para eso: es lo único que sale.

Tres consecuencias que no hay que deshacer:

- **La partida a medias se retoma.** La apuesta ya está cobrada, así que si alguien cierra la
  pestaña entre el reparto y la decisión, al volver encuentra su mano donde la dejó. Repartir con
  una partida abierta la devuelve en vez de cobrar otra apuesta — idempotente, como
  `marcarEntrada()`.
- El cobro va en dos tiempos: `cobrar()` al repartir (y en cada doblar o separar) y `pagar()` al
  cerrar, que es lo único que anota la jugada. Una mano deja **una** fila en el registro, con
  todo lo apostado sumado.
- Los módulos de reglas ([lib/poker.js](lib/poker.js), [lib/blackjack.js](lib/blackjack.js)) son
  **puros** y no tocan el almacén: la mesa los importa desde el navegador para pintar la tabla de
  pagos y calcular lo que se ve. El estado va aparte, en los `-mano`/`-partida`. Juntarlos
  arrastraría `node:fs` al bundle del cliente y rompería el build.

**Póker:** la tabla es la 9/6, y el 9 y el 6 son los pagos del full y el color. Son justamente los
que las máquinas de verdad recortan (8/5, 7/5…) para bajar el retorno sin que se note; acá están
completos. El evaluador está comprobado enumerando **las 2.598.960 manos posibles**: las nueve
frecuencias coinciden al entero con las conocidas. Si tocas `evaluar()`, vuelve a correr esa
enumeración — es rápida y no deja dudas.

**Blackjack:** las reglas están elegidas una por una y están escritas en `REGLAS`, que es lo que
se muestra en pantalla. Dos que importan: el blackjack paga **3 a 2** (las mesas que pagan 6 a 5
más que duplican la ventaja de la casa con ese solo cambio), y **no hay seguro**. Que no haya
seguro no es un olvido — es la peor apuesta de la mesa, con casi un 7% para la casa, y ponerla
sería empeorar el juego a propósito. Medido con 200 000 manos jugadas con estrategia básica: la
casa se queda con el 0,6%, dentro del ruido del 0,43% teórico.

### El saldo lo reparte el admin, y queda registrado

`ajustarSaldo()` anota cada recarga como una jugada de tipo `ajuste` con el nombre de quien la
hizo. [app/admin/fichas.js](app/admin/fichas.js) es la pantalla; también lista las últimas
jugadas de todo el mundo, que es lo que permite notar si algo se está comportando raro.

### Redondear las coordenadas del SVG no es cosmética

`rueda.js` redondea a 3 decimales con `r3()`. `Math.cos` puede dar el último bit distinto en Node
y en el navegador, y entonces el HTML del servidor no coincide carácter por carácter con el del
cliente: React lo detecta como desajuste de hidratación y descarta el árbol. Pasó de verdad.

### Lo que hacía que el casino se sintiera pegado

Dos cosas, y las dos vuelven fácil si no se sabe:

- **`filter: blur(90px)` en los resplandores del fondo**, sobre elementos de medio ancho de
  pantalla y animados con `scale`. Cada fotograma obligaba al navegador a volver a difuminar una
  capa enorme. Medido haciendo scroll en la sala: **15 fps con el blur, 60 sin él**, y todos los
  fotogramas por debajo de 30 contra ninguno. Ahora son `radial-gradient`, que se ven igual y se
  componen gratis. Si vuelves a poner un `blur` ahí, vuelve el tirón.
- **`<a href>` en vez de `next/link`**, que recargaba el documento entero en cada clic. La barra
  y las tarjetas de las mesas usan `Link`, así que la navegación es del cliente y la ruta se
  precarga sola. Un `<a>` nuevo en la barra reintroduce el parpadeo sin que nadie lo note.

### La barra envuelve, no recorta

`.barra-nav` tenía `overflow-x: auto`: con las siete secciones más el botón de cambiar de vista,
los últimos enlaces quedaban fuera de la vista **sin ninguna señal de que estaban ahí**. Ahora
`.barra-cuerpo` lleva `flex-wrap` y la navegación se baja entera a una segunda fila cuando no
cabe (por debajo de 1100 px). Encima de eso va pegada a la derecha, junto al resto de los mandos.

Comprobado midiendo cada pieza contra el borde de la barra en nueve anchos, de 390 a 1600 px: no
se corta ninguna. Si agregas una sección más, vuelve a medir — no basta con mirarlo en tu pantalla.

### La paleta del casino está encerrada

Todo el CSS del casino cuelga de `.casino`, con sus propias variables (`--neon`, `--oro`…). Es un
local distinto: no debe parecerse al taller ni pisarle los estilos. `<Barra variante="casino">`
cambia marca y enlaces, y esconde el marcaje de turno y *Mis turnos* — quien entra al casino no
ficha horas.

## Licencias y ausencias

- **[lib/licencias.js](lib/licencias.js)** — solicitudes con estados
  `borrador → enviada → aprobada|rechazada`.
- **[app/licencias/](app/licencias/)** — una sola página sirve al mecánico y al admin; las
  pestañas *Por revisar / Resueltas / Las mías* solo aparecen para admin.

Reglas que no hay que aflojar:

- **Un borrador es privado hasta que su autor lo envía.** `listarEnviadas()` excluye
  `borrador`, y es lo único que ve el admin. El endpoint `?todas=1` exige admin (403 si no).
- Editar, enviar y borrar exigen ser el dueño (`No es tuya.`). Aprobar y rechazar exigen admin.
- Una solicitud resuelta queda de **solo lectura** para su autor: es el registro de una decisión,
  no un formulario. Solo el admin puede borrarla, y al hacerlo se le avisa a la persona.

## Devoluciones

- **[lib/devoluciones.js](lib/devoluciones.js)** — `borrador → pendiente → pagado|rechazado`.
  Mismo patrón que licencias: borrador privado, resuelta = solo lectura.
- **[lib/imagenes.js](lib/imagenes.js)** — subida y borrado de capturas.

### La captura vale subida o pegada, y no son lo mismo

`normalizarEnlace()` acepta una URL —la que deja FiveM al hacer la captura— como alternativa a
subir el archivo. **El servidor valida el enlace pero nunca lo descarga**: ir a buscar una URL
que escribe cualquiera es pedir que le pidan cosas de la red interna. Lo carga el navegador de
quien mira la solicitud, como cualquier enlace.

Y no dan la misma privacidad: lo subido va al bucket privado y se sirve firmado; **lo pegado
vive donde lo subió FiveM y lo ve cualquiera que tenga esa URL**. La pantalla lo dice con esas
palabras — el pie decía «nadie más puede abrirlas ni con el enlace» y con enlaces pegados eso
era mentira.

`tieneCaptura()` es lo que decide si una solicitud se puede enviar: una de las dos basta.

### El monto se escribe con los puntos puestos

El campo formatea mientras se escribe (`125000` → `125.000`) y solo deja dígitos. Sin eso,
`125000` y `12500` se ven casi igual y un cero de más no se nota hasta que el encargado va a
pagar. Y «12,50» se guardaba como **1.250** sin que nadie lo viera, porque `normalizarMonto()`
se queda solo con los dígitos.

### El bucket es privado, y de ahí salen dos reglas

Las imágenes van a **Supabase Storage, bucket `sunset`, privado** (en local, a
`.datos/imagenes/`). Que sea privado es lo que obliga a lo siguiente, y no hay que "simplificarlo":

- `urlFirmada()` genera una URL de 5 minutos. **Nunca** se guarda ni se devuelve una URL pública.
- Las capturas se piden por `GET /api/devoluciones/:id/imagen`, que comprueba que quien mira sea
  el dueño o un admin **antes** de firmar. La ruta de la imagen por sí sola no sirve para verla.

### La validación de imágenes mira los bytes, no la etiqueta

`tipoReal()` reconoce PNG/JPEG/WEBP por los primeros bytes. El `Content-Type` que manda el
navegador lo controla quien sube: con solo mirarlo, un `.txt` renombrado a `.png` pasaba. Si el
tipo declarado y el real no calzan, se rechaza. SVG queda fuera a propósito — puede traer scripts.

Al reemplazar la captura de una devolución se borra la anterior; si no, quedaría ocupando espacio
sin que nadie pueda volver a verla.

## Pedidos de tunning

**[app/tunning/](app/tunning/)** — la copia de trabajo del pedido que canta la tablet del juego.
Un pedido es `{ id, creadoPor, creado, cerrado, piezas: [{ id, categoria, etiqueta, valor,
hecha }] }` en `sunset:tunning`.

El problema que resuelve: el pedido puede traer más de treinta líneas y hay que volver a mirarlo
en la tablet cada dos piezas. Acá se marca cada una al instalarla.

**Un pedido no lleva patente.** Se abre, se trabaja y se cierra en el rato que el auto está en el
elevador; escribirla era un trámite antes de empezar que después no servía para nada. Se
distinguen por la hora en que se abrieron (`rotulo()` en la pantalla). Los pedidos viejos que
tengan `patente` guardada la siguen mostrando — el campo no se migra, se ignora.

### Se guarda la categoría y el número, no el nombre largo

En el menú del juego se entra a «Parachoques» y se elige el 4. El nombre bonito del pedido
(«Parachoques delantero de fibra Mk2») **no se usa para nada mientras se instala**, y escribirlo
entero treinta veces es lo que hace que nadie use la lista.

### El pedido entra pegado, de una vez

Cargar treinta piezas de a una son treinta idas al servidor —y contra Supabase cada una lee y
reescribe la colección entera— más treinta oportunidades de perder el hilo. Se pega la lista tal
como la canta la tablet y **entra en una sola escritura**: `crear()` acepta las piezas en la
misma llamada que la creación, y `agregar()` acepta un objeto o un arreglo. Medido: 30 líneas de
punta a punta en 261 ms.

`interpretarLinea()` vive en `tunning-categorias.js` porque la vista previa corre en el
navegador. Reconoce «Parachoques delantero: 4», «Techo 4», «- Llantas 12» y «2. Escape = 2», y
lleva una tabla de `ALIAS` porque la tablet y la gente no usan el mismo nombre (rines, spoiler,
polarizado…). Dos reglas que no hay que aflojar:

- **Los nombres se prueban del más largo al más corto.** Si «Parachoques» se probara antes que
  «Parachoques delantero», todo delantero quedaría como parachoques a secas y el número
  apuntaría a otro submenú.
- **Lo que no reconoce no se tira**: vuelve con `categoria: null` y el texto tal cual, igual que
  una categoría escrita a mano. Perder una línea en silencio es el peor de los dos errores.

**Lo interpretado se enseña antes de guardar.** Un intérprete que adivina mal sin avisar deja el
pedido mintiendo y eso no se nota hasta que el auto sale mal. Las líneas sin número quedan fuera
y **se nombran** en el resumen: decir «1 sin número» y no cuál obliga a ir a buscarla, y la lista
de la vista previa tiene su propio scroll.

Cargar una pieza suelta sigue siendo dos gestos —categoría del `<select>` y número—, para lo que
llega después de empezar.

### El orden de la lista es el del menú, no el de llegada

`ordenar()` en [lib/tunning.js](lib/tunning.js) usa `ordenDe()` de
**[lib/tunning-categorias.js](lib/tunning-categorias.js)**, donde `orden` **no se escribe: es la
posición en el arreglo**. Mover una categoría de sitio ahí cambia el orden de trabajo en toda la
app. Ese orden es el punto entero de la pantalla: siguiendo el pedido tal como llega se entra y
se sale del mismo submenú una y otra vez; ordenado como el menú se baja una sola vez por sección
y no se vuelve atrás.

Dentro de una categoría se ordena por número (`localeCompare` con `numeric`). **Las piezas hechas
no se mueven de sitio** — reordenar la lista bajo los ojos de alguien que está trabajando es la
forma más rápida de que instale la pieza equivocada.

`tunning-categorias.js` va aparte de `tunning.js` por lo de siempre: la pantalla es cliente y
`tunning.js` arrastra `lib/almacen.js` (`node:fs`). Mismo caso que `fichas-limites.js`.

`texto: true` marca las categorías que no llevan número sino descripción — los colores, que
vienen como «METÁLICO - RGB(84,118,204)». `ordenDe()` manda al final lo que no esté en el
catálogo, en vez de perderlo: el almacén puede tener categorías que el código ya no.

### Modo trabajo y voz

*Modo trabajo* muestra **una sola pieza a pantalla completa** y un botón. Es para mirar de reojo
desde el otro monitor mientras se navega el menú del juego, no para leer una tabla.

La voz ([app/tunning/voz.js](app/tunning/voz.js)) canta la siguiente al marcar la anterior, con
la Web Speech API del navegador — sin servicio externo. `comoSeDice()` dice «Techo, número
cuatro» y no lee el identificador. Dos detalles que parecen de más y no lo son: las voces del
sistema **llegan tarde** (hay que escuchar `voiceschanged`, si no la primera frase sale muda), y
se `cancel()` antes de hablar, porque marcando rápido se encolan y la voz queda atrasada varias
piezas.

### El campo se vacía antes de mandar, no al volver la respuesta

Cargando treinta piezas se escribe la siguiente mientras la anterior viaja. Limpiando al volver
la respuesta se borraba lo recién tecleado y **la pieza se perdía sin decir nada**: se cargaban
diez y entraban nueve. Si falla el envío se repone lo escrito, pero solo si el campo sigue vacío.

`agregar` y `quitar` son del route handler; toda la API pasa por `exigirTaller()`, así que un
invitado del casino no entra. Se guardan los últimos 20 pedidos cerrados: sirven para consultar,
no para siempre.

## Anuncios: flyers y mensajes

**[lib/anuncios.js](lib/anuncios.js)** — dos colecciones separadas, `sunset:flyers` (imágenes) y
`sunset:mensajes` (textos para copiar).

A diferencia de licencias y devoluciones, **acá no hay estados ni aprobaciones**: el admin
publica y todo el taller lo ve. No le agregues un flujo de revisión; ese no es el punto.

- Publicar, editar y borrar exigen admin. **Ver y copiar es de cualquiera con sesión** — si
  cierras eso, la función pierde el sentido.
- La imagen se sirve por `GET /api/flyers/:id/imagen`, firmada por **una hora** y no cinco
  minutos como las capturas de devoluciones: la galería se mira largo rato y se reabre, y con
  cinco minutos la pestaña abierta se llenaría de imágenes rotas.
- Al publicar se avisa a todo el taller con `crearAvisos()` (una sola escritura). Con
  `crearAviso()` en un bucle se reescribiría la colección entera una vez por persona.

El estilo "futurista" de la galería vive en `.flyer-marco`: el borde de degradado es un fondo con
`padding: 1px` y un `::before`, porque los bordes CSS no aceptan degradados. El barrido de luz y
el desplazamiento están anulados bajo `prefers-reduced-motion`.

## Avisos (la campanita)

**[lib/avisos.js](lib/avisos.js)** — notificaciones dentro de la app, compartidas por todas las
funciones que necesiten avisar algo.

`para` es un usuario, o el comodín `ADMINS` para todos los administradores. Ese comodín se
resuelve **al leer**, no al escribir: quién es admin puede cambiar entremedio. Por lo mismo, los
avisos a `ADMINS` guardan `leidoPor: []` en vez de un `leido` booleano — si un admin marcara leído
un aviso compartido, desaparecería para los demás.

No hay correo ni notificación al teléfono: eso necesita un servicio externo (Resend o similar) y
no está montado.

## Registro de turnos

- **[lib/turnos.js](lib/turnos.js)** — la lógica: `marcarEntrada`, `marcarSalida`, `listar`,
  `corregir`, `borrar`. Un turno es `{ id, usuario, entrada, salida }` con `salida: null`
  mientras esté abierto; no hay eventos sueltos de entrada y salida por separado.
- **[lib/almacen.js](lib/almacen.js)** — dos backends tras la misma puerta, elegidos por
  presencia de variables de entorno. Ver abajo.
- **[lib/tiempo.js](lib/tiempo.js)** — formato y aritmética de horas.
- **[app/marcaje.js](app/marcaje.js)** — la barra de entrada/salida sobre la calculadora.

### La barra superior y el menú de perfil

**[app/barra.js](app/barra.js)** se usa en las dos páginas: marca, navegación y menú de perfil con
marcaje, *Mis turnos*, *Cambiar mi clave* y *Cerrar sesión*.

El turno **no** se guarda dentro de `Barra` ni de `Marcaje`: lo tiene la página (`Boleta`,
`Panel`) y baja por props, porque los dos componentes muestran el mismo dato. Con una copia cada
uno, marcar desde el menú dejaba la barra de la calculadora mintiendo. Si agregas un tercer lugar
que muestre el turno, pásalo igual — no lo dupliques.

*Mis turnos* y *Cambiar mi clave* abren un **diálogo** ([app/dialogo.js](app/dialogo.js)), no una
página. Es deliberado: las cantidades de la boleta viven en `useState`, así que navegar a otra ruta
las borra. Cualquier opción nueva del menú debe seguir ese camino.
- **[app/admin/](app/admin/)** — `page.js` (servidor, revalida admin y carga los turnos) +
  `panel.js` (cliente: filtros, totales, edición en línea).

### Los tres backends de almacenamiento

`dondeGuarda()` decide por presencia de variables, en este orden:

1. `'supabase'` — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. El modo de producción.
2. `'redis'` — `KV_REST_API_*` o `UPSTASH_REDIS_REST_*`.
3. `'archivo'` — ninguna; escribe `.datos/<coleccion>.json`.

Usuarios y turnos comparten almacén, con claves `sunset:usuarios` y `sunset:turnos`.

**Supabase** se usa vía PostgREST contra una tabla de dos columnas (`clave text primary key`,
`valor jsonb`) — el SQL está en PUBLICAR.md. Escribir es un upsert: `POST ?on_conflict=clave` con
`Prefer: resolution=merge-duplicates`. Sin ese `Prefer` la segunda escritura muere por clave
duplicada.

La llave es la **service_role**, no la anon, y la tabla tiene RLS encendido sin políticas: así
nadie con la llave pública puede leer los hashes. Por eso `SUPABASE_SERVICE_ROLE_KEY` no lleva ni
puede llevar prefijo `NEXT_PUBLIC_` — eso la mandaría al navegador.

**Redis** usa el endpoint genérico de comandos de Upstash (POST con `["GET", clave]` en el cuerpo)
en vez de `/get/<clave>`: así las claves con dos puntos no dependen de cómo se codifique la URL.

Esto **no es un detalle de comodidad**: en Vercel el disco es efímero, así que el modo archivo
pierde usuarios y turnos en cada despliegue. El panel muestra cuál está activo, y ese aviso es
intencional — no lo quites pensando que es ruido. Cuando agregues un backend, agrégalo también a
las tres etiquetas: el panel, el aviso y el rótulo de `scripts/usuarios.mjs`. Un rótulo que miente
sobre en qué base estás escribiendo es peor que no tenerlo.

Cada colección es un JSON que se lee y reescribe entero. A la escala de un taller sobra, pero dos
escrituras simultáneas pueden pisarse. Si el registro creciera de verdad, la salida es pasar los
turnos a una tabla propia en Postgres en vez de un documento.

### Zona horaria

Todo se guarda en ISO/UTC y se muestra en `America/Santiago`, fijo, no en la zona del navegador —
si no, el mismo turno se leería distinto según quién lo mire. `desdeInput()`/`paraInput()` en
`lib/tiempo.js` hacen la conversión para los `<input type="datetime-local">` del panel; sin ellas
un admin en otra zona horaria correría cada turno que tocara.

### Un turno se cierra solo a las 2 horas

Regla de negocio, no detalle técnico: **no hay conexión con FiveM**, así que un turno abierto no
prueba que la persona siga en el taller. A las `HORAS_MAXIMAS` horas se cierra y quien siga
trabajando vuelve a marcar entrada. Así las horas registradas nunca son inventadas.

**El cierre ocurre al leer, no en un proceso de fondo** — esta app no tiene ninguno. `leerAlDia()`
cierra lo vencido y **todo lo que consulte turnos debe pasar por ahí**; si alguna ruta lee la
lista cruda, mostrará abiertos turnos que ya deberían estar cerrados.

La salida no se pone en «ahora» sino en **`entrada + 2h` exactas**. Es lo que hace que el
resultado no dependa de cuándo alguien abra la app: si nadie entra en tres días, el turno igual
queda cerrado a las dos horas, no a los tres días.

`avisarCierres()` avisa por campanita y por Discord, y va **envuelto en `try`**: el turno ya se
guardó antes de llegar ahí, y un aviso que falla no puede tumbar el registro de horas.

`HORAS_MAXIMAS` vive en [lib/turnos-limites.js](lib/turnos-limites.js), aparte, porque la barra de
marcaje la necesita en el navegador y `lib/turnos.js` arrastra `node:fs`.

### Avisos a Discord

**[lib/discord.js](lib/discord.js)** — webhook configurable desde el panel, guardado en
`sunset:config`. La URL **nunca vuelve al navegador**: quien la tenga puede publicar en ese canal,
así que la API solo dice si hay una puesta. Cada usuario puede tener un `discord` (su ID) para que
el mensaje lo mencione; sin él se usa el nombre en negrita.

`allowed_mentions: { parse: ['users'] }` no es decorativo: sin eso, un `@everyone` escrito por
accidente en un mensaje notificaría a todo el servidor.

El validador exige el dominio de Discord **en producción** y lo relaja en desarrollo, para poder
probar contra un servidor local.

### Reglas del servidor que no hay que relajar

- **El registro del taller es exclusivo de admin.** `GET /api/turnos` responde 403 a cualquier
  otro. Cada persona sí puede ver **lo suyo** por `GET /api/perfil/turnos`, que saca el usuario de
  la cookie y nunca de un parámetro: no hay forma de pedir los turnos de otro. Son dos cosas
  distintas y hay que mantenerlas separadas — el registro completo nunca debe volverse accesible
  desde la ruta de perfil.
- `POST /api/perfil/clave` cambia la clave **de quien tiene la sesión, y solo la suya**. El usuario
  sale de la cookie; si viniera del cuerpo, cualquiera podría cambiarle la clave a otro. Exige la
  clave actual: sin eso, quien pille una sesión abierta dejaría fuera al dueño de la cuenta.
- Corregir y borrar son solo de admin, verificado en el route handler, no solo en el middleware.
- `corregir()` rechaza fechas inválidas y salidas anteriores a la entrada — un turno negativo
  rompe todos los totales del panel.
- `marcarEntrada()` es idempotente: con un turno ya abierto lo devuelve en vez de crear otro.

### El catálogo se edita desde el panel, no en el código

`SECCIONES` de `lib/catalogo.js` ya **no es la fuente de verdad**: es la **semilla**, lo que se usa
mientras la base no tenga nada guardado. Desde el primer guardado manda `sunset:catalogo`.

- **[lib/precios.js](lib/precios.js)** — leer, validar y guardar el catálogo, más
  `restaurarSemilla()` para volver al del código si alguien deja los precios inservibles.
- **[app/precios/](app/precios/)** — el editor, solo admin. `app/page.js` carga el catálogo y se
  lo pasa a `<Boleta secciones={…}>`; la calculadora ya no importa `SECCIONES`.

El orden de las secciones en el arreglo **es** el orden en pantalla: la grilla las reparte
izquierda, derecha, izquierda… Por eso el editor tiene flechas para moverlas.

### Claves de ítem: ahora por `id`, no por posición

Cada cantidad se guarda bajo `` `${seccion.id}:${item.id}` ``. Antes era el índice en el arreglo,
lo que daba igual con un catálogo fijo; ahora que el encargado reordena y borra ítems, una clave
posicional haría que las cantidades saltaran de producto. `lib/precios.js` le pone `id` a los
ítems de la semilla, que no lo traen.

### `TINTES` vive en catalogo.js a propósito

El editor es un componente cliente. Importar `TINTES` desde `lib/precios.js` arrastraría
`lib/almacen.js` —que usa `node:fs`— al bundle del navegador y **rompe el build**. Es el mismo
límite que impide usar `almacen.js` desde el middleware.

### Cómo se relacionan catálogo y estilos

`seccion.tinte` de `catalogo.js` se inyecta como la variable CSS `--tinte` en el `<section>`
correspondiente. Los cinco tintes actuales son exactamente los stops del degradado
`--sun-1` … `--sun-5` de `globals.css`. Al agregar una sección nueva, elegir un tinte coherente con
esa franja.

### Convenciones

- Todo en español: identificadores, comentarios, strings de UI. Mantenerlo así.
- Los montos se formatean con `Intl.NumberFormat('es-CL')` vía el helper `money()`.
- Poner una cantidad en 0 **elimina** la clave de `cantidades` (no la deja en 0); los valores se
  acotan a 0–999.
- `revisar: true` en un ítem hace que se muestre «precio por definir» en vez del monto, pero el
  `precio` igual se multiplica normalmente en el total.

## Datos heredados del Excel

Los precios salen de la hoja `Valores` del `Calculadora_SUNSETMOTORS.xlsx` original (columna B =
nombre, columna D = precio). Hay tres discrepancias documentadas en el [README](README.md) que son
decisiones deliberadas, no bugs:

- **Neumáticos** tiene `precio: 0, revisar: true` porque la celda original era un VLOOKUP roto.
- **Filtro de aceite** queda en $0 tal como está en la hoja.
- Los precios de **Reparación en terreno** siguen a la boleta (Paleto 400 / Sandy 300 / Ciudad 450),
  no a la tabla "Precio de Otro Taller" del Excel, que dice lo contrario.

Antes de "corregir" cualquiera de estos, confirmar con el usuario.
