'use client';

import { useState } from 'react';
import { leerInventario } from '../../lib/leer-inventario';

/**
 * Lee una captura del inventario del juego y propone una lista.
 *
 * El OCR se equivoca —depende de la interfaz de cada servidor, del tamaño de la letra y del
 * fondo—, así que nunca guarda directo: propone, la persona corrige, y recién ahí se guarda.
 * Ese paso de revisión no es un lujo, es lo que hace que la función sea usable.
 *
 * tesseract.js se carga solo al abrir el escáner: son varios MB y no tienen por qué pesar
 * en el resto de la app.
 */
export default function Escaner({ actuales, onListo, onCancelar }) {
  const [fase, setFase] = useState('elegir'); // elegir | leyendo | revisar
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState('');
  const [previa, setPrevia] = useState(null);
  const [filas, setFilas] = useState([]);
  const [modo, setModo] = useState('reemplazar');
  const [crudo, setCrudo] = useState('');
  const [verCrudo, setVerCrudo] = useState(false);

  const escanear = async (archivo) => {
    if (!archivo) return;
    setError('');
    setFase('leyendo');
    setProgreso(0);
    setPrevia(URL.createObjectURL(archivo));

    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('spa', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgreso(Math.round(m.progress * 100));
        },
      });

      const { data } = await worker.recognize(archivo);
      setCrudo(data.text ?? '');

      const leidas = leerInventario(data.text ?? '');
      if (!leidas.length) {
        setError(
          'No se reconoció ningún producto en la captura. Puedes escribirlos a mano abajo, ' +
            'o probar con una captura más grande y con la letra más nítida.'
        );
      }
      setFilas(leidas.length ? leidas : [{ nombre: '', cantidad: 1 }]);
      setFase('revisar');
    } catch (e) {
      setError(`No se pudo leer la imagen: ${e.message}`);
      setFase('elegir');
    } finally {
      await worker?.terminate().catch(() => {});
    }
  };

  const cambiar = (i, campo, valor) =>
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  const quitar = (i) => setFilas((prev) => prev.filter((_, j) => j !== i));

  const validas = filas.filter((f) => f.nombre.trim());

  return (
    <>
      {fase === 'elegir' && (
        <>
          {error && <p className="forma-error">{error}</p>}
          <label className="campo">
            <span>Captura del inventario</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => escanear(e.target.files?.[0])}
            />
          </label>
          <p className="forma-pie">
            Funciona mejor con la captura completa y sin reducir. La imagen se lee en tu
            propio navegador: no se sube a ninguna parte.
          </p>
        </>
      )}

      {fase === 'leyendo' && (
        <div className="escaner-leyendo">
          {previa && <img className="captura-previa" src={previa} alt="Captura" />}
          <p className="escaner-estado">Leyendo la captura… {progreso}%</p>
          <div className="escaner-barra">
            <span style={{ width: `${progreso}%` }} />
          </div>
          <p className="forma-pie">
            La primera vez tarda más: el navegador descarga el lector de texto.
          </p>
        </div>
      )}

      {fase === 'revisar' && (
        <>
          {error && <p className="forma-error">{error}</p>}

          <p className="escaner-aviso">
            Revisa lo que se leyó antes de guardar. El lector se equivoca con nombres largos
            y con la letra chica: corrige lo que haga falta.
          </p>

          <div className="escaner-filas">
            {filas.map((f, i) => (
              <div className="escaner-fila" key={i}>
                <input
                  type="text"
                  value={f.nombre}
                  placeholder="Nombre del producto"
                  maxLength={60}
                  onChange={(e) => cambiar(i, 'nombre', e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  value={f.cantidad}
                  onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                />
                <button type="button" className="accion peligro" onClick={() => quitar(i)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="accion"
            onClick={() => setFilas((p) => [...p, { nombre: '', cantidad: 1 }])}
          >
            Agregar línea
          </button>

          <div className="escaner-modo">
            <label className="campo-casilla">
              <input
                type="radio"
                name="modo"
                checked={modo === 'reemplazar'}
                onChange={() => setModo('reemplazar')}
              />
              <span>Reemplazar todo el inventario</span>
            </label>
            <label className="campo-casilla">
              <input
                type="radio"
                name="modo"
                checked={modo === 'sumar'}
                onChange={() => setModo('sumar')}
              />
              <span>Sumar a lo que ya hay ({actuales.length} productos)</span>
            </label>
          </div>

          {crudo && (
            <p className="forma-pie">
              <button type="button" className="enlace-boton" onClick={() => setVerCrudo((v) => !v)}>
                {verCrudo ? 'Ocultar' : 'Ver'} el texto que leyó el escáner
              </button>
            </p>
          )}
          {verCrudo && <pre className="msj-texto">{crudo}</pre>}

          <div className="soli-botones">
            <button
              type="button"
              className="accion destacada"
              disabled={!validas.length}
              onClick={() => onListo(validas, modo)}
            >
              Guardar {validas.length} producto{validas.length === 1 ? '' : 's'}
            </button>
            <button type="button" className="accion" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </>
  );
}
