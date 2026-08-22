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

### La sesión dura 30 días y se renueva sola

`HORAS = 24 * 30` es un **tope absoluto**, no un descuido: con 12 horas la sesión se caía a media
tarde de un turno de rol y había que volver a escribir la clave.

Lo que hace que no caduque nunca a quien la usa es la renovación, y vive en **`middleware.js`**:
por ahí pasa cada navegación y cada llamada a la API, y firmar solo necesita `SUNSET_SECRETO`,
no la base de datos. `hayQueRenovar()` dispara **a la mitad de la vida** de la cookie, no en cada
petición: si no, cada sondeo de 15 segundos mandaría una cookie nueva para nada.

`leerSesion()` devuelve también `exp` justamente para esto. Y `opcionesCookie()` está compartida
entre el login y la renovación **a propósito**: con opciones distintas —otro `path`, otro
`sameSite`— el navegador guardaría dos cookies y ganaría la que no toca.

Comprobado: una cookie con 29 días por delante no se toca; con 10 días o con 12 horas se estira
a 30; una vencida y una mal firmada van al login igual que antes.

### Un solo portero para todas las rutas

`lib/servidor.js` tiene los cuatro: `exigirSesion()`, `exigirTaller()`, `exigirCasino()` y
`exigirAdmin()`. Devuelven `{ sesion, accesos, corte }`; si viene `corte`, la ruta lo devuelve
tal cual y no hace nada más.

Antes cada ruta traía su propia copia de esas cuatro líneas —catorce copias— y **todas
arrastraban el mismo agujero**: `soloCasino()` responde `false` a una cuenta que ya no existe
(no es del casino, porque no es de nada), así que borrar a alguien no lo echaba. Con la pestaña
abierta seguía usando la calculadora, el tunning y la bodega hasta que caducara su cookie, que
son 30 días. Ahora `puertasDe()` devuelve también `existe` y el portero exige que la cuenta
esté; **no cuesta ninguna consulta extra**, porque la comprobación de siempre ya leía esa misma
colección.

El portero **devuelve los accesos ya leídos**. Una ruta que necesite saber si quien pregunta es
admin usa `accesos.admin` en vez de llamar a `esAdmin()`, que sería leer la tabla de usuarios
por segunda vez en la misma petición.

`npm run probar` comprueba que **cada archivo importe el portero que usa**. Sin linter ni
TypeScript, usar `exigirAdmin` sin importarlo compila igual y el fallo sale recién cuando
alguien llama a esa ruta, como un 500: `/api/turnos` respondía 500 a un mecánico en vez de 403,
y el build no dijo nada.

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

**El casino está cerrado a los jugadores** desde el 21 de agosto de 2026, a pedido del usuario:
todas las cuentas quedaron con la bandera `casino` en false y **el saldo en 0**, así que solo lo
ven los administradores (que entran por ser admin, no por la bandera). Las dos cuentas que eran
solo casino quedaron **suspendidas**, no borradas. Para volver a abrirlo basta con dar la
bandera desde el panel; las fichas las reparte el encargado como siempre.

Ojo con el saldo: `saldoDe()` devuelve `SALDO_INICIAL` (5.000) cuando alguien **no tiene entrada
guardada**, así que dejar todo en cero fue escribir un `0` explícito por cuenta. Vaciar la
colección le habría regalado 5.000 fichas a todo el mundo.

**`cambiarCasino(u, true)` deja también el taller** a quien lo tenía. Si no, dar el casino a un
mecánico lo echaría de la calculadora sin que nadie lo pidiera. Para dejar a alguien solo de
casino está `cambiarTaller(u, false)`, que es explícito.

`POST /api/login` devuelve un `destino` según la categoría, y el login redirige ahí.

**Toda página del taller empieza con `sesionDeTaller()`** ([lib/servidor.js](lib/servidor.js)),
que manda al login a quien no tenga sesión y al casino a quien sea solo de casino. Si agregas una
página del taller y usas `sesionActual()` en su lugar, un invitado del casino la va a ver.

El chequeo va ahí y no en el middleware por lo de siempre: el rol se consulta contra la base y el
middleware corre en Edge.

### Una cuenta suspendida no entra a ninguna parte

`suspendida: true` en la ficha. `puertasDe()` devuelve las tres puertas en **false** y
`suspendida: true`, así que ninguna comprobación de más arriba puede dejarla pasar por
descuido, y el portero de `lib/servidor.js` responde **401 «Esta cuenta está suspendida.»** en
la API y manda al login en las páginas.

Es el punto medio que faltaba entre dejar entrar y borrar, y salió de cerrar el casino a los
jugadores: las cuentas que eran **solo casino** no tenían dónde ir. Quitarles la bandera las
habría convertido en mecánicos con acceso a la calculadora y a la bodega —que nadie pidió—,
porque `taller` se calcula como `!casino`. Borrarlas era perder la cuenta por un cierre que
puede ser temporal.

- **El login lo dice con esas palabras** (403), no «usuario o clave incorrectos»: con el
  mensaje genérico la persona se queda probando claves que sí funcionan.
- No se puede **suspender la propia cuenta** ni al **único administrador activo**, por lo mismo
  que no se puede borrar al último admin: al panel no volvería a entrar nadie.
- Al reactivarla vuelve exactamente a lo que era: la ficha no se toca en nada más.
- El panel la marca (`etiqueta-suspendida`) y apaga la fila, y el botón alterna
  *Suspender* / *Reactivar*.

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

**Para contarlos hay `SUNSET_TRAZA=1`**, que hace que `lib/almacen.js` imprima cada lectura y
cada escritura con su clave. Es como se encontró que la campanita hacía **61 idas al almacén en
una sola petición**: `avisosDe()` preguntaba `esAdmin()` una vez por aviso, y la campanita
consulta cada 20 segundos. Ahora el `admin` se recibe —el portero de la ruta ya lo leyó— y son
**1**. Con la misma traza se vio que cada página del taller pedía la tabla de usuarios dos
veces; ahora `sesionDeTaller()` devuelve los accesos y las páginas bajaron de 4-6 idas a 3-4.

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

### Top de wager

**[lib/wager.js](lib/wager.js)** — el ranking del casino por fichas apostadas, con premio para el
podio (`PREMIOS` en [lib/wager-limites.js](lib/wager-limites.js): 30.000 · 20.000 · 5.000).

**Wager es lo apostado, no lo ganado.** Es lo que hace justa la tabla: quien apuesta 100 diez
veces suma 1.000 aunque acabe igual que empezó. Premiar la ganancia neta premiaría la suerte.

**Se acumula; no se deduce de `sunset:jugadas`.** Ése guarda solo las 500 últimas
(`MAX_JUGADAS`), así que un ranking calculado sobre él perdería historial en silencio en cuanto
el casino se usara de verdad — y nadie lo notaría hasta que alguien reclamara su puesto. `sumar()`
se llama desde `resolver()`, el único sitio por donde pasan todas las apuestas de todas las mesas,
y va envuelto en `try`: el top es un adorno y el saldo no.

- Una recarga del admin **no** cuenta: llega con `apuesta: 0`.
- Empate a wager: primero quien lo hizo en **menos jugadas**, que apostó más fuerte.
- **`cerrarCiclo()` guarda el ciclo antes de pagar.** Si pagara primero y fallara al guardar, el
  siguiente cierre volvería a pagar a los mismos — es exactamente el fallo del bingo. Si un pago
  falla, el ciclo queda `pagado: false` y la pantalla dice a quién hay que pagar a mano.
- `lib/fichas.js` importa `sumar` de `wager.js`, así que `wager.js` importa `fichas.js`
  **dentro de las funciones**: al revés sería un ciclo de módulos.

`sembrarDesdeJugadas()` arranca el contador con el registro que haya. Es de una sola vez y
**parcial**, por el tope de 500 — la pantalla solo ofrece el botón con el contador vacío.

### Las reglas están dentro de la pantalla

**[app/casino/top/reglas.js](app/casino/top/reglas.js)** — el panel que se abre con *Cómo
funciona*. Estaban solo en una página publicada aparte, así que había que tener el enlace a mano
para entender lo que se estaba mirando.

- **Va en la propia pantalla del top, no en un `Dialogo`.** Se leen las reglas mirando el ranking
  del que hablan, y en una ventana de 440 px el ejemplo de dos personas no cabe.
- **El botón es de cualquiera que juegue**, no del admin: va fuera del `admin && …` y antes de
  *Cerrar ciclo*. Se abre también desde un enlace dentro de la frase de arriba.
- **`PREMIOS.length` decide si dice «los 3 primeros».** Escrito a mano, el día que alguien agregue
  un cuarto premio las reglas mienten.
- La sección *Qué es el wager* **no repite `QUE_ES_WAGER`**: esa frase ya está dos dedos más
  arriba. Acá va la versión larga.
- **La tabla del ejemplo (Ana y Bruno) es lo que explica el juego en tres segundos.** Sin ella,
  «cuenta lo apostado, no lo ganado» se lee y no se entiende: Ana va primera habiendo perdido y
  Bruno último habiendo ganado las dos manos. En pantalla angosta la tabla se aprieta en vez de
  llevarse su propia barra — la columna del wager es justo la que quedaba fuera, y es la que
  cuenta el chiste.
- Los pasos del ciclo van **numerados** porque son una secuencia de verdad (se abre, se juega, se
  cierra, se paga). Las otras dos listas no lo están.

`.casino .vacio` y `.casino .pie` existen porque esas clases son del taller y traen fondo de
papel: dentro de la sala se veía una tarjeta blanca.

Las mismas reglas están además en un artifact publicado desde el chat, para compartir por fuera
de la app.

### Se quitó la solicitud de retiro

Existía `lib/retiros.js` con una pantalla en el casino y otra en el panel. **Se quitó a pedido
del usuario.** La colección `sunset:retiros` se queda en la base con lo que hubiera; si algún día
hay que consultarla, está en el historial de git.

### El registro de turnos tiene su propia barra

`.tabla-envoltura` lleva `max-height: 70vh` y `overflow: auto`, con la cabecera en `sticky`. Con
un año de turnos son cientos de filas y la página se hacía interminable; y sin la cabecera pegada,
al bajar tres pantallas ya no se sabe qué columna es cuál. La cabecera va con fondo **opaco** a
propósito: si no, las filas se ven por debajo.

Encima de la tabla va el contador de filas (`.tabla-cuenta`), que es lo que dice cuánto hay que
recorrer y si los filtros están recortando algo — con la tabla dentro de su propia barra ya no se
ve dónde acaba.

### Las fichas en pantalla se ponen al día solas

**[app/casino/fichas-al-dia.js](app/casino/fichas-al-dia.js)** — la cifra de la cabecera
consulta `/api/casino/saldo` cada 20 segundos, en la sala y en las once mesas (una sola línea
en `sala.js`, que es el envoltorio de todas).

El número que muestra una mesa sale de su propia jugada, y eso está bien. Lo que no se enteraba
era de lo que pasa **fuera**: una recarga del encargado, el pago del podio, o la misma cuenta
jugando en otra pestaña. Había que recargar la página para ver las fichas de verdad.

- **La mesa sigue mandando.** Si el saldo cambió mientras la consulta viajaba, esa consulta se
  descarta: su respuesta es anterior a la jugada y aplicarla haría saltar la cifra hacia atrás.
- `GET /api/casino/saldo` devuelve **solo el saldo**. Traía además las últimas 20 jugadas, que
  nadie usaba y costaban una lectura entera del registro en cada consulta: 3 idas al almacén
  por sondeo, ahora 2.
- Se detiene con la pestaña escondida y consulta al volver a ella, que es cuando a alguien le
  importa. Medido forzando el estado (en headless la pestaña nunca queda escondida de verdad):
  0 consultas en 24 s escondida, 1 en menos de 1,2 s al volver, y 2 en 45 s visible.

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

## Seguridad de la app

Todo esto es de una sola vez y no hay que volver a pensarlo, pero **no lo quites**: cada cosa
tapa algo concreto.

### Cabeceras y política de contenido

`next.config.mjs` pone las fijas: `X-Frame-Options: DENY` (que la app no se pueda meter en un
iframe ajeno encima de sus botones), `nosniff`, `Referrer-Policy: same-origin`,
`Permissions-Policy` sin cámara ni micrófono ni ubicación, y HSTS de un año. También
`poweredByHeader: false`.

La **CSP va en el middleware** porque lleva un **nonce distinto en cada carga**: es lo que
permite prohibir los scripts pegados en el HTML sin romper Next, que necesita uno para
arrancar. Con `'unsafe-inline'` la CSP no defendería de nada.

De ahí sale una regla que cuesta caro olvidar: **una página estática rompe el nonce**. El HTML
prerenderizado en el build trae el nonce de entonces, el navegador bloquea el arranque y la
página se queda muerta sin ningún error a la vista. Por eso `app/login/page.js` es un
envoltorio de servidor con `force-dynamic` y el formulario vive en `formulario.js`. Si agregas
una página que no lleve `dynamic = 'force-dynamic'`, compruébalo en el navegador con
`npm run build && npm start`, no en `npm run dev`.

`img-src` acepta cualquier `https:` **a propósito**: las capturas de devoluciones se pueden
pegar como enlace y ese enlace lo escribe quien lo pega. Google Fonts está permitido por la
página suelta de `public/`; la app no lo necesita porque `next/font` sirve las fuentes desde el
propio servidor.

### El middleware también mira de dónde viene

Las peticiones que escriben (`POST`, `PUT`, `PATCH`, `DELETE`) se cortan con 403 si traen
`Origin` de otro sitio o `Sec-Fetch-Site: cross-site`. La cookie es `sameSite: 'lax'`, así que
esto es el segundo cerrojo, y cierra las variantes: un `fetch` con `credentials: 'include'`
desde cualquier página, un formulario escondido, una etiqueta que dispare un DELETE.

**Sin ninguna de las dos cabeceras se deja pasar**, que es el caso de `curl` y de los scripts
de prueba — ésos ya necesitan la cookie para hacer algo. Comprobado: `Origin` ajeno 403,
`cross-site` 403, `Origin` propio 200, sin cabeceras 200.

El login pasa por el middleware pero **no por la comprobación de sesión** (`PUBLICAS` en
`middleware.js`): necesita la CSP igual, y mandarlo al login desde el login sería un bucle.

### Intentos de clave

**[lib/intentos.js](lib/intentos.js)** — el taller entero está detrás de una clave y antes se
podían probar sin ningún límite, que es lo único que necesita un script con una lista de claves
comunes. Se cuentan los fallos en `sunset:intentos`, se consulta **antes** de comprobar la
clave, y la espera se dobla con cada fallo hasta media hora.

- Cinco fallos libres **por cuenta y equipo**, y quince **por equipo** contando todas las
  cuentas que haya probado. Lo segundo es lo que frena a quien recorre una lista de usuarios.
- Se cuenta por (cuenta, equipo) y no por cuenta a secas **para que nadie pueda dejar a otro
  fuera** fallando adrede desde su casa.
- Acertar la clave durante el bloqueo **no lo levanta**: sigue respondiendo 429.
- Entrar bien borra el contador de esa cuenta, pero **no el del equipo**: si no, bastaría con
  tener una cuenta propia y entrar con ella de vez en cuando para seguir probando.
- Los fallos de más de una hora se olvidan, y la poda va en la misma escritura porque esta app
  no tiene ningún proceso de fondo.

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
en la tablet cada dos piezas. Acá se escribe una vez —en el listado de la izquierda— y se marca
cada pieza al instalarla, en el resumen de la derecha.

### Cada uno trabaja sobre su propio pedido

`listar(usuario)` devuelve **solo los suyos**. Antes eran los del taller entero: con dos
mecánicos a la vez, el segundo abría la pantalla y caía sobre el pedido del primero —`abiertoId`
arranca en el primer abierto que haya— y los dos escribían encima del mismo auto.

El `usuario` es **obligatorio** en `listar()`: con un parámetro opcional, olvidarlo en una
llamada nueva devolvería los pedidos de todo el mundo sin que saltara nada.

Y no basta con filtrar la lista: `agregar()`, `quitar()`, `marcar()`, `cerrar()` y `borrar()`
comprueban el dueño en el servidor, porque el identificador se puede mandar a mano. Probado con
dos sesiones de verdad: escribir en el pedido ajeno responde `400 Ese pedido no es tuyo.`

**`borrar()` ya no tiene excepción para administradores.** La tenía cuando la lista era del
taller entero y alguien podía querer hacer limpieza; ahora esa rama no se alcanza desde la
pantalla y lo único que permite es cargarse a mano el pedido que otro está trabajando.

**Un pedido no lleva patente.** Se abre, se trabaja y se cierra en el rato que el auto está en el
elevador; escribirla era un trámite antes de empezar que después no servía para nada. Se
distinguen por la hora en que se abrieron (`rotulo()` en la pantalla). Los pedidos viejos que
tengan `patente` guardada la siguen mostrando — el campo no se migra, se ignora.

### Se guarda la categoría y el número, no el nombre largo

En el menú del juego se entra a «Parachoques» y se elige el 4. El nombre bonito del pedido
(«Parachoques delantero de fibra Mk2») **no se usa para nada mientras se instala**, y escribirlo
entero treinta veces es lo que hace que nadie use la lista.

### La pantalla es el menú entero, y solo se escribe el valor

Se ven **las 36 categorías del catálogo siempre**, en orden, y de cada una solo se rellena la
casilla del valor. Las que el pedido no trae quedan en blanco y apagadas.

Antes había un `<select>` de categoría más un campo más un botón *Añadir*, pieza por pieza: con
treinta piezas son noventa gestos y hay que buscar cada categoría en un desplegable. Con el menú
entero a la vista se baja por la lista igual que por la tablet. **No lo vuelvas a convertir en un
formulario de a una** — es exactamente lo que se pidió quitar.

**Una categoría vale una sola vez.** `claveDe()` está en el cliente y en `lib/tunning.js`, y es
lo que hace que volver a mandar «Techo» cambie el número en vez de dejar dos filas que se
contradicen: en el juego tampoco se pueden instalar dos techos. Por eso `agregar()` es un upsert
y conserva el `id` y el `hecha` de la pieza que ya estaba — corregir un número no desmarca lo ya
instalado. Vaciar la casilla saca la pieza del pedido.

### *Otras*: lo que el menú del juego no contempla

El catálogo son las 36 opciones del menú, pero un pedido trae cosas que no son un número de
submenú: «revisar frenos antes de entregar», «las llantas las trae el cliente». Sin un sitio
donde anotarlas terminaban en un papel aparte, que es justo lo que esta pantalla evita.

*Otras* está **siempre**, aunque esté vacía, con una fila al final para escribir. Tres reglas:

- **El valor es opcional en una línea escrita a mano** y obligatorio en una del catálogo. Una
  categoría del menú sin número no sirve para nada —hay que elegir *algo* dentro del submenú—,
  pero «falta pieza» a secas ya es todo el recado.
- **Vaciar la casilla borra la del catálogo, no la escrita a mano.** Si no, una línea de texto
  sin valor se borraría sola al guardarse. Esas se quitan con la ×.
- Ahí caen también las piezas con una categoría que el almacén tiene y el código ya no, en vez
  de dejar la fila sin nombre.

El nombre no se edita: para cambiarlo se quita y se vuelve a escribir. Renombrar cambiaría la
`claveDe()` y el servidor lo tomaría por una línea nueva, dejando las dos.

### El check está en el resumen, y solo ahí

Las dos mitades de la pantalla hacen dos cosas distintas y no se pisan:

- **El listado de la izquierda es el pedido**: el menú entero, para ir rellenando lo que el
  cliente pide. Ahí no se marca nada — no tiene botón. Una pieza instalada se ve (se apaga, se
  tacha el nombre y le sale un ✓ **que no se pulsa**), pero el número sigue legible para poder
  corregirlo.
- **El resumen de la derecha es el trabajo**: la lista corta de lo que el pedido trae, y el
  único sitio donde se marca.

Estuvo en los dos lados y era peor: dos botones para lo mismo, y el que se estaba mirando nunca
era el que tocaba. Marcando desde el resumen se marca donde se lee, sin bajar a buscar la fila
del catálogo cada vez que se termina una pieza. **No devuelvas el check al listado.**

En el resumen, la línea entera es el botón y no una casilla de 26 px: se marca con el pulgar,
con el auto en el elevador. Va pegado (`position: sticky`) para que siga a la vista mientras se
baja por el menú, con una barra de avance arriba; por debajo de 1000 px se va arriba del todo.
**Lo instalado se apaga, no se saca**: sacarlo movería todo lo de abajo justo mientras alguien
lo está leyendo. La primera pendiente lleva `siguiente` —el borde de la casilla en ámbar—, que
es lo único que dice por dónde iba el trabajo al levantar la vista de la pantalla.

`resumen` es `filas.filter(f => f.pieza)` — solo lo que el pedido trae, en el orden del menú.

### El buscador

Es la otra forma de no recorrer las 38 filas. Filtra por nombre con `sinTildes()`, porque nadie
escribe «Faldón» con acento cuando va con prisa. Mientras hay búsqueda **las secciones se abren
solas** —igual que en la calculadora, `abiertas.has(grupo) || Boolean(busqueda)`—: esconder un
resultado detrás de una cabecera plegada es lo contrario de buscar. Y *Otras* se oculta mientras
se busca; su fila de escribir entre los resultados solo estorba.

Se puede escribir el valor desde el resultado del filtro: las filas son las mismas, no una copia.

### Las secciones se pliegan, con el mismo acordeón de la calculadora

Con el menú entero son siete secciones y 37 filas. `abiertas` es un `Set` y `alternar()` es el
mismo de [app/boleta.js](app/boleta.js) — si tocas uno, mira el otro.

Dos reglas que hacen que no estorbe:

- **Arrancan abiertas las secciones que el pedido toca**, que es lo que hay que trabajar; si no
  hay ninguna, la primera, para no dejar la pantalla en blanco. Se recalcula al **cambiar de
  pedido**, no al añadir una pieza: si no, cerrar una sección duraría hasta la siguiente tecla.
- **Cerrada, la cabecera dice `hechas/puestas`** (o «5 sin usar»). Es lo único que queda a la
  vista de esa sección: sin el contador, plegar sería esconder trabajo pendiente.

`.flecha` se reutiliza tal cual, pero con el borde en claro: en la calculadora va sobre papel y
acá sobre el fondo oscuro, y con `--ink-soft` no se veía.

### Ya no se pega una lista, y el intérprete se borró

Hubo un panel para pegar el pedido entero, con un intérprete que reconocía «Parachoques
delantero: 4», «Techo 4» o «- Llantas 12» y una tabla de `ALIAS` (rines, spoiler, polarizado…).
**Se quitó a pedido del usuario** cuando la pantalla pasó a ser el menú completo: teniendo las
36 casillas delante, pegar era un rodeo. `interpretarLinea()`, `interpretarLista()` y `ALIAS` se
borraron de `tunning-categorias.js` en vez de quedarse ahí sin llamar — están en el historial de
git si alguna vez hacen falta. No los vuelvas a añadir sin que se pidan.

Lo que sí se quedó es que **`crear()` acepta las piezas en la misma llamada que la creación** y
`agregar()` acepta un objeto o un arreglo: es lo que permitiría volver a cargar un pedido entero
en una sola escritura, y contra Supabase cada llamada lee y reescribe la colección completa.

### El orden de la lista es el del menú, no el de llegada

`ordenar()` y `ordenDe()` viven en
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

### La pantalla es solo el checklist

Hubo un *modo trabajo* —una pieza a pantalla completa— y una voz que cantaba la siguiente con la
Web Speech API. Los dos se probaron y **se quitaron a pedido del usuario**: en la práctica se
trabaja mirando la lista entera y marcando. No los vuelvas a agregar sin que los pida.

Un pedido tampoco se **cierra**: se trabaja y se elimina. El bloque *Cerrados* de la pantalla
sigue ahí solo para los que quedaron cerrados con la versión anterior — sin él no habría forma de
volver a verlos ni de sacarlos. `cerrar()` y `{ cerrado }` en la API se quedan por eso.

### La pantalla se pinta al instante y la escritura va por detrás

Marcar y escribir un valor esperaban **dos** idas al servidor —la que guardaba y un `recargar()`
de la lista entera— con toda la pantalla deshabilitada mientras tanto. Con treinta piezas eso se
siente pegado. Ahora cambian el estado local primero y mandan después; si la escritura falla se
vuelve a leer y la lista queda como esté en el servidor, con el aviso. Medido: el check aparece
en menos de 80 ms, y diez casillas se rellenan en 256 ms sin perder ninguna.

**El identificador de una pieza nueva lo pone el navegador y el servidor lo respeta**
(`idPropuesto()` en `lib/tunning.js`: lo acepta si tiene forma de UUID y no está usado, si no
inventa uno). Sin eso, la fila pintada y la guardada serían piezas distintas, y marcar una
recién escrita no encontraría nada que marcar y no haría nada **en silencio**, hasta la
siguiente lectura.

**Lo tecleado se manda al parar de escribir, no en cada tecla** (medio segundo, y de inmediato
al salir del campo). Escribir «12» son dos teclas y sería reescribir la colección entera dos
veces para un solo número. Mientras se teclea **manda lo tecleado**: si no, la respuesta de una
escritura anterior pisaría el campo justo mientras alguien escribe dentro.

**Lo tecleado vive dentro de la fila, no en la pantalla.** Antes era un mapa `borradores` en el
componente de arriba, y entonces cada tecla volvía a pintar las 38 filas, el resumen y el
acordeón enteros: eso es lo que se sentía pegado escribiendo. Ahora cada `Fila` guarda su texto
(`useState` local + su propio temporizador) y se sincroniza con el servidor solo cuando no se
está escribiendo dentro (`tecleando`, un `ref`). Si vuelves a subir ese estado, vuelve el tirón.

De ahí salen las otras tres piezas del mismo rompecabezas, y sin ellas subir el estado se cuela
solo:

- `Fila`, `FilaNueva`, `Grupo` y `Resumen` van envueltos en `memo()`, y los `onGuardar`,
  `onMarcar`, `onQuitar`, `onAnadir` y `alternar` en `useCallback`. Un callback nuevo en cada
  pintado hace que `memo()` no sirva de nada.
- **La línea escrita a mano tiene su propio estado** (`FilaNueva`). Estaba en la pantalla, y
  escribir «revisar frenos» repintaba el menú entero letra a letra.
- **`recargar()` no toca el estado si el servidor dice lo mismo** (`mismos()`, comparando el
  JSON). El sondeo es cada 15 s y cambiar la referencia repinta las 38 filas para nada.
- Los nombres se normalizan una sola vez (`buscable` en `filas`), no en cada tecla del buscador.

Tres piezas más que no son adorno:

- **Las escrituras van en cola, no en paralelo** (`cola` en `tunning.js`). Cada una lee y
  reescribe la colección entera: dos a la vez se pisan y una marca se pierde. Marcando rápido
  eso pasa siempre. La cola encadena con `then(tarea, tarea)` para que un fallo no la deje rota.
- **El sondeo no pisa mientras hay escrituras en vuelo** (`pendientes`). Si no, la respuesta del
  `GET` trae la lista de antes de la marca y el check salta hacia atrás.
- **Las filas ya no llevan `bloqueado`.** Deshabilitar la lista mientras viaja una marca era
  justo lo que la hacía sentirse lenta.

Al medir esto, cuidado con la prueba: sondear el servidor con `waitForFunction` lanza un `fetch`
por fotograma, ahoga al servidor de desarrollo y hace parecer que se pierden marcas cuando lo
que falta es turno de CPU. Consulta cada 300 ms.

`agregar` y `quitar` son del route handler; toda la API pasa por `exigirTaller()`, así que un
invitado del casino no entra. Se guardan los últimos 20 pedidos cerrados: sirven para consultar,
no para siempre.

## Inventario de la bodega

**[app/inventario/](app/inventario/)** — qué hay en la bodega y cuánto, actualizado subiendo
capturas del juego. Un artículo es `{ id, nombre, peso, cantidad, visto, vistoPor }` en
`sunset:inventario`; cada carga queda anotada en `sunset:inventario-cargas`.

Lo actualiza **cualquiera con cuenta de taller**, no solo el admin: la bodega es una sola y el
que está delante de ella es quien puede contarla.

### Una captura no es la bodega entera

La bodega necesita varias pantallas y hay que bajar y subir. De ahí tres reglas:

- **Cargar es un upsert, nunca un reemplazo.** Lo que no sale en la foto se queda como estaba.
  Poner en cero lo no visto vaciaría el inventario con media captura.
- **El solape entre pantallas se colapsa solo.** Dos fotos consecutivas repiten filas; con el
  mismo número se callan. Con números **distintos** la fila queda `discrepa` y no se guarda: o
  falló el lector, o las fotos son de momentos distintos, y elegir una sería inventar.
- **`noVistos()` lista lo que la tanda no cubrió.** Solo marcando *recorrí la bodega entera* esas
  filas bajan a 0, y aun así pasan por la tabla de confirmación con su «173 → 0» a la vista.

### El nombre manda; el peso solo desempata, y por cercanía

Esto empezó al revés y **la medición lo tumbó**. En la bodega los nombres largos salen cortados
—hay dos tarjetas que se leen «KIT DE REPARACI…»—, así que la clave era el peso, que sale
entero. Pero al medir el lector contra una rejilla de 22 artículos: **las 22 cantidades salieron
exactas y dos pesos con errata** («36.00kg» leído «38.00kg», «560g» leído «580g»).

Con el peso de clave, un dígito mal convierte un artículo conocido en uno nuevo, y el inventario
se llena de duplicados en cada conteo. Así que `claveDe()` es el nombre, y cuando dos artículos
se llaman igual se elige el del peso **más parecido** (`masCercano()`), no el idéntico. Probado:
releer la misma captura dos veces deja 22 artículos, cero duplicados.

Por lo mismo, `aplicar()` **no pisa el peso ni el nombre guardados**: el nombre porque alguien
pudo escribir el completo a mano y una captura lo truncaría otra vez; el peso porque viene con
erratas y solo sirve para desempatar. En pantalla el peso **no se muestra** salvo cuando hay dos
artículos con el mismo nombre.

### El lector: Gemini, desde el servidor

**[lib/gemini.js](lib/gemini.js)** — un `fetch`, sin SDK ni dependencias, igual que Supabase o el
webhook de Discord. Necesita `GEMINI_API_KEY`; sin ella la sección funciona igual anotando a
mano y la API responde 503 con ese mensaje.

- **La llamada va desde el route handler, nunca desde el navegador.** Si la hiciera el cliente,
  la llave viajaría con él. Mismo motivo por el que `SUPABASE_SERVICE_ROLE_KEY` no lleva
  `NEXT_PUBLIC_`.
- **Hay lista de modelos de reserva.** En una misma tarde aparecieron las dos formas de caerse:
  un modelo **retirado** para cuentas nuevas (404) y otro **saturado** (503). Con uno solo,
  cualquiera de las dos deja la función muerta. El 429 no se reintenta: ese es el límite de la
  cuenta y cambiar de modelo no ayuda.
- Las instrucciones le piden **copiar el nombre cortado tal cual**. Si lo completa de memoria,
  dos capturas de lo mismo devuelven nombres distintos y aparecen duplicados.
- `responseSchema` obliga a JSON válido, y `temperature: 0` a que dos lecturas de la misma
  imagen den lo mismo.

Medido de punta a punta: 22 de 22 filas, 22 de 22 cantidades exactas, cero filas inventadas,
4,1 s por captura. **Aun así nada se guarda sin que una persona mire la tabla** — el acierto es
alto, no perfecto, y un número mal que entra en silencio se descubre en la bodega buscando una
pieza que no está.

### Cada casilla se lee por su posición en la rejilla

La duplicación que se vio en producción —«140» en una fila y «40» en otra del mismo kit— pasaba
**dentro de una sola captura**: el lector devolvía la misma tarjeta dos veces, una bien y otra con
un dígito de menos, y `comparar()` las tomaba por dos artículos.

Dos redes, y las dos hacen falta:

- **`responseSchema` exige `fila` y `columna`.** Con la posición, repetir una casilla es
  imposible: la segunda cae en la misma coordenada y se descarta en `leerCaptura()`. El número de
  descartadas viaja hasta la pantalla — quien sube la foto tiene derecho a saberlo.
- **Dentro de una tanda, mismo nombre con peso parecido es la misma tarjeta** (`pesosParecidos`,
  20% de margen). Los dos «KIT DE REPARACI…» de verdad pesan 28 kg y 8,28 kg, así que siguen
  separados; un «140» y un «40» de la misma tarjeta se juntan y quedan como `discrepa`.

**Una contradicción no se resuelve sola** —no hay forma de saber si eran 140 o 40—, pero los dos
números salen como botones y elegir cuesta un clic. Antes la fila quedaba fuera y había que
anotarla a mano.

La pantalla dice **cuántas casillas trajo cada captura**. Es el número que permite darse cuenta
al instante: la rejilla de la foto se cuenta con el dedo.

### La captura se pega con Ctrl + V

Es como se saca de verdad: se recorta la pantalla del juego con la herramienta de Windows y
queda en el portapapeles. Antes había que guardarla en el escritorio, buscarla en el diálogo de
archivos y abrirla — tres pasos para nada.

- El listener va en **`document`**, no en un campo con el foco: quien acaba de recortar la
  pantalla no ha hecho clic en ningún sitio. Se suscribe **una sola vez** y lo que cambia en
  cada pintado (si está leyendo, y la función que lee) entra por refs.
- **Pegar abre el conteo** si no había ninguno (`setLeidos((antes) => antes ?? [])`). Si no,
  quien pega antes de pulsar *Registrar conteo* no vería absolutamente nada pasar.
- Las imágenes del portapapeles **no traen nombre**, así que se les pone «captura pegada 1, 2…»
  para que la lista de casillas leídas se entienda.
- Queda la opción de elegir el archivo, en pequeño: hay navegadores y teclados donde pegar no
  funciona.

### Completar los nombres cortados es una acción aparte

El juego trunca los nombres en su propia pantalla, así que esas letras **no están en la imagen** y
ninguna lectura las recupera. Deducirlas sí se puede: «CABLEADO DE ALTER…» es «CABLEADO DE
ALTERNADOR».

Pero **deducir en cada escaneo es lo que causaba los duplicados**: dos capturas de lo mismo darían
dos nombres distintos. Por eso `sugerirNombres()` va aparte, se pide una vez, y lo propuesto pasa
por una revisión antes de guardarse. Como el casado es por prefijo, un nombre completo guardado
sigue reconociendo las capturas cortadas — medido: tras completar, reescanear la captura da cero
nuevos.

Las sugerencias traen `seguro`, y lo dudoso sale marcado. Funciona: de doce nombres, las dos que
marcó como dudosas eran justo las dos discutibles. Cada fila enseña **su peso y su cantidad**
porque dos artículos pueden compartir el texto cortado y recibir la misma propuesta; sin eso no
habría forma de saber cuál se está corrigiendo.

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

### Las imágenes se pegan como URL, no se suben

**A pedido del usuario, ninguna pantalla pide un archivo del escritorio.** Los flyers, los
pop-ups y las capturas de devoluciones llevan **un enlace**: la imagen ya está publicada en
algún sitio —la deja FiveM al hacer la captura, o se sube a Discord— y bajarla para volver a
subirla era un paso de más.

`normalizarEnlace()` y `exigirEnlace()` viven en **[lib/enlaces.js](lib/enlaces.js)**, que no
toca el almacén justamente para que también lo puedan importar las pantallas. **Se valida pero
no se descarga**: ir a buscar desde el servidor una URL que escribe cualquiera es pedir que le
pidan cosas de la red interna. La imagen la carga el navegador de quien mira.

Lo publicado antes **sigue funcionando**: un flyer con `imagen` guardada se sirve por
`/api/flyers/:id/imagen` como siempre, y `fuenteDeFlyer()` decide cuál de las dos usar. Por eso
el aviso del bucket de Supabase solo aparece si quedan flyers de los antiguos.

La CSP ya aceptaba cualquier `https:` en `img-src` por las capturas pegadas de devoluciones, así
que no hubo que tocarla.

El estilo "futurista" de la galería vive en `.flyer-marco`: el borde de degradado es un fondo con
`padding: 1px` y un `::before`, porque los bordes CSS no aceptan degradados. El barrido de luz y
el desplazamiento están anulados bajo `prefers-reduced-motion`.

## Pop-ups al entrar

**[lib/popups.js](lib/popups.js)** — el cartel que tapa la pantalla al entrar a la app, con lo
que hay que leer **antes** de ponerse a trabajar. La campanita avisa de algo que pasó; esto es
para algo que hay que ver sí o sí.

- **`hasta` es el tiempo límite y lo decide el servidor.** `listarVigentes()` es lo único que
  sale hacia el navegador de cualquiera: si saliera todo y la pantalla filtrara por fecha,
  habría dos sitios donde equivocarse. Pasada la hora deja de salir **solo**, que es lo que
  permite usar la función sin acordarse de apagar nada — un «hoy cerramos temprano» que sigue
  saliendo el martes enseña a la gente a cerrar los pop-ups sin leerlos.
- Un límite **ya pasado se rechaza** al guardar (400). Guardarlo dejaría el cartel muerto al
  nacer y quien lo escribió creería que se está mostrando.
- Vacío es **sin límite**: sale hasta que alguien lo apague.
- Los vencidos **no se borran**: el encargado los sigue viendo en su lista para reutilizarlos,
  y `Apagar`/`Encender` no toca el texto.

**[app/popups-al-entrar.js](app/popups-al-entrar.js)** va dentro de `Barra`, que está en todas
las pantallas del taller y del casino: así el cartel sale estés donde estés, sin repetir la
misma línea en catorce páginas. Comprobado también dentro de una mesa del casino.

**Se muestra una vez por sesión del navegador**, no en cada clic: la marca va en
`sessionStorage`. Cada entrada nueva —el login, u otra pestaña— lo enseña otra vez; recargar la
misma pestaña, no. Con `localStorage` saldría una sola vez en la vida de ese navegador y quien
lo cerrara sin leerlo no volvería a verlo nunca.

### Notificaciones internas: lo mismo, en frío

**[app/anuncios/notificaciones.js](app/anuncios/notificaciones.js)** — el primer bloque de
Anuncios, para todo el taller. El cartel del login se cierra con un clic y a veces se cierra sin
leer; acá queda para volver a mirarlo mientras siga vigente, con cuánto le queda.

Sale de **la misma lista que el cartel** (`GET /api/popups`, que ya devuelve solo lo vigente),
así que al acabarse el tiempo desaparece de acá también sin que nadie borre nada. Si esta
pantalla filtrara por su cuenta habría dos sitios donde equivocarse. Se refresca sola cada
minuto: comprobado que una que vence mientras la miras se va sin recargar.

**Los botones del panel no van sobre papel.** `.accion` es texto color crema porque siempre va
sobre fondo oscuro; la fila de pop-ups usaba `var(--ticket)` de fondo y los botones quedaban
crema sobre crema — invisibles. Las tarjetas de solo lectura sí son de papel, porque ahí no hay
ningún `.accion` dentro.

El panel para escribirlos es **[app/anuncios/popups.js](app/anuncios/popups.js)**, dentro de
Anuncios y solo para admin: es lo mismo que los flyers y los mensajes — cosas que el encargado
publica para que el taller las vea. El campo del tiempo límite pasa por `desdeInput()`, como el
resto de la app: está en hora de Chile, y con `new Date()` se leería en la zona del navegador.

## Avisos (la campanita)

**[lib/avisos.js](lib/avisos.js)** — notificaciones dentro de la app, compartidas por todas las
funciones que necesiten avisar algo.

`para` es un usuario, o el comodín `ADMINS` para todos los administradores. Ese comodín se
resuelve **al leer**, no al escribir: quién es admin puede cambiar entremedio. Por lo mismo, los
avisos a `ADMINS` guardan `leidoPor: []` en vez de un `leido` booleano — si un admin marcara leído
un aviso compartido, desaparecería para los demás.

No hay correo ni notificación al teléfono: eso necesita un servicio externo (Resend o similar) y
no está montado.

### Los avisos se borran

Con la app en uso a diario la lista crece sola —cada cierre de turno, cada solicitud— y se hacía
una columna interminable dentro de un menú de 300 px. `borrar(usuario, { id, admin })` saca uno,
o todos los de quien pide si no viene `id`. La ruta es `DELETE /api/avisos` y
`DELETE /api/avisos?id=…`, las dos en el mismo archivo porque hacen lo mismo con el mismo
chequeo.

- **Un aviso propio se borra de verdad; uno a `ADMINS` solo se esconde**, apuntando a quien lo
  borró en `ocultoPor`. Borrar la fila de un aviso compartido se lo quitaría de la campanita a
  los otros administradores, que no pidieron nada. Es exactamente el motivo por el que existe
  `leidoPor` y no un `leido` suelto. Comprobado con dos admins: uno borra el compartido y el
  otro sigue viendo sus cuatro.
- **El dueño se comprueba en el servidor.** El identificador se puede mandar a mano; borrar el
  aviso de otro responde `400 Ese aviso no es tuyo.` Verificado.
- Borrar el mismo dos veces responde 400 la segunda, no un 500 ni el borrado de otro.
- **La fila se saca de la pantalla antes de que el servidor conteste.** Con la lista llena,
  esperar la respuesta para que desaparezca una línea se siente pegado; si la escritura falla se
  vuelve a leer y la lista queda como esté de verdad, con el mensaje a la vista.
- La `×` está **apagada hasta pasar por encima de la fila**: veinte cruces encendidas serían lo
  único que se ve en el menú. En pantalla táctil no hay «pasar por encima», así que ahí se ve
  siempre (`@media (hover: none)`) — sin esa regla, en el teléfono no habría forma de borrar.
- La cabecera lleva la cuenta y el botón de *Borrar todos*, y ese botón **solo aparece si hay
  algo**.

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

### Ninguna escritura es a ciegas: `cambiar()`

`lib/almacen.js` exporta `cambiar(clave, aplicar)`, que es `modificar()` con la forma que usa
todo `lib/`: `aplicar(lista)` recibe la lista **recién leída** y devuelve `{ lista, valor }`
para guardar o `{ error }` para no tocar nada.

Se llegó a esto midiendo. El patrón «leer, cambiar, guardar» estaba escrito a mano en cuarenta
sitios, y en todos perdía escrituras simultáneas igual que los turnos:

```
SEIS ACCIONES EN EL MISMO INSTANTE          antes        ahora
licencias: crear                            1 de 6       6 de 6
devoluciones: crear                         1 de 6       6 de 6
inventario: cargar captura                  1 de 6       6 de 6
usuarios: crear cuenta                      1 de 6       6 de 6
avisos, mensajes, turnos                     idem        6 de 6
saldo: seis apuestas de 100 sobre 1.000      600         400 ✔
```

Dos reglas al usarlo:

- **Las comprobaciones van dentro del callback**, no antes. Si otro escribió entremedio, se
  vuelve a llamar con lo que hay ahora, y así «no existe», «no es tuya» o «es el único
  administrador» se deciden contra la lista de verdad. Eso es lo que impide que dos borrados a
  la vez dejen el taller sin ningún admin.
- **Lo que no debe repetirse va fuera**: un `randomUUID()`, una fecha, o el hash de una clave
  (200.000 iteraciones). Se calcula una vez y el reintento guarda lo mismo.

Los efectos que no son la escritura —borrar la imagen de una devolución, anotar la carga del
inventario, avisar por Discord— van **después** y solo si se guardó. Al revés se borraba la
captura de una solicitud que seguía existiendo.

`guardar()` sigue existiendo para el arranque y para las pruebas, pero **en `lib/` ya no queda
ninguna llamada**: si escribes una nueva, estás reintroduciendo el fallo.

### Las escrituras simultáneas ya no se pisan

Cada colección es un JSON que se lee y se reescribe entero. Eso significa que dos operaciones a
la vez leen lo mismo y **la segunda en guardar borra a la primera**. No era teórico: al empezar
el turno marcan todos juntos, y medido con seis marcajes simultáneos **quedaba uno**, con la app
diciéndoles a los seis que sí. Llegaron reclamos de gente que marcaba y no le marcaba.

Lo guardado va envuelto: `{ rev, datos }`. `rev` es un testigo que cambia en cada escritura, y
**`guardarSi(clave, rev, datos)` escribe solo si el testigo sigue siendo el que se leyó**:

- **Supabase** lo resuelve en una sola sentencia: `PATCH …&valor->>rev=eq.<rev>` con
  `Prefer: return=representation`; cero filas devueltas significa que otro se adelantó. Si la
  fila no existe se crea con un `POST` **sin** `on_conflict`, y el 409 por clave duplicada es
  justo la señal de que alguien la creó primero.
- **Archivo** compara el testigo dentro de la misma cola de escritura, que en un solo proceso es
  atómico.
- **Redis** mira el testigo justo antes; la ventana es mínima y es el backend secundario.

`modificar(clave, aplicar)` es lo que se usa desde arriba: lee, aplica, escribe condicional, y si
pierde la carrera **rehace el cambio sobre lo que hay ahora** — no sobre lo que había—. Diez
intentos con espera creciente, y si aun así no entra **devuelve error en vez de decir que sí**.

Lo viejo se sigue leyendo: una colección guardada como arreglo pelado se entiende igual y queda
envuelta en la primera escritura. No hay que migrar nada a mano — comprobado contra la Supabase
de producción, con datos en el formato viejo y diez escrituras simultáneas: 10 de 10 guardadas,
cero perdidas, el registro viejo intacto.

**`marcarEntrada()` y `marcarSalida()` van por ahí, y también el cierre automático**: cerrar un
turno vencido al abrir una página podía llevarse por delante el marcaje que otro estaba haciendo
en ese instante.

### Avisos en el escritorio antes de que se cierre el turno

**[app/aviso-escritorio.js](app/aviso-escritorio.js)** — notificaciones del sistema (las de
Windows) a los 15 y a los 5 minutos del cierre, y otra al cerrarse.

**No son push y no hay que fingir que lo son.** Push necesita service worker, suscripción y un
servicio de envío; esta app no tiene proceso de fondo. El aviso salta mientras la pestaña siga
abierta —aunque esté detrás del juego o minimizada—, y con el navegador cerrado no. La pantalla
lo dice con esas palabras.

- **Se mira el reloj cada 20 s en vez de programar un `setTimeout` a tres horas vista.** Si el
  equipo se suspende o el navegador congela la pestaña, el temporizador exacto no dispara cuando
  debía; mirando el reloj, al volver el aviso sale enseguida.
- **Lo ya avisado se anota en `localStorage`** por turno y umbral: si no, recargar la página
  vuelve a avisar de lo mismo.
- **El permiso no se pide al cargar.** Un navegador que pregunta sin que nadie lo haya pedido es
  lo que hace que la gente pulse «bloquear» por reflejo, y de ahí no se vuelve. El botón sale en
  el menú de perfil, y en la barra de marcaje cuando ya quedan menos de 15 minutos.

### Zona horaria

Todo se guarda en ISO/UTC y se muestra en `America/Santiago`, fijo, no en la zona del navegador —
si no, el mismo turno se leería distinto según quién lo mire. `desdeInput()`/`paraInput()` en
`lib/tiempo.js` hacen la conversión para los `<input type="datetime-local">` del panel; sin ellas
un admin en otra zona horaria correría cada turno que tocara.

### Un turno se cierra solo a las 3 horas

Regla de negocio, no detalle técnico: **no hay conexión con FiveM**, así que un turno abierto no
prueba que la persona siga en el taller. A las `HORAS_MAXIMAS` horas se cierra y quien siga
trabajando vuelve a marcar entrada. Así las horas registradas nunca son inventadas.

**El cierre ocurre al leer, no en un proceso de fondo** — esta app no tiene ninguno. `leerAlDia()`
cierra lo vencido y **todo lo que consulte turnos debe pasar por ahí**; si alguna ruta lee la
lista cruda, mostrará abiertos turnos que ya deberían estar cerrados.

La salida no se pone en «ahora» sino en **`entrada + 3h` exactas**. Es lo que hace que el
resultado no dependa de cuándo alguien abra la app: si nadie entra en tres días, el turno igual
queda cerrado a las tres horas, no a los tres días.

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
