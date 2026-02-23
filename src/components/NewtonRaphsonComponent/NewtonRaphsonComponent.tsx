import { useState, useEffect, useRef } from 'react';
import 'mathlive';
import { Mafs, Coordinates, Point, Polyline, vec } from "mafs";
import "mafs/core.css";

type MathfieldElement = HTMLElement & {
  value: string;
  getValue: (format: string) => string;
};

interface HistorialItem {
  n:          number;
  xn:         number;
  fxn:        number;
  dfxn:       number;
  x_siguiente: number | null;
  error:       number | null;
}

interface ApiResponse {
  convergio:   boolean;
  historial:   HistorialItem[];
  iteraciones: number;
  mensaje:     string;
  raiz:        number;
  status:      string;
}

const toNum = (s: string): number => parseFloat(s.replace(',', '.'));

// ── Evaluador de función en el cliente (para graficar) ────────────────────────
const buildFn = (expr: string): ((x: number) => number) | null => {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', `"use strict"; try { return ${expr}; } catch(e){ return NaN; }`);
    fn(0); // prueba rápida
    return fn as (x: number) => number;
  } catch {
    return null;
  }
};

// ────────────────────────────────────────────────────────────────────────────
const NewtonRaphsonComponent = () => {
  const [pythonFormula, setPythonFormula] = useState<string>("");
  const [x0,           setX0]           = useState<string>("1");
  const [toleranciaFx, setToleranciaFx] = useState<string>("1e-7");
  const maxIter = "10000";
  const [resultado,    setResultado]    = useState<ApiResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string>("");
  const mf = useRef<MathfieldElement>(null);

  useEffect(() => {
    import('mathlive').catch(() => {});
  }, []);

  useEffect(() => {
    const field = mf.current;
    if (!field) return;
    const handleInput = (e: Event) => {
      const target = e.target as MathfieldElement;
      const ascii = target.getValue('ascii-math');
      setPythonFormula(ascii.replace(/\^/g, '**'));
    };
    field.addEventListener('input', handleInput);
    return () => field.removeEventListener('input', handleInput);
  }, []);

  const handleCalcular = async () => {
    if (!pythonFormula.trim()) { setError("Ingresa una ecuación antes de calcular."); return; }
    const x0n   = toNum(x0);
    const tolN  = parseFloat(toleranciaFx);
    const maxN  = parseInt(maxIter);
    if (isNaN(x0n))              { setError("x₀ inválido."); return; }
    if (isNaN(tolN) || tolN <= 0) { setError("Tolerancia inválida."); return; }

    setLoading(true); setError(""); setResultado(null);

    try {
      const body = { ecuacion: pythonFormula, x0: x0n, tolerancia_fx: tolN, max_iter: maxN };

      const res = await fetch('http://127.0.0.1:5000/resolver_newton_raphson', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: ApiResponse = await res.json();
      if (!res.ok || data.status === 'error') throw new Error((data as any).mensaje ?? `Error ${res.status}`);
      setResultado(data);
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError')) {
        setError("CORS_ERROR");
      } else {
        setError(msg || "Error desconocido.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Datos para la gráfica ───────────────────────────────────────────────────
  const hist = resultado?.historial ?? [];
  const xs   = hist.map(h => h.xn);
  const pad  = 1.2;
  const xMin = xs.length ? Math.min(...xs) - pad : -2;
  const xMax = xs.length ? Math.max(...xs) + pad : 4;

  const fn = pythonFormula ? buildFn(pythonFormula) : null;
  const ys_fn: number[] = fn
    ? Array.from({ length: 80 }, (_, i) => {
        const x = xMin + (i / 79) * (xMax - xMin);
        return fn(x);
      }).filter(y => isFinite(y))
    : [];
  const yMin_fn = ys_fn.length ? Math.min(...ys_fn) - 1 : -4;
  const yMax_fn = ys_fn.length ? Math.max(...ys_fn) + 1 :  4;

  // Puntos de iteración sobre la curva
  const iterPts: [number, number][] = hist
    .filter(h => fn && isFinite(fn(h.xn)))
    .map(h => [h.xn, fn!(h.xn)] as [number, number]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#1e293b' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nr-page { max-width: 900px; margin: 0 auto; padding: 32px 20px 60px; }

        /* Header */
        .nr-header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .nr-icon-box { width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
        .nr-title { font-size: 1.45rem; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; }
        .nr-subtitle { font-size: 0.83rem; color: #64748b; margin: 3px 0 0; }

        /* Cards */
        .nr-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 24px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .nr-card-title { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 0 0 14px; }

        /* MathField */
        .nr-math-wrap math-field {
          display: block; width: 100%;
          border: 1px solid #cbd5e1 !important; border-radius: 8px !important;
          padding: 10px 12px !important; font-size: 1.3rem;
          background: #fff !important; color: #0f172a !important; outline: none !important;
          --caret-color: #6366f1; --selection-background-color: rgba(99,102,241,0.15);
        }
        .nr-math-wrap math-field:focus-within { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important; }
        .nr-formula-tag { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 5px 10px; font-size: 0.82rem; color: #4338ca; font-family: 'Courier New', monospace; word-break: break-all; }
        .nr-formula-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }

        /* Inputs */
        .nr-label { display: block; font-size: 0.8rem; font-weight: 500; color: #475569; margin-bottom: 5px; }
        .nr-input { width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #fff; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .nr-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .nr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }

        /* Button */
        .nr-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; font-family: 'Inter', system-ui, sans-serif; cursor: pointer; transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s; box-shadow: 0 2px 8px rgba(99,102,241,0.3); margin-bottom: 18px; }
        .nr-btn:hover:not(:disabled) { opacity: 0.9; box-shadow: 0 4px 16px rgba(99,102,241,0.4); transform: translateY(-1px); }
        .nr-btn:active:not(:disabled) { transform: none; }
        .nr-btn:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }

        /* Error */
        .nr-error { display: flex; align-items: flex-start; gap: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; color: #b91c1c; font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px; }
        .nr-cors-hint { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 13px 15px; font-size: 0.8rem; color: #713f12; margin-bottom: 18px; line-height: 1.7; }
        .nr-cors-hint code { background: #fef08a; border-radius: 4px; padding: 1px 5px; font-family: 'Courier New', monospace; }

        /* Result badge */
        .nr-result-badge { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-radius: 12px; padding: 20px 24px; margin-bottom: 18px; }
        .nr-badge-ok  { background: #eef2ff; border: 1px solid #c7d2fe; }
        .nr-badge-err { background: #fff7ed; border: 1px solid #fed7aa; }
        .nr-result-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; }
        .nr-badge-ok  .nr-result-label { color: #4338ca; }
        .nr-badge-err .nr-result-label { color: #c2410c; }
        .nr-result-msg  { font-size: 0.82rem; margin-top: 4px; }
        .nr-badge-ok  .nr-result-msg  { color: #6366f1; }
        .nr-badge-err .nr-result-msg  { color: #ea580c; }
        .nr-result-value { font-size: 2.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        .nr-badge-ok  .nr-result-value { color: #4338ca; }
        .nr-badge-err .nr-result-value { color: #c2410c; }

        /* Stats row */
        .nr-stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .nr-stat { flex: 1; min-width: 110px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
        .nr-stat-label { font-size: 0.7rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; }
        .nr-stat-val   { font-size: 1.2rem; font-weight: 700; color: #1e293b; margin-top: 4px; font-variant-numeric: tabular-nums; }

        /* Convergence bar */
        .nr-conv-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .nr-conv-track { flex: 1; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .nr-conv-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #6366f1, #a78bfa); transition: width 0.6s ease; }
        .nr-conv-label { font-size: 0.75rem; color: #64748b; white-space: nowrap; }

        /* Graph */
        .nr-graph-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .nr-graph-legend { display: flex; gap: 18px; margin-top: 10px; font-size: 0.78rem; color: #64748b; flex-wrap: wrap; }
        .nr-legend-line { display: inline-block; width: 16px; height: 3px; margin-right: 6px; vertical-align: middle; border-radius: 2px; }
        .nr-legend-dot  { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }

        /* Error progress chart */
        .nr-error-chart { display: flex; align-items: flex-end; gap: 4px; height: 60px; margin-top: 14px; }
        .nr-error-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .nr-error-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s ease; }
        .nr-error-bar-label { font-size: 0.6rem; color: #94a3b8; }

        /* Table */
        .nr-table-wrap { overflow-x: auto; }
        table.nr-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .nr-table th { padding: 9px 12px; text-align: left; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; white-space: nowrap; background: #f8fafc; }
        .nr-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .nr-table tbody tr:hover td { background: #eef2ff; }
        .nr-table tbody tr:last-child td { border-bottom: none; }
        .td-n    { color: #94a3b8; font-size: 0.78rem; }
        .td-xn   { color: #6366f1; font-weight: 600; }
        .td-fxn  { color: #0f172a; }
        .td-dfxn { color: #64748b; font-size: 0.78rem; }
        .td-next { color: #059669; font-weight: 500; }
        .td-err-good { color: #16a34a; font-size: 0.78rem; font-weight: 600; }
        .td-err-mid  { color: #f59e0b; font-size: 0.78rem; }
        .td-err-high { color: #ef4444; font-size: 0.78rem; }
        .td-final-row td { background: #f0fdf4 !important; }
        .td-badge-root { display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; border: 1px solid #86efac; border-radius: 5px; padding: 2px 7px; font-size: 0.75rem; font-weight: 700; color: #166534; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .nr-spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: none; } }
        .nr-animate { animation: fadeIn 0.35s ease forwards; }
      `}</style>

      <div className="nr-page">

        {/* ── Header ── */}
        <div className="nr-header">
          <div className="nr-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <div>
            <h1 className="nr-title">Newton-Raphson</h1>
            <p className="nr-subtitle">Método iterativo de una variable — Búsqueda de raíces f(x) = 0</p>
          </div>
        </div>

        {/* ── Ecuación ── */}
        <div className="nr-card">
          <p className="nr-card-title">Ecuación &nbsp; f(x) = 0</p>
          <div className="nr-math-wrap">
            {/* @ts-ignore */}
            <math-field ref={mf} />
          </div>
          {pythonFormula && (
            <div className="nr-formula-tag">
              <span className="nr-formula-dot" />
              Python detectado: <strong>{pythonFormula}</strong>
            </div>
          )}
        </div>

        {/* ── Parámetros ── */}
        <div className="nr-card">
          <p className="nr-card-title">Parámetros</p>
          <div className="nr-grid">
            <div>
              <label className="nr-label">x₀ — estimación inicial</label>
              <input className="nr-input" type="number" value={x0} onChange={e => setX0(e.target.value)} step="any" />
            </div>
            <div>
              <label className="nr-label">Tolerancia f(x)</label>
              <input className="nr-input" type="number" value={toleranciaFx} onChange={e => setToleranciaFx(e.target.value)} step="any" placeholder="1e-7" />
            </div>
          </div>
        </div>

        {/* ── Botón ── */}
        <button className="nr-btn" onClick={handleCalcular} disabled={loading}>
          {loading
            ? <><span className="nr-spinner" /> Calculando raíz…</>
            : <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Encontrar raíz
              </>
          }
        </button>

        {/* ── Error ── */}
        {error === "CORS_ERROR" ? (
          <>
            <div className="nr-error"><span>⚠</span><span>No se pudo conectar con el servidor — posible error de CORS.</span></div>
            <div className="nr-cors-hint">
              <strong>¿Cómo habilitar CORS en Flask?</strong><br />
              1. <code>pip install flask-cors</code><br />
              2. En <code>app.py</code>: <code>from flask_cors import CORS</code> y <code>CORS(app)</code>
            </div>
          </>
        ) : error ? (
          <div className="nr-error"><span>⚠</span><span>{error}</span></div>
        ) : null}

        {/* ── Resultados ── */}
        {resultado && (() => {
          return (
            <div className="nr-animate">
              {/* Badge resultado */}
              <div className={`nr-result-badge ${resultado.convergio ? 'nr-badge-ok' : 'nr-badge-err'}`}>
                <div>
                  <div className="nr-result-label">
                    {resultado.convergio ? '✓ Raíz encontrada' : '✗ No convergió'}
                  </div>
                  <div className="nr-result-msg">{resultado.mensaje}</div>
                </div>
                <div className="nr-result-value">{resultado.raiz.toFixed(10)}</div>
              </div>

              {/* Stats rápidas */}
              <div className="nr-stats-row">
                <div className="nr-stat">
                  <div className="nr-stat-label">Iteraciones</div>
                  <div className="nr-stat-val">{resultado.iteraciones}</div>
                </div>
                <div className="nr-stat">
                  <div className="nr-stat-label">Error final</div>
                  <div className="nr-stat-val" style={{ fontSize: '1rem' }}>
                    {hist[hist.length - 1]?.error?.toExponential(2) ?? '0'}
                  </div>
                </div>
                <div className="nr-stat">
                  <div className="nr-stat-label">f(raíz)</div>
                  <div className="nr-stat-val" style={{ fontSize: '1rem' }}>
                    {hist[hist.length - 1]?.fxn.toExponential(3)}
                  </div>
                </div>
                <div className="nr-stat">
                  <div className="nr-stat-label">f'(raíz)</div>
                  <div className="nr-stat-val" style={{ fontSize: '1rem' }}>
                    {hist[hist.length - 1]?.dfxn.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* Convergencia bar */}
              <div className="nr-conv-row">
                <span className="nr-conv-label">Velocidad de convergencia</span>
                <div className="nr-conv-track">
                  <div className="nr-conv-fill" style={{ width: `${Math.max(4, 100 - (resultado.iteraciones / 50) * 100)}%` }} />
                </div>
                <span className="nr-conv-label">{resultado.iteraciones} iteraciones</span>
              </div>

              {/* Gráfica de la función + puntos de iteración */}
              <div className="nr-card">
                <p className="nr-card-title">Gráfica — Convergencia hacia la raíz</p>
                <div className="nr-graph-wrap">
                  <Mafs
                    viewBox={{ x: [xMin, xMax], y: [Math.min(yMin_fn, -1), Math.max(yMax_fn, 1)] }}
                    preserveAspectRatio={false}
                    height={320}
                  >
                    <Coordinates.Cartesian />

                    {/* Curva f(x) — muestreada en 200 puntos */}
                    {fn && (() => {
                      const pts: vec.Vector2[] = [];
                      for (let i = 0; i <= 200; i++) {
                        const x = xMin + (i / 200) * (xMax - xMin);
                        const y = fn(x);
                        if (isFinite(y)) pts.push([x, y]);
                      }
                      return pts.length > 1 ? (
                        <Polyline points={pts} color="#6366f1" />
                      ) : null;
                    })()}

                    {/* Líneas verticales de cada xn hacia el eje x */}
                    {hist.map((h, i) =>
                      fn && isFinite(fn(h.xn)) ? (
                        <Polyline
                          key={`drop-${i}`}
                          points={[[h.xn, 0], [h.xn, fn(h.xn)]] as vec.Vector2[]}
                          color={i === hist.length - 1 ? "#10b981" : "#f59e0b"}
                        />
                      ) : null
                    )}

                    {/* Puntos de iteración sobre la curva */}
                    {iterPts.map(([x, y], i) => (
                      <Point
                        key={`pt-${i}`}
                        x={x}
                        y={y}
                        color={i === iterPts.length - 1 ? "#10b981" : i === 0 ? "#f59e0b" : "#a78bfa"}
                      />
                    ))}

                    {/* Punto raíz en el eje x */}
                    <Point x={resultado.raiz} y={0} color="#10b981" />
                  </Mafs>
                </div>
                <div className="nr-graph-legend">
                  <span><span className="nr-legend-line" style={{ background: '#6366f1' }} />f(x)</span>
                  <span><span className="nr-legend-dot" style={{ background: '#f59e0b' }} />Punto inicial x₀</span>
                  <span><span className="nr-legend-dot" style={{ background: '#a78bfa' }} />Iteraciones xₙ</span>
                  <span><span className="nr-legend-dot" style={{ background: '#10b981' }} />Raíz encontrada</span>
                </div>
              </div>
              
              {/* Tabla de iteraciones */}
              <div className="nr-card">
                <p className="nr-card-title">Tabla de iteraciones</p>
                <div className="nr-table-wrap">
                  <table className="nr-table">
                    <thead>
                      <tr>
                        <th>n</th>
                        <th>xₙ</th>
                        <th>f(xₙ)</th>
                        <th>f'(xₙ)</th>
                        <th>xₙ₊₁</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.map((h, i) => {
                        const isLast = i === hist.length - 1;
                        const errClass =
                          h.error === null ? '' :
                          h.error < parseFloat(toleranciaFx) ? 'td-err-good' :
                          h.error < 0.01 ? 'td-err-mid' : 'td-err-high';
                        return (
                          <tr key={i} className={isLast ? 'td-final-row' : ''}>
                            <td className="td-n">{h.n}</td>
                            <td className="td-xn">
                              {h.xn.toFixed(10)}
                              {isLast && (
                                <span className="td-badge-root" style={{ marginLeft: 6 }}>✓ raíz</span>
                              )}
                            </td>
                            <td className="td-fxn">{h.fxn.toExponential(6)}</td>
                            <td className="td-dfxn">{h.dfxn.toFixed(8)}</td>
                            <td className="td-next">
                              {h.x_siguiente !== null ? h.x_siguiente.toFixed(10) : '—'}
                            </td>
                            <td className={errClass}>
                              {h.error !== null ? h.error.toExponential(4) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default NewtonRaphsonComponent;