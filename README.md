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

La sesión dura 12 horas y va en una cookie firmada con `SUNSET_SECRETO`. Cambiar esa
variable cierra de inmediato todas las sesiones abiertas: es el botón de "echar a todos".

Hay un solo permiso: **administrador**. Es lo que abre el registro de turnos y la gestión de
cuentas. Se da y se quita desde el mismo panel.

Lo que este login **no** hace: no hay límite de intentos fallidos, y no hay recuperación
automática de claves — el administrador le pone una nueva a quien la olvide.

## Registro de entrada y salida

Arriba de la calculadora cada mecánico tiene una barra con **Marcar entrada** / **Marcar
salida**. Mientras el turno está abierto muestra desde qué hora y cuánto lleva.

Lo mismo se puede hacer desde el **menú de perfil**, arriba a la derecha, que además sirve
estando en el registro. Los dos muestran siempre lo mismo.

Marcar entrada dos veces no duplica nada: el turno abierto se respeta. Marcar salida sin
turno abierto avisa y no hace nada.

### El turno se cierra solo a las 2 horas

La app no está conectada al juego, así que no puede saber si alguien sigue realmente
trabajando. Por eso **un turno abierto se cierra automáticamente al cumplir 2 horas**, y quien
siga en el taller vuelve a marcar entrada. Así las horas del registro son siempre horas que
alguien confirmó.

La barra muestra cuánto falta (*«se cierra solo en 34 min»*) y se pone roja en los últimos 15
minutos, para que no pille a nadie de sorpresa.

Cuando se cierra, la salida queda anotada en la hora exacta en que se cumplieron las 2 horas —
no cuando alguien abrió la página. Y le llega un aviso a la persona: en la campanita, y en
Discord si está configurado.

En el registro esos turnos aparecen marcados como **cerrado solo**, para que el encargado sepa
por qué terminaron ahí.

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

Se crea con el monto, de qué es, y **la captura del juego donde se vea lo que pagó**. Sin esa
captura no se puede enviar: es la prueba. Igual que en licencias, primero es un borrador
privado que se puede editar o eliminar, y al pulsar **Enviar** queda *Pendiente de pagar*.

El encargado la marca **Pagado** o la **Rechaza**, con un comentario. En su pestaña *Por
pagar* ve además el total que el taller debe en ese momento.

Los avisos van a los dos lados: al encargado cuando llega una solicitud, y al mecánico cuando
la envía y cuando se resuelve.

**Las capturas son privadas.** Solo las abre quien subió la solicitud y el encargado; a
cualquier otro le responde «No autorizado», aunque tenga el enlace. Ver [PUBLICAR.md](PUBLICAR.md)
para crear el bucket.

## Anuncios

Pestaña **Anuncios**, con dos partes.

**Flyers.** La galería de imágenes que publica el encargado. Se abren en grande al hacer clic
y se pueden descargar. Solo el encargado sube y elimina; todo el taller mira. Cuando publica
uno nuevo, le llega el aviso a todos.

**Mensajes listos para copiar.** Textos que el encargado deja guardados —anuncio de apertura,
promoción de la semana, lo que sea— con un botón **Copiar** al lado. El mecánico lo copia y lo
pega tal cual en el anuncio del juego, sin escribirlo de memoria ni equivocarse en el número
de teléfono.

## Documentos

Pestaña **Documentos**: el reglamento interno, los contratos, los manuales, los acuerdos con
la policía o el hospital. Lo que hoy anda suelto en un canal de Discord.

El encargado sube archivos **PDF o imagen**, con título, descripción y categoría. La categoría
la escribe él —no hay lista fija—, y la vista agrupa los documentos por esa categoría. Hay
buscador por título, descripción o categoría.

Todo el taller puede abrirlos: los PDF se ven dentro de la misma página, las imágenes en
grande, y siempre está el botón de descargar.

Se guardan en privado igual que las capturas: hace falta tener sesión para abrirlos, aunque se
tenga el enlace directo.

## Avisos

La campanita de la barra, con el número de avisos sin leer. Ahí llegan las solicitudes nuevas
para el encargado y las respuestas para el mecánico. Se marcan como leídos al abrirla.

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
  almacen.js    dónde se guarda todo (Redis o archivo)
  tiempo.js     formato de horas, siempre en hora de Chile
scripts/
  usuarios.mjs  administra cuentas desde la terminal
```
