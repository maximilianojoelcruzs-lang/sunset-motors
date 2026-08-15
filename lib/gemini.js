// Leer una captura de la bodega con Gemini. Un `fetch` y nada más: sin SDK ni dependencias,
// igual que Supabase o el webhook de Discord.
//
// **Se llama solo desde el servidor.** Si la llamara el navegador, la llave viajaría al cliente
// y quedaría a la vista de cualquiera — el mismo motivo por el que SUPABASE_SERVICE_ROLE_KEY no
// lleva prefijo NEXT_PUBLIC_. La foto sube a nuestra API y la API consulta a Google.

// En orden de preferencia. Hay reserva porque en la misma tarde me encontré con las dos formas
// en que esto se cae: un modelo **retirado** para cuentas nuevas (404) y otro **saturado**
// (503). Con uno solo, cualquiera de las dos deja la función muerta hasta que alguien la toque.
// El «lite» va primero porque en la medición acertó igual que el grande y responde antes.
const MODELOS = [
  process.env.GEMINI_MODELO,
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
].filter(Boolean);

const urlDe = (modelo) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

export const hayLector = () => Boolean(process.env.GEMINI_API_KEY);

/**
 * Lo que se le pide. Tres cosas se explican porque el modelo, si no, «ayuda» y estorba:
 *
 * - **Copiar el nombre tal como se ve, cortado incluido.** El juego trunca los nombres largos en
 *   la propia pantalla; si el modelo los completa de memoria, dos capturas de lo mismo devuelven
 *   nombres distintos y el inventario se llena de duplicados.
 * - **Saltar las casillas vacías**, que en la rejilla son huecos sin texto.
 * - **El peso y la cantidad no se confunden**: la cantidad es la de la derecha y acaba en «x».
 */
const INSTRUCCIONES = `Esta es una captura del inventario de una bodega de un videojuego.
Es una rejilla rectangular de casillas. Cada casilla con contenido muestra:
- arriba a la izquierda, el peso (por ejemplo "28.00kg" o "210g")
- arriba a la derecha, la cantidad, que siempre termina en "x" (por ejemplo "140x")
- abajo, el nombre del artículo, en mayúsculas

Recorre la rejilla ordenadamente: fila por fila, de arriba abajo, y dentro de cada fila de
izquierda a derecha. Devuelve una entrada por cada casilla CON contenido, indicando en qué fila
y en qué columna está (empezando en 1).

Reglas estrictas:
1. Cada casilla aparece UNA SOLA VEZ. No repitas una casilla ya leída. Si dos casillas distintas
   muestran el mismo nombre, son artículos distintos y llevan fila y columna distintas.
2. Copia el nombre EXACTAMENTE como aparece, incluidos los puntos suspensivos si está cortado.
   No lo completes ni lo adivines. Si ves "KIT DE REPARACIÓN ..." escribe eso.
3. Las casillas vacías (sin texto ni icono) no se incluyen, pero sí cuentan para numerar las
   columnas: la casilla de su derecha conserva el número de columna que le toca.
4. La cantidad es el número de arriba a la derecha, sin la "x". Léela con cuidado: "140x" son
   ciento cuarenta, no cuarenta. El peso es el de la izquierda.
5. No inventes casillas que no estén en la imagen.`;

const ESQUEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      fila: { type: 'INTEGER' },
      columna: { type: 'INTEGER' },
      nombre: { type: 'STRING' },
      cantidad: { type: 'INTEGER' },
      peso: { type: 'STRING' },
    },
    // La posición es obligatoria: es lo que hace imposible que la misma casilla vuelva dos
    // veces con números distintos, que es como aparecían «140» y «40» del mismo kit.
    required: ['fila', 'columna', 'nombre', 'cantidad'],
  },
};

/**
 * Lee una imagen y devuelve `[{ nombre, cantidad, peso }]`.
 *
 * Lo que sale de acá **no se guarda**: va a la tabla de confirmación de la pantalla. Por bien
 * que lea, un número equivocado que entra en silencio deja el inventario mintiendo, y eso se
 * descubre en la bodega buscando una pieza que no está.
 */
export async function leerCaptura(bytes, tipo) {
  const llave = process.env.GEMINI_API_KEY;
  if (!llave) return { error: 'No hay lector de capturas configurado.' };

  const cuerpo = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: tipo, data: Buffer.from(bytes).toString('base64') } },
          { text: INSTRUCCIONES },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA,
      temperature: 0,
    },
  };

  let respuesta = null;
  let ultimo = '';

  for (const modelo of MODELOS) {
    try {
      respuesta = await fetch(urlDe(modelo), {
        method: 'POST',
        headers: { 'x-goog-api-key': llave, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
    } catch (e) {
      return { error: `No se pudo consultar el lector: ${e.message}` };
    }

    if (respuesta.ok) break;

    // 429 es el límite del plan gratuito: cambiar de modelo no ayuda, es de la cuenta.
    if (respuesta.status === 429) {
      return { error: 'El lector llegó a su límite por ahora. Prueba en unos minutos.' };
    }

    ultimo = `${respuesta.status}: ${(await respuesta.text()).slice(0, 160)}`;
    // 404 (retirado) y 503 (saturado) se reintentan con el siguiente; lo demás es nuestro.
    if (respuesta.status !== 404 && respuesta.status !== 503) break;
    respuesta = null;
  }

  if (!respuesta?.ok) return { error: `El lector respondió ${ultimo}` };

  const datos = await respuesta.json().catch(() => null);
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) return { error: 'El lector no devolvió nada legible.' };

  try {
    const crudas = JSON.parse(texto);
    if (!Array.isArray(crudas)) return { error: 'El lector devolvió algo que no es una lista.' };

    // Red de seguridad: aunque se le pida una entrada por casilla, a veces repite. Se queda la
    // primera lectura de cada posición. Sin esto, la misma tarjeta leída dos veces —una bien y
    // otra con un dígito de menos— entraba como dos artículos.
    const vistas = new Set();
    const filas = [];
    let repetidas = 0;

    for (const f of crudas) {
      const donde = `${f.fila}:${f.columna}`;
      if (vistas.has(donde)) {
        repetidas += 1;
        continue;
      }
      vistas.add(donde);
      filas.push(f);
    }

    return { filas, repetidas };
  } catch {
    return { error: 'El lector devolvió un JSON roto.' };
  }
}

// ---------------------------------------------------------------------------
// Completar los nombres que el juego enseña cortados
// ---------------------------------------------------------------------------
//
// El juego trunca los nombres largos en la propia pantalla, así que esos caracteres no están en
// la imagen y **ninguna lectura los puede recuperar**. Deducirlos sí se puede: «CABLEADO DE
// ALTER…» en el taller de un juego de rol es «CABLEADO DE ALTERNADOR» y poco más.
//
// Va **aparte del escaneo, y a propósito**. Si el lector completara los nombres al leer cada
// captura, dos fotos de lo mismo darían dos nombres distintos y aparecerían duplicados —es
// exactamente el fallo que costó dos rondas de arreglos—. Acá se propone una vez, una persona
// lo mira, y a partir de ahí el nombre completo queda guardado. Las capturas siguientes lo
// siguen reconociendo porque el casado es por prefijo.

const ESQUEMA_NOMBRES = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      cortado: { type: 'STRING' },
      completo: { type: 'STRING' },
      seguro: { type: 'BOOLEAN' },
    },
    required: ['cortado', 'completo', 'seguro'],
  },
};

/**
 * Propone el nombre entero de cada nombre cortado. No guarda nada: son sugerencias.
 *
 * `seguro` distingue lo evidente —«RAMPA DE REMO…» solo puede ser «RAMPA DE REMOLQUE»— de lo
 * que es una apuesta. Lo dudoso se enseña marcado, para que quien decide sepa dónde mirar.
 */
export async function sugerirNombres(cortados) {
  const llave = process.env.GEMINI_API_KEY;
  if (!llave) return { error: 'No hay lector configurado.' };
  if (!cortados.length) return { sugerencias: [] };

  const instrucciones = `Estos son nombres de objetos de la bodega de un taller mecánico en un
juego de rol de GTA (FiveM). La pantalla del juego los muestra CORTADOS, con puntos suspensivos.

Para cada uno, deduce el nombre completo más probable. Son piezas y herramientas de taller:
repuestos de vehículo, kits de reparación, herramientas.

Reglas:
1. El nombre completo tiene que EMPEZAR exactamente igual que el cortado, letra por letra.
   Solo estás añadiendo lo que falta al final.
2. Escríbelo en mayúsculas, como en el juego.
3. Marca "seguro" en false si hay varias continuaciones plausibles y estás eligiendo una.
4. Si no se te ocurre nada mejor, devuelve el mismo texto sin los puntos y "seguro" en false.

Nombres cortados:
${cortados.map((n) => `- ${n}`).join('\n')}`;

  for (const modelo of MODELOS) {
    const r = await fetch(urlDe(modelo), {
      method: 'POST',
      headers: { 'x-goog-api-key': llave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instrucciones }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ESQUEMA_NOMBRES,
          temperature: 0,
        },
      }),
    }).catch(() => null);

    if (!r) return { error: 'No se pudo consultar el lector.' };
    if (r.status === 429) return { error: 'El lector llegó a su límite. Prueba en unos minutos.' };
    if (!r.ok) {
      if (r.status === 404 || r.status === 503) continue;
      return { error: `El lector respondió ${r.status}.` };
    }

    const datos = await r.json().catch(() => null);
    const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      const sugerencias = JSON.parse(texto);
      return Array.isArray(sugerencias) ? { sugerencias } : { error: 'Respuesta inesperada.' };
    } catch {
      return { error: 'El lector devolvió un JSON roto.' };
    }
  }

  return { error: 'Ningún modelo disponible.' };
}
