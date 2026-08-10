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

## Paso 5 — La base de datos

Acá se guardan los usuarios y los turnos.

1. En tu proyecto de Vercel, pestaña **Storage**.
2. **Create Database** → elige **Upstash for Redis** (aparece como KV) → **Continue**.
3. Ponle un nombre, por ejemplo `sunset-datos`, y elige la región más cercana.
4. **Connect** al proyecto `sunset-motors`, con los tres entornos marcados.

Vercel agrega solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`. La aplicación las
detecta sin que toques una línea de código.

> **Sin este paso la app funciona igual, pero mal:** guarda todo en un archivo del servidor, y
> ese disco se borra en cada despliegue. Perderías los usuarios y el registro de turnos cada vez
> que subas un cambio. El panel de administración te avisa en pantalla mientras esté así.

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

**Primero, trae las variables de Vercel a tu máquina:**

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local
```

`vercel link` te pregunta a qué proyecto conectar: elige `sunset-motors`. El último comando
escribe un archivo `.env.local` con las credenciales de la base. Ese archivo está en el
`.gitignore`, así que nunca se sube.

**Ahora crea tu cuenta:**

```bash
npm run usuarios crear mjcruz18 UNA-CLAVE-LARGA-Y-TUYA -- --admin
```

Debe responder `Creado "mjcruz18" como administrador en la base de datos (Redis)`. Si dice
`(local)`, el `.env.local` no se cargó: revisa que el archivo exista y que tenga
`KV_REST_API_URL`.

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
Falta `vercel env pull .env.local`, o lo corriste parado en otra carpeta.

**`git push` rechaza el envío diciendo «rejected».**
Creaste el repositorio en GitHub con README o .gitignore. Lo más simple es borrar ese
repositorio en GitHub y rehacer el Paso 2 sin marcar esas casillas.

**Subiste algo que no querías.**
Borrar el archivo y hacer commit no lo saca del historial. Si fue una clave o algo sensible, lo
práctico es borrar el repositorio en GitHub, cambiar lo que se filtró (el `SUNSET_SECRETO`, la
clave que sea) y volver a subir desde cero.
