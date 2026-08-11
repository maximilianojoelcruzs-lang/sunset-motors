# Publicar Sunset Motors

Guía de principio a fin: subir el proyecto a GitHub, publicarlo en Vercel y dejar la base de
datos funcionando. Son unos 20 minutos la primera vez.

Al terminar vas a tener una dirección en internet que tu equipo abre desde el celular, con
cada mecánico entrando con su propio usuario.

---

## Antes de empezar

Necesitas tres cosas, todas gratis:

- **Git** instalado. Comprueba con `git --version`. Si no lo tienes: <https://git-scm.com/downloads>
- Una cuenta en **GitHub**: <https://github.com/signup>
- Una cuenta en **Vercel**: <https://vercel.com/signup> — entra con «Continue with GitHub», así
  quedan conectadas desde el principio.

Todos los comandos se escriben parado en la carpeta del proyecto:

```bash
cd "C:/Users/maxim/OneDrive/Desktop/sunset-motors"
```

---

## Paso 1 — Preparar el repositorio

> **Ojo importante.** Ahora mismo esta carpeta está dentro de un repositorio git que arranca en
> `C:\Users\maxim`, es decir, en tu carpeta de usuario completa. Si subes eso, subes `Downloads`,
> `AppData` y todo lo demás. El primer comando crea un repositorio propio solo para el proyecto.

```bash
git init
git add .
git status
```

`git status` te muestra qué se va a subir. **Léelo.** Deben aparecer `app/`, `lib/`, `scripts/`,
`package.json`, los `.md`… y **no** deben aparecer `node_modules`, `.next`, `.datos` ni
`.env.local`. De eso se encarga el `.gitignore`, pero conviene mirar.

Si todo está bien:

```bash
git commit -m "Calculadora de cobros, registro de turnos y login"
```

---

## Paso 2 — Crear el repositorio en GitHub

1. Entra a <https://github.com/new>.
2. **Repository name**: `sunset-motors`.
3. **Private** o **Public**, a tu gusto. Con los usuarios en la base de datos ya no hay claves
   en el código, así que público es seguro. Si dudas, elige *Private*: Vercel despliega igual.
4. **No marques** «Add a README», «Add .gitignore» ni «Choose a license». El proyecto ya los
   trae y marcarlos crea un conflicto al subir.
5. **Create repository**.

En la pantalla siguiente, copia la dirección que te muestra y ejecuta:

```bash
git remote add origin https://github.com/TU-USUARIO/sunset-motors.git
git branch -M main
git push -u origin main
```

Reemplaza `TU-USUARIO` por el tuyo. La primera vez se abre una ventana para iniciar sesión en
GitHub.

Recarga la página del repositorio: ahí están tus archivos.

---

## Paso 3 — Publicar en Vercel

1. Entra a <https://vercel.com/new>.
2. Busca `sunset-motors` en la lista y presiona **Import**.
3. **No cambies nada** de la configuración: Vercel reconoce Next.js solo.
4. **Deploy**.

En un par de minutos te da una dirección tipo `https://sunset-motors.vercel.app`.

**Todavía no la abras.** Sin las variables de entorno nadie puede entrar; eso es lo que sigue.

---

## Paso 4 — La clave que firma las sesiones

Genera un valor largo y al azar. En tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado (64 caracteres). Después, en Vercel:

**Settings → Environment Variables → Add New**

| Campo | Valor |
|---|---|
| Key | `SUNSET_SECRETO` |
| Value | el texto que acabas de generar |
| Environments | deja las tres marcadas |

**Save**.

Esto no es la clave de nadie: es lo que firma las cookies de sesión. Cambiarla más adelante
cierra de golpe todas las sesiones abiertas — el botón de «echar a todos».

---

## Paso 5 — La base de datos (Supabase)

Acá se guardan los usuarios y los turnos.

### 5.1 — Crear el proyecto

1. Entra a <https://supabase.com/dashboard> y crea una cuenta (puedes entrar con GitHub).
2. **New project**.
3. **Name**: `sunset-motors`. **Database Password**: genera una y guárdala en algún lado —
   no la vas a necesitar para esto, pero perderla después es molesto.
4. **Region**: la más cercana a tu equipo. Para Chile, `South America (São Paulo)`.
5. **Create new project**. Tarda un par de minutos en quedar listo.

### 5.2 — Crear la tabla

En el menú lateral: **SQL Editor** → **New query**. Pega esto tal cual y presiona **Run**:

```sql
create table if not exists datos (
  clave text primary key,
  valor jsonb not null
);

   alter table datos enable row level security;
```

Dos líneas y una tabla de dos columnas: eso es todo lo que necesita la app. Guarda cada
colección (`sunset:usuarios`, `sunset:turnos`) como un documento JSON.

La segunda instrucción es importante: enciende la seguridad por fila y **no** crea ninguna
política. El efecto es que la llave pública de Supabase no puede leer ni escribir nada en esa
tabla. Solo la llave de servicio, que vive únicamente en el servidor, se salta esa barrera.
Sin esa línea, cualquiera con la llave pública podría leerse los hashes de tus usuarios.

### 5.3 — Crear el bucket de imágenes

Las capturas de las devoluciones y los flyers no caben en la tabla: van a Supabase Storage.

En el menú lateral: **Storage** → **New bucket**.

| Campo | Valor |
|---|---|
| Name | `sunset` |
| Public bucket | **desmarcado** |

**Deja el bucket privado.** Una captura del inventario de alguien no tiene por qué quedar
abierta en internet para quien adivine la dirección. Con el bucket privado, la app pide una
URL firmada que dura cinco minutos, y solo la pide después de comprobar que quien mira es el
dueño de la solicitud o el encargado.

No hace falta crear políticas: la app entra con la llave `service_role`, que se las salta.

### 5.4 — Copiar las credenciales

En el menú lateral: **Project Settings** → **API**. Necesitas dos cosas:

| En Supabase | Cómo se llama acá |
|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `SUPABASE_URL` |
| **Project API keys → `service_role`** (hay que presionar *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |

En esa misma pantalla Supabase muestra también la URL del API REST, que es la misma con
`/rest/v1` al final. Da lo mismo cuál pegues: la app le quita esa parte si viene.

> **La `service_role` es la llave maestra de tu base.** No la pegues en el código, ni en un
> mensaje, ni en un archivo que vaya a GitHub. Solo va en las variables de entorno de Vercel y
> en tu `.env.local`, que está en el `.gitignore`.
>
> Fíjate bien de copiar `service_role` y no `anon`. Con la `anon` la app no va a poder escribir
> nada, porque acabas de encender RLS justamente para eso.

### 5.5 — Ponerlas en Vercel

**Settings → Environment Variables**, y agrega las dos, con los tres entornos marcados:

| Key | Value |
|---|---|
| `SUPABASE_URL` | tu Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | tu llave `service_role` |

> **Sin este paso la app funciona igual, pero mal:** guarda todo en un archivo del servidor, y
> ese disco se borra en cada despliegue. Perderías los usuarios y el registro de turnos cada vez
> que subas un cambio. El panel de administración te avisa en pantalla mientras esté así, y
> arriba a la izquierda siempre dice en qué base está guardando.

---

## Paso 6 — Volver a desplegar

Las variables solo entran en vigor en un despliegue nuevo.

Pestaña **Deployments** → los tres puntos del primero de la lista → **Redeploy** → **Redeploy**.

---

## Paso 7 — Crear el primer administrador

La base de datos está vacía. Nadie puede entrar todavía, y la app te lo dice en la pantalla de
login en vez de quedarse muda.

Este primer usuario es el único que no se puede crear desde la aplicación — sería un agujero
enorme que cualquiera pudiera. Se crea desde tu computador, apuntando a la base real.

**Primero, pon las credenciales de la base en tu máquina.** Crea un archivo `.env.local` en la
carpeta del proyecto con estas dos líneas, copiando los mismos valores del Paso 5.3:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=la-llave-service_role
```

Sin comillas y sin espacios alrededor del `=`. Ese archivo está en el `.gitignore`: nunca se
sube a GitHub.

> **¿Y por qué no `vercel env pull`?** Porque si marcaste las variables como *Sensitive* en
> Vercel —que es lo recomendable para una llave maestra— Vercel **no puede devolvértelas**: son
> de solo escritura. `vercel env pull` te va a traer un archivo sin ellas y el comando siguiente
> escribiría en tu disco en vez de la base. Copiarlas a mano desde Supabase es el camino
> confiable.
>
> Si además ves un `WARNING! Failed to install the official Vercel Claude plugin`, ignóralo: es
> una extensión del propio CLI, no tiene relación con tu proyecto.

**Ahora crea tu cuenta:**

```bash
npm run usuarios crear mjcruz18 UNA-CLAVE-LARGA-Y-TUYA -- --admin
```

Debe responder:

```
Creado "mjcruz18" como administrador en la base de datos (Supabase).
```

**Lee esa última palabra.** Si dice `(local)`, escribió en tu disco y no en Supabase: el
`.env.local` no se cargó. Revisa que el archivo exista, que tenga `SUPABASE_URL` y que estés
parado en la carpeta del proyecto.

Puedes confirmarlo desde Supabase: **Table Editor** → tabla `datos` → debe haber una fila con
clave `sunset:usuarios`.

**Entra a tu dirección de Vercel con ese usuario.** Ya está funcionando.

---

## Paso 8 — Dar de alta al resto del taller

De aquí en adelante no necesitas la terminal nunca más.

Dentro de la app: botón **Registro** → abajo, **Mecánicos con cuenta** → llenar usuario y clave
inicial → **Crear cuenta**. Le pasas la clave a la persona y listo.

Desde ahí mismo puedes cambiarle la clave a quien la olvide, hacer administrador a alguien o
borrar una cuenta. Los turnos ya registrados de una persona borrada se conservan.

---

## Subir cambios más adelante

Cada vez que edites algo — un precio en `lib/catalogo.js`, por ejemplo:

```bash
git add .
git commit -m "Subir el precio de los frenos"
git push
```

Vercel lo detecta y vuelve a publicar solo, en un minuto. No hay que tocar nada más.

**Los usuarios y los turnos no se ven afectados**: viven en la base de datos, no en el código.

---

## Si algo sale mal

**«Todavía no hay ningún usuario creado en este taller».**
Falta el Paso 7. Créalo desde tu computador con `npm run usuarios crear ... -- --admin`.

**«Falta configurar SUNSET_SECRETO en el servidor».**
Falta el Paso 4, o falta volver a desplegar después de agregarla (Paso 6).

**El panel dice «guardado en archivo local» en producción.**
Falta el Paso 5, o el redespliegue posterior. Los datos que se guarden mientras tanto se
perderán en el próximo despliegue.

**`npm run usuarios listar` dice «(local)» y esperabas la base real.**
Falta el `.env.local` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, o lo corriste parado en
otra carpeta. Revisa que no hayan quedado comillas ni espacios alrededor del `=`.

**`vercel env pull` dice `✓ Updated .env.local` pero el archivo llega casi vacío.**
Es lo esperado si tus variables son *Sensitive*: Vercel no puede devolverlas. Escríbelas a mano
como dice el Paso 7. Tampoco las trae si están marcadas solo para Production y Preview, porque
`env pull` lee el entorno Development.

**«Supabase respondió 401 al leer».**
Llave equivocada: revisa que copiaste `service_role` y no `anon`.

**«Supabase respondió 404 al leer», con `PGRST205`.**
La tabla `datos` no existe. Vuelve al Paso 5.2 y corre el SQL.

**«Supabase respondió 404 al leer», con `PGRST125: Invalid path`.**
La `SUPABASE_URL` trae una ruta rara. Debe ser solo `https://xxxx.supabase.co`, con o sin
`/rest/v1` al final; cualquier otra cosa sobra.

**«Supabase respondió 403» al guardar, pero leer funciona.**
Estás usando la llave `anon` con RLS encendido. Cambia a `service_role`.

**Todo anda, pero los turnos aparecen y desaparecen.**
Tienes las variables solo en algunos entornos de Vercel. En *Settings → Environment Variables*,
cada una debe estar marcada para Production, Preview y Development.

**`git push` rechaza el envío diciendo «rejected».**
Creaste el repositorio en GitHub con README o .gitignore. Lo más simple es borrar ese
repositorio en GitHub y rehacer el Paso 2 sin marcar esas casillas.

**Subiste algo que no querías.**
Borrar el archivo y hacer commit no lo saca del historial. Si fue una clave o algo sensible, lo
práctico es borrar el repositorio en GitHub, cambiar lo que se filtró (el `SUNSET_SECRETO`, la
clave que sea) y volver a subir desde cero.
