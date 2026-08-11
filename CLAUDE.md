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
  de sesión, sin aviso.

### El rol NO se comprueba en el middleware

`middleware.js` corre en Edge y **no puede leer la base** (`lib/almacen.js` usa `node:fs`).
Por eso el middleware solo verifica que haya sesión, y la autorización vive en
`app/admin/page.js` y en cada route handler, que corren en Node.

No muevas `esAdmin()` al middleware: rompe el build. Y no lo guardes en la cookie para poder
hacerlo: quitarle el rol a alguien dejaría de surtir efecto hasta que caduque su sesión.

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

## Documentos

**[lib/documentos.js](lib/documentos.js)** — reglamento, contratos, manuales y acuerdos. Mismo
patrón que los flyers: el admin publica, todo el taller consulta, sin estados ni aprobaciones.

- La **categoría es texto libre**, con sugerencias en un `datalist`. Una lista cerrada obligaría a
  tocar código cada vez que el taller inventa un tipo de documento, que es justo lo que estamos
  sacando de Discord. La vista agrupa por categoría.
- Editar cambia solo los datos. Para cambiar el archivo se sube uno nuevo y se borra el viejo:
  así no queda un documento cuyo título dice una cosa y cuyo PDF dice otra.
- Se firma por **una hora**, como los flyers: un PDF se abre y se lee un rato.

`lib/imagenes.js` acepta ahora también PDF, reconocido por sus primeros bytes (`%PDF-`). El
parámetro `permitidos` acota qué formatos toma cada uso: capturas y flyers siguen siendo solo
imágenes, los documentos aceptan además PDF.

### Constantes que necesita el cliente NO pueden vivir junto al almacén

Pasó dos veces: `TINTES` y `CATEGORIAS_SUGERIDAS`. Cualquier `export` que importe un componente
`'use client'` no puede estar en un módulo que —directa o indirectamente— importe
`lib/almacen.js`, porque usa `node:fs` y **rompe el build**. Van en `lib/catalogo.js` (que es
datos puros) o directamente en el componente.

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
