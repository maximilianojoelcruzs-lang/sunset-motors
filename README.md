# Sunset Motors — Boleta de cobro

Calculadora de cobros del taller, hecha a partir de la hoja `Base` del Excel
`Calculadora_SUNSETMOTORS.xlsx`.

Todo corre en el navegador: las cantidades que escribe una persona no afectan a nadie más y no
se guardan en ningún servidor. Funciona igual en celular y en PC.

## Subirlo a Vercel

**Está todo explicado paso a paso en [PUBLICAR.md](PUBLICAR.md)** — GitHub, Vercel, la base
de datos y el primer administrador. Sigue esa guía la primera vez.

En resumen: repositorio en GitHub → importar en [vercel.com/new](https://vercel.com/new) →
agregar `SUNSET_SECRETO` → crear la base en Supabase y agregar sus dos variables → crear el
primer usuario desde la terminal.

Sin `SUNSET_SECRETO` y sin base de datos la app se publica pero **nadie puede entrar**. Es a
propósito: así no queda un secreto por defecto dando vueltas en internet.

## Probarlo localmente

```bash
npm install
npm run dev
```

Queda en http://localhost:3000. En local funciona sin configurar nada, pero la base parte
vacía: crea un usuario para poder entrar.

```bash
npm run usuarios crear tu.usuario tu-clave-larga -- --admin
```

## Usuarios

Cada mecánico entra con su propio usuario y clave. El usuario queda al pie de las boletas
que emite (`Atendió: …` en el texto que copias) y arriba, en "Turno de …".

**Los usuarios viven en la base de datos, no en el código.** Por eso el repositorio se puede
publicar sin exponer ningún hash, y dar de alta a alguien no exige volver a desplegar.

**Lo normal:** desde la app, botón *Registro* → **Mecánicos con cuenta** → crear, cambiar
clave, hacer administrador o borrar. Sin terminal.

**La excepción:** el primer administrador, que no puede crearse desde la app porque no hay
nadie con quien entrar. Ese va por línea de comandos:

```bash
npm run usuarios crear mjcruz18 una-clave-larga -- --admin
```

El mismo comando sirve para todo lo demás si lo prefieres:

```bash
npm run usuarios listar
npm run usuarios clave <usuario> <clave-nueva>
npm run usuarios admin <usuario> si|no
npm run usuarios borrar <usuario>
```

Sin configurar nada trabaja sobre tu computador. Si existe un `.env.local` con las
credenciales de la base real (`vercel env pull .env.local`), trabaja sobre producción — así
se crea el administrador inicial del sitio publicado. El comando te dice siempre cuál de las
dos está tocando.

La clave nunca se guarda: queda solo un hash PBKDF2-SHA256 con 200.000 iteraciones y sal
propia. Ni tú puedes leer la clave de nadie. Si alguien la olvida, se le pone una nueva.

**La sesión no se cae a media tarde.** Dura 30 días y **se renueva sola cada vez que entras**,
así que quien usa la app a diario no vuelve a escribir su clave. Quien deja de entrar la pierde
igual al mes. Va en una cookie firmada con `SUNSET_SECRETO`. Cambiar esa
variable cierra de inmediato todas las sesiones abiertas: es el botón de "echar a todos".

**Suspender una cuenta** (en *Mecánicos con cuenta*) es el punto medio entre dejar entrar y
borrar: la cuenta se queda con su historial y su clave, y no entra a ninguna parte — ni al
taller ni al casino—. Si tiene la app abierta, se queda fuera en el siguiente clic, y al
intentar entrar el login le dice que está suspendida. Se reactiva con el mismo botón y vuelve
a ser lo que era. No puedes suspenderte a ti mismo ni al único administrador activo.

Hay un solo permiso: **administrador**. Es lo que abre el registro de turnos y la gestión de
cuentas. Se da y se quita desde el mismo panel.

**Probar claves a lo bruto no funciona.** Después de cinco intentos fallidos hay que esperar,
y la espera se dobla con cada fallo: 15 segundos, 30, un minuto… hasta media hora. El límite es
por cuenta **y** por computador, así que nadie puede dejarte fuera fallando adrede desde otro
lado. Si te pasa a ti, espera lo que diga el mensaje y entra normal.

**Cerrar una cuenta la cierra al instante.** Antes, quien tuviera la app abierta seguía usándola
hasta que su sesión caducara —hasta 30 días—. Ahora, en cuanto el encargado la borra, la
siguiente pantalla que abra esa persona la manda al login.

Lo que este login **no** hace: no hay recuperación automática de claves — el administrador le
pone una nueva a quien la olvide.

## Registro de entrada y salida

Arriba de la calculadora cada mecánico tiene una barra con **Marcar entrada** / **Marcar
salida**. Mientras el turno está abierto muestra desde qué hora y cuánto lleva.

Lo mismo se puede hacer desde el **menú de perfil**, arriba a la derecha, que además sirve
estando en el registro. Los dos muestran siempre lo mismo.

Marcar entrada dos veces no duplica nada: el turno abierto se respeta. Marcar salida sin
turno abierto avisa y no hace nada.

### El turno se cierra solo a las 3 horas

La app no está conectada al juego, así que no puede saber si alguien sigue realmente
trabajando. Por eso **un turno abierto se cierra automáticamente al cumplir 3 horas**, y quien
siga en el taller vuelve a marcar entrada. Así las horas del registro son siempre horas que
alguien confirmó.

La barra muestra cuánto falta (*«se cierra solo en 34 min»*) y se pone roja en los últimos 15
minutos, para que no pille a nadie de sorpresa.

**Y puede avisarte en el escritorio.** Pulsa *🔔 Avisarme antes de que se cierre* —está en el menú
de perfil, y también en la barra cuando quedan menos de 15 minutos— y el navegador te pedirá
permiso una vez. A partir de ahí te salta una notificación de Windows a los 15 y a los 5 minutos,
y otra cuando el turno se cierra.

Con una condición que conviene saber: **la pestaña tiene que seguir abierta**, aunque esté detrás
del juego o minimizada. Con el navegador cerrado del todo no hay aviso — para eso haría falta
contratar un servicio de notificaciones aparte.

Cuando se cierra, la salida queda anotada en la hora exacta en que se cumplieron las 3 horas —
no cuando alguien abrió la página. Y le llega un aviso a la persona: en la campanita, y en
Discord si está configurado.

En el registro esos turnos aparecen marcados como **cerrado solo**, para que el encargado sepa
por qué terminaron ahí.

### Pop-ups al entrar

En *Anuncios* → **Pop-ups al entrar**, el encargado escribe un cartel que le sale a todo el
mundo al entrar a la app, con título, mensaje y, si quiere, una imagen (pegando su enlace).

Cada pop-up lleva un **tiempo límite**: pasada esa hora deja de salir solo, sin que nadie tenga
que acordarse de apagarlo. Hay atajos —2 horas, hoy, 3 días, 1 semana— y también se puede dejar
sin límite. Un límite que ya pasó no se acepta: te avisa en vez de guardar un cartel que nadie
vería.

Sale **una vez por entrada**: al iniciar sesión y al abrir la app en otra pestaña. Recargar la
misma pestaña no lo repite, para no estorbar a quien ya lo leyó. Los vencidos se quedan en la
lista del encargado por si quiere volver a usarlos, y se pueden apagar y encender sin perder el
texto.

### Avisos por Discord

En *Registro* → **Avisos por Discord**, el encargado puede pegar la URL de un webhook. En tu
servidor de Discord: *Editar canal → Integraciones → Crear webhook*.

Con eso, cada cierre automático se anuncia en ese canal. Para que mencione a la persona en vez
de solo nombrarla, ponle su **ID de Discord** desde *Mecánicos con cuenta* → botón *Discord*.

Es opcional: sin webhook, el aviso llega igual a la campanita. Y hay un botón **Enviar prueba**
para comprobar que quedó bien antes de confiar en él.

### El panel de administrador

Los usuarios con `admin: true` ven un botón **Registro** que lleva a `/admin`. Ahí está
todo el registro: quién, qué día, entrada, salida y horas, con filtros por mecánico y por
rango de fechas, y el total de horas de cada uno según lo que esté filtrado.

Desde ahí el encargado puede **corregir** un turno (cambiar las horas, cerrar uno que quedó
abierto, dejar una nota con el motivo) y **borrar** uno. Los turnos corregidos quedan
marcados como tales, con la nota visible al pasar el mouse. Un turno no puede quedar con la
salida antes que la entrada: se rechaza.

**El registro del taller es solo del administrador.** Un mecánico no puede ver los turnos de
nadie más: `/admin` lo devuelve a la calculadora, no le aparece el botón *Registro*, y si
pide el registro por API recibe un 403. Corregir y borrar también son solo del encargado.
Todo eso se verifica en el servidor, no escondiendo botones.

Lo que sí puede ver cada uno son **sus propios turnos**, desde el menú de perfil →
*Mis turnos*: sus horas de los últimos 7 días, el acumulado y el detalle día por día. Solo
lo suyo — no hay forma de pedir los turnos de otra persona.

Cuando el encargado corrige un turno, **el motivo queda escrito bajo la fila**, junto a quién
lo corrigió, y también le aparece a esa persona en *Mis turnos*. Las horas de alguien no
cambian sin explicación a la vista.

### Casino

Pestaña **Casino**: una sala aparte, con su propia identidad. Es entretención de rol para el
servidor — **no se juega con dinero real ni se puede convertir en dinero real**.

**Tus fichas se actualizan solas.** La cifra de arriba se pone al día cada veinte segundos —y
al instante cuando vuelves a la pestaña—, así que si el encargado te recarga mientras tienes el
casino abierto, lo ves sin recargar la página.

> **Cerrado a los jugadores.** Hoy solo lo ven los administradores: todas las cuentas quedaron
> sin acceso y con el saldo en 0. Para reabrirlo, dale *Dar casino* a quien corresponda desde
> *Registro* → *Mecánicos con cuenta*, y repárteles fichas.

**Las once mesas están abiertas.**

| Mesa | Retorno al jugador | Se queda la casa |
|---|---|---|
| Vídeo póker (Jacks or Better 9/6) | hasta 99,5% | 0,5% jugando perfecto |
| Blackjack | ~99,4% | ~0,5% con estrategia básica |
| Ruleta europea | 97,30% | 2,70% |
| Dados (apuestas sencillas) | 97,22% | 2,78% |
| Dados (triples) | 83,8% – 86,1% | 13,9% – 16,2% |
| Plinko | ~97,0% | ~3,0% |
| Ruleta de la suerte | 97,50% | 2,50% |
| Mines | 97,00% | 3,00% |
| Duelo de cartas (bando) | 96,30% | 3,70% |
| Carrera de surf | 95,00% | 5,00% |
| Duelo de cartas (empate) | 88,75% | 11,25% |
| Tragamonedas | 94,27% | 5,73% |
| Rasca y gana | 92,00% | 8,00% |

En el póker y el blackjack el retorno depende de **cómo se juegue**: son los dos únicos donde las
decisiones cambian el resultado, así que esas cifras son el techo, no una promesa.

Son las tablas de pago de un casino real, comprobadas con cientos de miles de tiradas. En los
dados, cada apuesta muestra su ventaja en pantalla: las sencillas son las buenas y las de
triple pagan mucho pero valen poco, igual que en una mesa de verdad.

### Top de wager

Pestaña **Top de wager** dentro del casino. Es un ranking por **fichas apostadas**: cada apuesta
que haces suma, ganes o pierdas. Los tres primeros al cerrar el ciclo se llevan **30.000, 20.000 y
5.000 fichas**.

Cuenta igual en las once mesas. Las recargas del encargado no suman. Si dos empatan, queda por
delante quien lo hizo en menos jugadas. Y si estás fuera del podio, debajo de la tabla te dice
cuántas fichas de wager te faltan para entrar.

Dentro de la misma pantalla, el botón **Cómo funciona** abre las reglas completas: qué cuenta y
qué no, un ejemplo de una tarde de dos personas —donde la que perdió fichas va primera y el que
ganó va último—, los cuatro pasos del ciclo y los desempates. Está para cualquiera que juegue, no
solo para el encargado.

El ciclo **lo cierra el encargado** cuando quiera, no hay fecha automática. Al cerrarlo los
premios entran solos a la cuenta de los tres primeros, los contadores vuelven a cero y el podio
queda guardado en *Ciclos cerrados*. Si algún premio no se pudiera pagar, la pantalla dice a quién
hay que pagarle a mano.

### Fichas

Cada persona parte con 5.000 fichas. El administrador reparte o quita desde el **panel**,
sección *Fichas del casino*: escribe el nombre, la cantidad (negativa para quitar) y el motivo.
Ahí mismo se ven las últimas veinte jugadas de todo el mundo, con quién jugó, a qué, cuánto
apostó y cuánto ganó o perdió.

Las fichas **no se compran, no valen dinero y no se convierten en dinero**. Son de rol.

Se apuesta **poniendo fichas**: 50, 100, 500, 1.000 y 5.000. La cifra que aparece al lado no se
escribe a mano, cambia al tocar una ficha — en una mesa de verdad no se puede apostar 501. En las
mesas donde se apilan fichas en varios sitios (ruleta, surf, duelo) el total de un sitio sí puede
ser cualquier suma armable con esas fichas, tocando varias veces.

### Retirar fichas

En el casino hay un botón **Retirar fichas**. La persona pide cuántas quiere retirar y **se le
descuentan en el momento**; al administrador le llega el aviso —campanita y Discord— para
entregarle el dinero dentro del juego.

Se descuentan al pedir y no al entregar por una razón simple: si el saldo siguiera ahí, se
podría pedir el retiro y seguir jugando esas mismas fichas, y el encargado terminaría pagando
algo que ya no existe.

En el panel, sección **Retiros del casino**, el encargado ve los que esperan con un contador
al lado del título. Puede marcar *«ya se lo entregué»* o **rechazar**, que le devuelve las
fichas a la persona y se lo avisa. Cada movimiento queda anotado en el registro de jugadas.

Solo se puede tener **una solicitud abierta a la vez**: si no, el encargado no sabe cuáles ya
pagó.

### Todo se actualiza solo

Ya no hace falta apretar F5. La campanita, las licencias, las devoluciones, los anuncios, los
documentos, el registro y los retiros se ponen al día solos cada 20 o 30 segundos, y de
inmediato al volver a la pestaña.

Con la pestaña escondida se detiene: no tiene sentido consultar toda la noche una ventana que
nadie mira. Medido: un retiro pedido desde otra sesión aparece en el panel del encargado en
unos 16 segundos, sin que nadie recargue nada.

### Las tragamonedas

Tres rodillos y una línea. Los rodillos llevan **pesos**, como una máquina real: hay treinta
cerezas por cada dos sietes en la cinta, y por eso el trío de 7 sale una vez cada 111.111
giros. El programa no corrige nada al final — sortea cada rodillo y paga lo que salga.

| Línea | Paga |
|---|---|
| 7️⃣ 7️⃣ 7️⃣ | x500 |
| 💎 💎 💎 | x100 |
| ⭐ ⭐ ⭐ | x40 |
| 🔔 🔔 🔔 | x20 |
| 🍋 🍋 🍋 | x12 |
| 🍒 🍒 🍒 | x8 |
| 🍒 🍒 (dos exactas) | x1 |

Algo se gana en **1 de cada 4 giros**, casi siempre las dos cerezas. Ese premio de consuelo es
el que hace que la máquina se sienta viva: sin él solo pagaría el 5,5% de los giros.

### El vídeo póker

Se reparten cinco cartas, tocas las que te quedas y el resto se cambia. Es el juego con mejor
retorno de la sala.

| Mano | Paga |
|---|---|
| Escalera real | x800 |
| Escalera de color | x50 |
| Póker | x25 |
| Full | x9 |
| Color | x6 |
| Escalera | x4 |
| Trío | x3 |
| Doble pareja | x2 |
| Pareja de J o mejor | x1 |

La pareja de jotas paga x1, o sea que te devuelve la apuesta: ni ganas ni pierdes. El x9 del full
y el x6 del color son los pagos completos — las máquinas de verdad los recortan a 8/5 o 7/5, y ahí
es donde se les cae el retorno.

El mazo se baraja entero **en el servidor** antes de que elijas, así que las cartas que vienen ya
estaban decididas. Al terminar se marcan las cartas que pagaron y se apagan las demás.

Si cierras la pestaña entre el reparto y el cambio, al volver te encuentras la misma mano: la
apuesta ya estaba cobrada y dejarla botada sería quedarse con tus fichas.

### El Plinko

La bolita cae por 12 filas de clavos y en cada choque se va a un lado o al otro. Por eso las
casillas del centro se llenan y las de las puntas casi nunca salen: la del medio sale el 22,6%
de las veces y cada punta **1 de cada 4.096**.

Hay tres niveles de riesgo, y **los tres devuelven lo mismo**:

| Riesgo | La punta paga | Cómo se siente |
|---|---|---|
| Bajo | x8,64 | casi nunca te vas con las manos vacías |
| Medio | x38,37 | el equilibrio de siempre |
| Alto | x244,10 | o la punta, o nada |

Elegir riesgo cambia **cómo** se gana, no **cuánto**. Los pagos no están escritos a mano: se
calculan desde la probabilidad de cada casilla, así que las tres tablas quedan cuadradas solas.

Se pueden soltar **1, 3, 5 o 10 bolitas de una vez**. Cada una cuesta la apuesta entera y cae
por su cuenta: soltar diez no mejora nada, solo reparte lo mismo en diez tiros.

### La carrera de surf

Seis surfistas, una ola, un ganador. Se puede apostar a varios en la misma carrera.

| Surfista | Gana | Paga |
|---|---|---|
| Kala (Shortboard) | 30% | 3,17 |
| Nico (Fish) | 24% | 3,96 |
| Mía (Gun) | 18% | 5,28 |
| Tavo (Longboard) | 13% | 7,31 |
| Rex (Bodyboard) | 9% | 10,56 |
| Lupe (Foil) | 6% | 15,83 |

Kala gana 3 de cada 10 olas; una cuota justa pagaría 3,33 y paga 3,17. Esa diferencia, **la
misma en los seis**, es el 5% que se queda la casa — igual que en una casa de apuestas de
verdad. Apostar al favorito o al que nadie mira da lo mismo a la larga.

### Mines

25 casillas y unas cuantas minas. Destapas de a una, cada casilla limpia sube el multiplicador
y cobras cuando quieras. Una mina y se pierde todo.

Puedes elegir 1, 3 o 5 minas. Con más minas cada casilla paga más, pero se vuela antes — y por
eso no hay opciones más altas: con 10 el multiplicador se dispara en cinco casillas y la partida
deja de sentirse una partida.

Lo interesante: **da igual dónde te plantes**. Cobrar en la primera casilla o en la décima
devuelve el mismo 97% a la larga — lo único que cambia es cada cuánto ganas. Y tampoco sirve
de nada "elegir bien" una casilla: las minas se siembran antes de que destapes la primera y
todas las tapadas son iguales.

### La ruleta de la suerte

Acá no se elige dónde apostar: se gira y se cobra lo que marque el gajo.

| Gajo | Cuántos | Sale |
|---|---|---|
| x10 | 1 | 2,5% |
| x3 | 3 | 7,5% |
| x1,5 | 8 | 20% |
| x0,8 | 10 | 25% |
| Vacío | 18 | 45% |

La ventaja de la casa son **los 18 gajos vacíos**, no un pago recortado: cada gajo paga
exactamente lo que dice. Sale un 2,50%, contra el 11%–24% de una rueda de feria de verdad.

### El duelo de cartas

Una carta para el Rojo, una para el Azul, gana la más alta. El as vale 1 y el rey 13; el palo da
igual. Se apuesta a **Rojo**, a **Azul** o a **Empate**, y se puede poner ficha en más de uno.

| Apuesta | Paga | Se queda la casa |
|---|---|---|
| Rojo o Azul | 1 a 1 | 3,70% |
| Empate | 11 a 1 | 11,25% |

**Si sale empate, quien apostó a un bando pierde la mitad.** No es un castigo suelto: es de ahí
de donde sale la ventaja de la casa en este juego, y es la misma regla del Dragon Tiger de un
casino de verdad. Sin ella, apostar a un bando sería una apuesta justa.

El empate sale 7 de cada 100 manos. Paga mucho, pero es de lejos la peor apuesta de la mesa — y
por eso su ventaja va escrita en la pantalla, al lado del pago.

### El blackjack

| Regla | |
|---|---|
| Mazos | 6, barajados en cada mano |
| El crupier | se planta en 17, también en el 17 blando |
| Blackjack | paga 3 a 2 |
| Doblar | con dos cartas cualesquiera, también tras separar |
| Separar | hasta 4 manos · los ases reciben una carta |
| Seguro | no hay |

**No hay seguro a propósito**: es la peor apuesta de una mesa de blackjack, con casi un 7% para
la casa. Y el blackjack paga 3 a 2 y no 6 a 5, que es el recorte con el que los casinos reales
más que duplican su ventaja sin cambiar nada más.

Jugando bien, a la casa le queda alrededor del **0,5%**. Comprobado con 200.000 manos jugadas con
estrategia básica.

La carta tapada del crupier se queda en el servidor hasta que terminas tu mano: no viaja al
navegador ni siquiera escondida. Una partida a medias también se retoma al recargar.

### La ruleta

Europea, un solo cero, 37 casillas. **Se apuesta a varios sitios a la vez**, como en una mesa
de verdad: eliges el valor de la ficha, tocas el paño, y cada toque apila otra ficha ahí.
Manteniendo pulsada una ficha —o con el botón derecho— la quitas, y están *Deshacer*, *Limpiar*
y *Repetir* para volver a poner la apuesta anterior tal cual.

Las fichas también van **entre casillas**, y ahí es donde aparecen las apuestas que hacen a la
ruleta lo que es:

| Apuesta | Dónde va la ficha | Paga |
|---|---|---|
| Pleno | sobre un número | 35:1 |
| Caballo | entre dos números | 17:1 |
| Calle | al borde de una fila de tres | 11:1 |
| Trío (con el 0) | en la esquina del cero | 11:1 |
| Cuadro | donde se tocan cuatro | 8:1 |
| Los cuatro primeros | 0, 1, 2 y 3 | 8:1 |
| Seisena | al borde, entre dos filas | 5:1 |
| Docena o columna | fuera del paño | 2:1 |
| Rojo, negro, par, impar, 1-18, 19-36 | fuera del paño | 1:1 |

Son **145 sitios distintos**, exactamente los de una mesa europea: ni falta ninguno ni hay
ninguno inventado.

Todas dan la misma **ventaja de la casa: 2,70%**. No es casualidad ni está ajustado a mano — el
pago sale de una sola fórmula, así que un pleno, un caballo y un rojo devuelven los mismos 97,30
de cada 100. Comprobado casilla por casilla y con medio millón de tiradas.

**El número lo sortea el servidor**, no el navegador, y el saldo se descuenta ahí mismo. La
rueda que gira en pantalla se limita a mostrar el resultado que ya salió.

### Quién entra al casino

Hay cuatro tipos de cuenta:

| Cuenta | Entra a |
|---|---|
| **Mecánico** | solo el taller |
| **Invitado del casino** | solo el casino: no ve la calculadora ni nada del taller |
| **Mecánico con casino** | a las dos, y cambia con un botón en la barra |
| **Administrador** | a todo, más el panel |

El **mecánico con casino** tiene en la barra un botón que dice *🎰 Casino* cuando está en el
taller y *🔧 Taller* cuando está en el casino. Un clic y cambia de vista, sin recargar y sin
volver a entrar. Los administradores lo tienen igual.

Todo esto se reparte desde el **panel**, en *Mecánicos con cuenta*: cada persona tiene los
botones *Dar casino* y *Quitar taller*, y al crear una cuenta están las casillas. Dar el casino a
un mecánico **no lo saca del taller** — para dejar a alguien solo de casino hay que quitarle el
taller a propósito.

También desde la terminal:

```bash
npm run usuarios crear nombre clave -- --casino             # solo casino
npm run usuarios crear nombre clave -- --casino --taller    # mecánico con casino
npm run usuarios casino nombre si                           # dárselo a alguien que ya existe
npm run usuarios taller nombre no                           # dejarlo solo de casino
```

## Licencias y ausencias

Pestaña **Licencias**. Cada mecánico crea su solicitud con tipo, fechas de inicio y término,
y motivo.

Se guarda primero como **borrador**, que solo ve su autor y puede editar o eliminar las veces
que quiera. Al pulsar **Enviar** le llega un aviso al encargado, que puede **aprobar** o
**rechazar** dejando un comentario. En cualquiera de los dos casos le llega el aviso de vuelta
a quien la pidió.

Una vez resuelta queda de solo lectura: es el registro de una decisión, no un formulario.

El encargado ve tres pestañas: *Por revisar* (con el número pendiente), *Resueltas* y
*Las mías*.

## Devoluciones

Pestaña **Devoluciones**, para la plata que un mecánico puso de su bolsillo y el taller le
tiene que reponer.

Se crea con el monto, de qué es, y **el enlace de la captura del juego donde se vea lo que
pagó** — la URL que deja FiveM al hacer la captura. Sin ella no se puede enviar: es la prueba.
Ya no se sube el archivo desde el escritorio: la captura ya está subida, así que se pega y
listo. Igual que en licencias, primero es un borrador
privado que se puede editar o eliminar, y al pulsar **Enviar** queda *Pendiente de pagar*.

El encargado la marca **Pagado** o la **Rechaza**, con un comentario. En su pestaña *Por
pagar* ve además el total que el taller debe en ese momento.

Los avisos van a los dos lados: al encargado cuando llega una solicitud, y al mecánico cuando
la envía y cuando se resuelve.

**Ojo con la privacidad del enlace.** Una captura pegada vive donde la subió FiveM: quien tenga
esa URL la puede abrir, aunque no tenga cuenta en la app. Las capturas antiguas, las que se
subieron como archivo cuando eso existía, siguen siendo privadas: solo las abre quien subió la
solicitud y el encargado.

## Tunning

Pestaña **Tunning**, para no tener que volver a mirar la tablet cada dos piezas.

**Está el menú completo del juego, en el mismo orden**, y de cada categoría solo se rellena la
casilla de la derecha: el número que hay que elegir, o el color. Las que el pedido no trae se
dejan en blanco. Así se baja por la lista igual que se baja por la tablet, sin buscar cada pieza
en un desplegable y sin escribir el nombre largo, que dentro del menú no se usa para nada.

Se empieza con **Nuevo pedido**, que abre la lista en blanco. Rellenar siete casillas leyendo la
tablet toma menos de un segundo en total: se escribe y se guarda solo, sin pulsar nada.

Cada categoría aparece **una sola vez**, como en el juego: volver a poner «Techo» cambia el
número en vez de dejar dos filas que se contradicen, y corregir un número no desmarca lo que ya
estaba instalado. Vaciar la casilla saca esa pieza del pedido.

**A la derecha aparece el resumen: solo las piezas que hay que sacar**, con su número, sin las
treinta categorías que el pedido no trae. Es la lista corta con la que se camina al almacén, y
se queda a la vista mientras bajas por el menú. Lo que ya instalaste queda tachado en vez de
desaparecer, para que la lista no se mueva bajo tus ojos.

Arriba hay un **buscador por nombre**: escribe `faldon` —con o sin tilde— y queda esa sola fila.
Se puede rellenar el valor directamente desde el resultado.

**Las secciones se abren y se cierran**, igual que en la calculadora: se pulsa el título y la
sección se pliega. Al abrir el pedido ya vienen abiertas las secciones que tiene que trabajar y
plegadas las demás, así no hay que recorrer las cuarenta filas para llegar a la que toca. Aunque
esté cerrada, a la derecha del título se ve cuánto lleva —`2/5`— o «5 sin usar» si el pedido no
trae nada de ahí. *Abrir todo* y *Cerrar todo* hacen lo que dicen.

Al final está **Otras**, para lo que el menú del juego no contempla: se escribe con tus palabras
—«revisar frenos antes de entregar», «las llantas las trae el cliente»— y el número es opcional,
porque muchas veces la frase ya es todo el recado. Esas líneas se quitan con la × de la derecha;
las del catálogo, vaciando su casilla.

Se marca cada pieza al instalarla —volver a pulsar la desmarca— y lo marcado queda guardado: si
se cierra la pestaña o se cambia de computador, la lista sigue donde iba.

Al terminar el auto se **elimina** el pedido con el botón de la derecha. Un pedido no lleva
patente: se abre, se trabaja y se elimina mientras el auto está en el elevador, y se distingue
por la hora en que se abrió.

## Inventario

Pestaña **Inventario**: qué hay en la bodega y cuánto, sin llevarlo en un papel.

**Recortas la pantalla del juego y la pegas con Ctrl + V.** Nada de guardarla en el escritorio
y buscarla en un diálogo de archivos: la recortas, pegas en la pestaña y se lee sola —el conteo
se abre solo al pegar la primera—. La bodega no cabe en una pantalla, así que se baja y se sube
pegando varias: las filas repetidas entre pantallas se juntan solas. En la prueba leyó 22 de 22
artículos con las 22 cantidades exactas, en cuatro segundos por captura.

Si tu navegador no deja pegar, al lado queda la opción de siempre para elegir el archivo.

**Nada entra sin que lo mires.** Antes de guardar aparece la tabla con lo que entendió: qué es
nuevo, qué cambió y de cuánto a cuánto. Lo que no se entendió queda marcado y no se guarda.

Un conteo **no borra** lo que no saliste a fotografiar: lo demás se queda como estaba, y la
columna *Visto* dice cuándo se contó cada cosa por última vez. Solo marcando *recorrí la bodega
entera* lo que no apareció baja a cero — y aun así pasa por la misma tabla antes de guardarse.

Después de cada captura te dice **cuántas casillas leyó**, para que lo compares con la rejilla de
la foto de un vistazo. Si el lector se contradice —la misma tarjeta con dos números—, te muestra
los dos y eliges con un clic; nunca elige por su cuenta.

**Los nombres cortados se pueden completar.** El juego corta los nombres largos en su propia
pantalla («CABLEADO DE ALTER…»), así que esas letras no están en la foto y no hay nada que leer.
El botón *Completar nombres cortados* propone el nombre entero de cada uno, marca de cuáles no
está seguro, y tú apruebas o corriges antes de guardar. Después de completarlos, las capturas
siguen reconociéndolos igual.

Cualquiera con cuenta del taller puede contar, no solo el encargado. Los nombres y las cantidades
se corrigen a mano en la lista, y queda anotado quién hizo cada conteo.

Si no hay lector configurado (`GEMINI_API_KEY`), la pestaña funciona igual anotando a mano.

## Anuncios

Pestaña **Anuncios**, con tres partes.

**Flyers.** La galería de imágenes que publica el encargado. Se publica **pegando el enlace de
la imagen** —la URL que sale al subirla a Discord, a Imgur o la que deja FiveM—, no subiendo el
archivo: la imagen ya está en internet, así que basta con apuntar a ella. Se abren en grande al
hacer clic. Solo el encargado publica y elimina; todo el taller mira. Cuando publica uno nuevo,
le llega el aviso a todos.

**Mensajes listos para copiar.** Textos que el encargado deja guardados —anuncio de apertura,
promoción de la semana, lo que sea— con un botón **Copiar** al lado. El mecánico lo copia y lo
pega tal cual en el anuncio del juego, sin escribirlo de memoria ni equivocarse en el número
de teléfono.

**Pop-ups al entrar.** Ver más arriba: el cartel que sale al entrar a la app, con su tiempo
límite.

## Avisos

La campanita de la barra, con el número de avisos sin leer. Ahí llegan las solicitudes nuevas
para el encargado y las respuestas para el mecánico. Se marcan como leídos al abrirla.

**Y se borran.** Cada aviso tiene una **×** a la derecha —siempre visible en el teléfono, y al
pasar el mouse por encima en el computador—, y arriba está **Borrar todos** con la cuenta de
cuántos hay. Con la app en uso a diario la lista se hacía interminable.

Los avisos que van *a los administradores* se borran **solo para ti**: al otro encargado le
siguen apareciendo hasta que él los borre. Y nadie puede borrar el aviso de otra persona.

Son avisos **dentro de la app**: aparecen cuando la persona entra. No hay correo ni
notificación al teléfono — eso necesita contratar un servicio aparte.

### El menú de perfil

Arriba a la derecha, con las iniciales. Adentro:

- **Marcar entrada / salida**, con el tiempo que lleva el turno abierto
- **Mis turnos** — el historial propio
- **Cambiar mi clave** — cada uno la suya, pidiendo la actual. Así nadie queda dependiendo
  del encargado para cambiarla, y quien pille una sesión abierta no puede dejar fuera al
  dueño de la cuenta
- **Cerrar sesión**

Los dos primeros abren una ventana sobre la página, no se van a otra: si estabas armando una
boleta, no pierdes lo que llevabas cargado.

### Dónde se guarda

Usuarios y turnos comparten el mismo almacén. Hay tres, y la app elige según las variables
de entorno que existan:

| Backend | Se activa con | Para qué |
|---|---|---|
| **Supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Producción. Es el recomendado. |
| Redis | `KV_REST_API_*` o `UPSTASH_REDIS_REST_*` | Si ya tienes uno andando |
| Archivo | ninguna de las anteriores | Solo tu computador |

La configuración de Supabase está paso a paso en [PUBLICAR.md](PUBLICAR.md), incluido el SQL
de la tabla, que son dos líneas.

**Sin ninguna variable** todo va a `.datos/*.json`, archivos en el disco del servidor. En tu
computador eso es cómodo y no requiere configurar nada. En Vercel **no sirve**: el disco es
efímero y se borra en cada despliegue. El panel avisa en pantalla cuando está en ese modo, y
arriba a la izquierda siempre dice en qué base está guardando.

Las horas se guardan en UTC y se muestran siempre en hora de Chile, sin importar desde
dónde se abra la app.

## Cambiar precios o agregar ítems

Desde la app: pestaña **Precios**, solo para administradores. Ahí cambias montos, agregas o
quitas ítems, creas secciones, las reordenas con las flechas y eliges su color. Al pulsar
**Guardar cambios** todo el taller ve los precios nuevos al instante, sin desplegar nada.

La casilla **Revisar** hace que el ítem muestre «precio por definir» en vez del monto, aunque
el precio igual se suma al total.

El orden de las secciones en el editor es el orden en pantalla: se reparten en dos columnas.

Si alguna vez los precios quedan hechos un desastre, el botón **Volver al original** restaura
el catálogo que trae el código (`lib/catalogo.js`), que es el que salió del Excel.

## Diferencias respecto al Excel

Tres cosas venían mal en el archivo original y quedaron corregidas o marcadas:

Los precios salen de la hoja `Valores`, columna **B** (nombre) y columna **D** (precio). La
columna C está vacía en el original. No se usa ninguna de las otras tablas de esa hoja.

| Qué pasaba en el Excel | Qué hace la app |
|---|---|
| El total de Partes principales era `=SUM(D4:D9)`, así que **Batería EV y Motor eléctrico nunca se sumaban** | Se suman los 8 ítems |
| **Neumáticos** (`D22`) era un `VLOOKUP` roto que devolvía vacío | Aparece como *precio por definir*, no hay valor que tomar |
| **Filtro de aceite** (`D17`) está en $0 | Queda en $0, igual que en la hoja |
| Los códigos de radio se habían convertido en fechas (`10-3` → 10/03/2024) | Quedaron como texto: 10-3, 10-4, 10-5, 10-8, 10-9, 10-20, 10-36, 10-37 |

Para ponerle precio a Neumáticos: edita `lib/catalogo.js`, cambia el `precio` y borra
`revisar: true` de esa línea.

**Ojo con las ubicaciones.** La boleta usa Paleto Bay $400 / Sandy Shores $300 / Ciudad $450,
pero la tabla "Precio de Otro Taller" del Excel decía Ciudad $300 / Sandy $400 / Paleto $500.
Dejé los valores que usaba la boleta. Si los correctos son los otros, cámbialos en la sección
`terreno`.

## Estructura

```
PUBLICAR.md     tutorial paso a paso para subirlo a GitHub y Vercel
middleware.js   el portero: sin cookie válida, todo va a /login
app/
  layout.js     tipografías y metadatos
  page.js       arma el contexto (usuario, si es admin, turno abierto)
  boleta.js     la calculadora completa
  marcaje.js    la barra de entrada/salida
  login/        formulario de entrada
  tunning/      la lista de piezas por patente, en orden del menú del juego
  casino/       las mesas
  admin/        registro de turnos (panel.js) y cuentas (mecanicos.js)
  api/          login, logout, turnos y usuarios
  globals.css   estilos
lib/
  catalogo.js   precios y tablas de referencia  ← lo único que se edita seguido
  usuarios.js   alta, baja y verificación de cuentas contra la base
  sesion.js     firma y verifica la cookie de sesión
  servidor.js   lee la sesión desde páginas y route handlers
  hash.mjs      parámetros del hash de claves
  turnos.js     abrir, cerrar, corregir y borrar turnos
  tunning.js    pedidos de tunning · tunning-categorias.js, el orden del menú
  almacen.js    dónde se guarda todo (Redis o archivo)
  tiempo.js     formato de horas, siempre en hora de Chile
scripts/
  usuarios.mjs  administra cuentas desde la terminal
```
