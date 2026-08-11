// El tope de un turno abierto, aparte de lib/turnos.js.
//
// Lo necesitan tanto el servidor (para cerrar) como la barra de marcaje y el menú de perfil,
// que corren en el navegador. Importarlo desde lib/turnos.js arrastraría lib/almacen.js
// —que usa node:fs— al bundle del cliente y rompería el build.

export const HORAS_MAXIMAS = 2;
