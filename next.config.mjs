/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * Van acá y no en el middleware porque no dependen de la petición: son las mismas siempre, y
 * puestas en la configuración las aplica también a lo que el middleware no mira. La CSP sí va
 * en el middleware, porque lleva un nonce distinto en cada carga.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // La cabecera que delata qué framework corre detrás. No es un agujero, pero tampoco hay
  // ninguna razón para anunciarlo.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:ruta*',
        headers: [
          // Nadie mete la app en un iframe: sin esto, una página ajena puede montarla
          // invisible encima de sus propios botones y hacer clic con la sesión de quien mira.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Un archivo servido como texto no se ejecuta como script por adivinar el tipo.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Las URL de la app llevan identificadores; no se mandan a sitios de fuera.
          { key: 'Referrer-Policy', value: 'same-origin' },
          // La app no usa cámara, micrófono ni ubicación. Dicho explícitamente, tampoco puede
          // usarlas nada que se cuele dentro.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // Solo por HTTPS, durante un año. Vercel ya sirve TLS; esto evita el primer salto
          // en claro, que es donde se roba una cookie de sesión en una red compartida.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
