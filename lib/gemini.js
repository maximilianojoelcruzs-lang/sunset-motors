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
Es una rejilla de casillas. Cada casilla con contenido muestra:
- arriba a la izquierda, el peso (por ejemplo "28.00kg" o "210g")
- arriba a la derecha, la cantidad, que siempre termina en "x" (por ejemplo "140x")
- abajo, el nombre del artículo, en mayúsculas

Devuelve una fila por cada casilla CON contenido.

Reglas estrictas:
1. Copia el nombre EXACTAMENTE como aparece en la imagen, incluidos los puntos suspensivos si
   está cortado. No lo completes ni lo adivines. Si ves "KIT DE REPARACIÓN ..." escribe eso.
2. Las casillas vacías (sin texto ni icono) no se incluyen.
3. La cantidad es el número de arriba a la derecha, sin la "x". El peso es el de la izquierda.
4. No inventes filas que no estén en la imagen.`;

const ESQUEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      nombre: { type: 'STRING' },
      cantidad: { type: 'INTEGER' },
      peso: { type: 'STRING' },
    },
    required: ['nombre', 'cantidad'],
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
    const filas = JSON.parse(texto);
    if (!Array.isArray(filas)) return { error: 'El lector devolvió algo que no es una lista.' };
    return { filas };
  } catch {
    return { error: 'El lector devolvió un JSON roto.' };
  }
}
