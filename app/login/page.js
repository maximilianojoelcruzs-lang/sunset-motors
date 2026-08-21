import Formulario from './formulario';

/**
 * La puerta. El formulario es cliente; esta página es el envoltorio de servidor y existe para
 * una cosa: **`force-dynamic`**.
 *
 * La CSP lleva un nonce distinto en cada carga, y una página prerenderizada en el build trae
 * el HTML de entonces, con el nonce de entonces. El navegador bloquearía los scripts de
 * arranque y el botón de *Entrar* no haría absolutamente nada, sin ningún error a la vista.
 */
export const dynamic = 'force-dynamic';

export default function PaginaLogin() {
  return <Formulario />;
}
