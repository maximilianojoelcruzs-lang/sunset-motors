// Precios tomados de la hoja "Valores" del Excel Calculadora_SUNSETMOTORS.xlsx.
// Solo columna B (nombre) y columna D (precio); la columna C está vacía en el original.
// Este archivo es el único lugar donde hay que tocar un precio.
//
// Filtro de aceite va en $0 porque así está en Valores!D17.
// Neumáticos queda marcado: Valores!D22 es un VLOOKUP roto, no hay precio que tomar.
//
// El orden de este arreglo es el orden en pantalla: en dos columnas se van repartiendo
// izquierda, derecha, izquierda… Por eso Carrocería va segunda, para quedar al lado de
// Partes principales.

export const SECCIONES = [
  {
    id: 'principales',
    titulo: 'Partes principales',
    tinte: '#6D2B6B',
    items: [
      { nombre: 'Alternador', precio: 160 },
      { nombre: 'Bomba de dirección', precio: 160 },
      { nombre: 'Frenos', precio: 160 },
      { nombre: 'Inyector de combustible', precio: 160 },
      { nombre: 'Radiador', precio: 160 },
      { nombre: 'Transmisión', precio: 160 },
      { nombre: 'Batería EV', precio: 160 },
      { nombre: 'Motor eléctrico', precio: 256 },
    ],
  },
  {
    id: 'carroceria',
    titulo: 'Carrocería',
    tinte: '#DC4A1E',
    items: [
      { nombre: 'Capó', precio: 160 },
      { nombre: 'Maletero', precio: 160 },
      { nombre: 'Puerta', precio: 160 },
      { nombre: 'Rueda', precio: 80 },
      { nombre: 'Ventana', precio: 80 },
      { nombre: 'Kit de reparación avanzado', precio: 400 },
    ],
  },
  {
    id: 'servicio',
    titulo: 'Partes de servicio',
    tinte: '#B03A46',
    items: [
      { nombre: 'Bujías', precio: 80 },
      { nombre: 'Correa de transmisión', precio: 320 },
      { nombre: 'Filtro de aceite', precio: 0 },
      { nombre: 'Filtro de aire', precio: 320 },
      { nombre: 'Filtro de combustible', precio: 240 },
      { nombre: 'Líquido de dirección', precio: 240 },
      { nombre: 'Líquido de transmisión', precio: 240 },
      { nombre: 'Neumáticos', precio: 0, revisar: true },
      { nombre: 'Líquido de freno', precio: 240 },
      { nombre: 'Pastillas de freno', precio: 160 },
      { nombre: 'Refrigerante', precio: 240 },
      { nombre: 'Botella de nitro', precio: 600 },
      { nombre: 'Recarga de botella vacía', precio: 350 },
      { nombre: 'Tinte de purga', precio: 320 },
    ],
  },
  {
    id: 'terreno',
    titulo: 'Reparación en terreno',
    tinte: '#F08A2A',
    items: [
      { nombre: 'Paleto Bay', precio: 400 },
      { nombre: 'Sandy Shores', precio: 300 },
      { nombre: 'Ciudad', precio: 450 },
    ],
  },
  {
    id: 'consumibles',
    titulo: 'Consumibles',
    tinte: '#FFBE3D',
    items: [
      { nombre: 'Paños', precio: 100 },
      { nombre: 'Botella nueva', precio: 700 },
      { nombre: 'Recarga botella', precio: 500 },
      { nombre: 'Instalación (precio costo)', precio: 150 },
    ],
  },
];

export const COMANDOS = [
  { comando: '/mechanic:workflow:clear', descripcion: 'Borrar lista de pedido' },
  { comando: '/inspect:cancel', descripcion: 'Cancelar inspección' },
  { comando: '/mechanic:workflow:close', descripcion: 'Cerrar flujo de trabajo' },
];

export const CODIGOS = [
  { codigo: '10-3', descripcion: 'Solicitar asignación' },
  { codigo: '10-4', descripcion: 'Recibido / entendido' },
  { codigo: '10-5', descripcion: 'Negativo' },
  { codigo: '10-8', descripcion: 'En servicio' },
  { codigo: '10-9', descripcion: 'Repita comunicado' },
  { codigo: '10-20', descripcion: 'Ubicación' },
  { codigo: '10-36', descripcion: 'Reparación' },
  { codigo: '10-37', descripcion: 'Remolcar el vehículo' },
];
