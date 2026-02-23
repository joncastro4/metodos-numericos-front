import { useState, useEffect, useRef } from 'react';
import 'mathlive';
import { Mafs, Coordinates, Point, Polyline, vec } from "mafs";
import "mafs/core.css";

type MathfieldElement = HTMLElement & {
  value: string;
  getValue: (format: string) => string;
};

interface Iteracion {
  paso: number;
  x: number;
  y: number;
  h_usado?: number;
  k1?: number | null;
  k2?: number | null;
  k3?: number | null;
  k4?: number | null;
}

interface ApiResponse {
  iteraciones: Iteracion[];
  resultado_final: number;
  total_pasos: number;
  status: string;
  mensaje?: string;
  errores?: string[];
}

const toNum = (s: string): number => parseFloat(s.replace(',', '.'));

const RungeKuttaComponent = () => {
  const [pythonFormula, setPythonFormula] = useState<string>("");
  const [x0, setX0]           = useState<string>("0");
  const [y0, setY0]           = useState<string>("1");
  const [h, setH]             = useState<string>("0.2");
  const [xFin, setXFin]       = useState<string>("2");
  const [resultado, setResultado] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string>("");
  const mf = useRef<MathfieldElement>(null);

  // ✅ Sin loadFontsFromURL — Vite lo resuelve solo con optimizeDeps.exclude
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
    if (!pythonFormula.trim()) {
      setError("Ingresa una ecuación antes de calcular.");
      return;
    }

    const x0n   = toNum(x0);
    const y0n   = toNum(y0);
    const hn    = toNum(h);
    const xFinN = toNum(xFin);

    if (isNaN(x0n) || isNaN(y0n) || isNaN(hn) || isNaN(xFinN)) {
      setError("Uno o más parámetros numéricos son inválidos.");
      return;
    }
    if (hn <= 0) {
      setError("El paso h debe ser mayor que cero.");
      return;
    }
    if (xFinN <= x0n) {
      setError("x final debe ser mayor que x₀.");
      return;
    }

    setLoading(true); setError(""); setResultado(null);

    try {
      const body = {
        ecuacion: pythonFormula,
        x0:    x0n,
        y0:    y0n,
        h:     hn,
        x_fin: xFinN,
      };

      // ✅ Ruta corregida: sin /4
      const res = await fetch('http://127.0.0.1:5000/resolver_runge_kutta', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || data.status === 'error') {
        const msg = data.errores?.join(' | ') ?? data.mensaje ?? `Error ${res.status}`;
        throw new Error(msg);
      }

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

  const puntos = resultado?.iteraciones ?? [];
  const xs = puntos.map(p => p.x);
  const ys = puntos.map(p => p.y);
  const pad = 0.6;
  const xMin = xs.length ? Math.min(...xs) - pad : -1;
  const xMax = xs.length ? Math.max(...xs) + pad : 3;
  const yMin = ys.length ? Math.min(...ys) - pad : -1;
  const yMax = ys.length ? Math.max(...ys) + pad : 3;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#1e293b' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .rk-page { max-width: 900px; margin: 0 auto; padding: 32px 20px 60px; }

        .rk-header { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
        .rk-icon-box { width: 48px; height: 48px; background: #0ea5e9; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rk-title { font-size: 1.45rem; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; }
        .rk-subtitle { font-size: 0.83rem; color: #64748b; margin: 3px 0 0; }

        .rk-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 24px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .rk-card-title { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 0 0 14px; }

        .rk-math-wrap math-field {
          display: block; width: 100%;
          border: 1px solid #cbd5e1 !important; border-radius: 8px !important;
          padding: 10px 12px !important; font-size: 1.3rem;
          background: #fff !important; color: #0f172a !important; outline: none !important;
          --caret-color: #0ea5e9; --selection-background-color: rgba(14,165,233,0.15);
        }
        .rk-math-wrap math-field:focus-within { border-color: #0ea5e9 !important; box-shadow: 0 0 0 3px rgba(14,165,233,0.12) !important; }
        .rk-formula-tag { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 5px 10px; font-size: 0.82rem; color: #0369a1; font-family: 'Courier New', monospace; word-break: break-all; }
        .rk-formula-dot { width: 6px; height: 6px; border-radius: 50%; background: #0ea5e9; flex-shrink: 0; }

        .rk-label { display: block; font-size: 0.8rem; font-weight: 500; color: #475569; margin-bottom: 5px; }
        .rk-input { width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #fff; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .rk-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.12); }
        .rk-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }

        .rk-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px 24px; background: #0ea5e9; color: #fff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; font-family: 'Inter', system-ui, sans-serif; cursor: pointer; transition: background 0.15s, transform 0.1s, box-shadow 0.15s; box-shadow: 0 2px 8px rgba(14,165,233,0.25); margin-bottom: 18px; }
        .rk-btn:hover:not(:disabled) { background: #0284c7; box-shadow: 0 4px 14px rgba(14,165,233,0.35); transform: translateY(-1px); }
        .rk-btn:active:not(:disabled) { transform: none; }
        .rk-btn:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .rk-error { display: flex; align-items: flex-start; gap: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; color: #b91c1c; font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px; }
        .rk-cors-hint { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 13px 15px; font-size: 0.8rem; color: #713f12; margin-bottom: 18px; line-height: 1.7; }
        .rk-cors-hint code { background: #fef08a; border-radius: 4px; padding: 1px 5px; font-family: 'Courier New', monospace; font-size: 0.8rem; }

        .rk-result-badge { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px 24px; margin-bottom: 18px; }
        .rk-result-label { font-size: 0.72rem; font-weight: 600; color: #0369a1; text-transform: uppercase; letter-spacing: 0.07em; }
        .rk-result-meta  { font-size: 0.82rem; color: #38bdf8; margin-top: 4px; }
        .rk-result-value { font-size: 2.2rem; font-weight: 700; color: #0369a1; font-variant-numeric: tabular-nums; }

        .rk-graph-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-top: 4px; }
        .rk-graph-legend { display: flex; gap: 18px; margin-top: 12px; font-size: 0.78rem; color: #64748b; }
        .rk-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }

        .rk-table-wrap { overflow-x: auto; }
        table.rk-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .rk-table th { padding: 9px 12px; text-align: left; font-size: 0.68rem; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; white-space: nowrap; background: #f8fafc; }
        .rk-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rk-table tbody tr:hover td { background: #f8fafc; }
        .rk-table tbody tr:last-child td { border-bottom: none; }
        .td-paso  { color: #94a3b8; font-size: 0.78rem; }
        .td-x     { color: #0ea5e9; font-weight: 500; }
        .td-y     { color: #0f172a; font-weight: 500; }
        .td-k     { color: #6366f1; font-size: 0.78rem; }
        .td-h     { color: #10b981; font-size: 0.78rem; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .rk-spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="rk-page">

        {/* Header */}
        <div className="rk-header">
          <div className="rk-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="M7 12l4-4 4 4 3-6"/>
            </svg>
          </div>
          <div>
            <h1 className="rk-title">Runge-Kutta 4</h1>
            <p className="rk-subtitle">Método clásico RK4 — Solución numérica de EDOs</p>
          </div>
        </div>

        {/* Ecuación */}
        <div className="rk-card">
          <p className="rk-card-title">Ecuación diferencial &nbsp; dy/dx = f(x, y)</p>
          <div className="rk-math-wrap">
            {/* @ts-ignore */}
            <math-field ref={mf} />
          </div>
          {pythonFormula && (
            <div className="rk-formula-tag">
              <span className="rk-formula-dot" />
              Python detectado: <strong>{pythonFormula}</strong>
            </div>
          )}
        </div>

        {/* Parámetros */}
        <div className="rk-card">
          <p className="rk-card-title">Parámetros iniciales</p>
          <div className="rk-grid">
            <div>
              <label className="rk-label">x₀ — punto inicial</label>
              <input className="rk-input" type="number" value={x0} onChange={e => setX0(e.target.value)} step="any" />
            </div>
            <div>
              <label className="rk-label">y₀ — condición inicial</label>
              <input className="rk-input" type="number" value={y0} onChange={e => setY0(e.target.value)} step="any" />
            </div>
            <div>
              <label className="rk-label">h — tamaño de paso</label>
              <input className="rk-input" type="number" value={h} onChange={e => setH(e.target.value)} step="0.01" />
            </div>
            <div>
              <label className="rk-label">x final — límite</label>
              <input className="rk-input" type="number" value={xFin} onChange={e => setXFin(e.target.value)} step="any" />
            </div>
          </div>
        </div>

        {/* Botón */}
        <button className="rk-btn" onClick={handleCalcular} disabled={loading}>
          {loading
            ? <><span className="rk-spinner" /> Calculando...</>
            : <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Calcular con RK4
              </>
          }
        </button>

        {/* Error */}
        {error === "CORS_ERROR" ? (
          <>
            <div className="rk-error"><span>⚠</span><span>No se pudo conectar con el servidor — posible error de CORS.</span></div>
            <div className="rk-cors-hint">
              <strong>¿Cómo habilitar CORS en Flask?</strong><br />
              1. <code>pip install flask-cors</code><br />
              2. En <code>app.py</code>: <code>from flask_cors import CORS</code> y <code>CORS(app)</code>
            </div>
          </>
        ) : error ? (
          <div className="rk-error"><span>⚠</span><span>{error}</span></div>
        ) : null}

        {/* Resultados */}
        {resultado && (
          <>
            <div className="rk-result-badge">
              <div>
                <div className="rk-result-label">Resultado final — RK4 Clásico</div>
                <div className="rk-result-meta">
                  y({xFin}) ≈ &nbsp;·&nbsp; {resultado.total_pasos} pasos
                </div>
              </div>
              <div className="rk-result-value">{resultado.resultado_final.toFixed(8)}</div>
            </div>

            <div className="rk-card">
              <p className="rk-card-title">Gráfica de la solución aproximada</p>
              <div className="rk-graph-wrap">
                <Mafs viewBox={{ x: [xMin, xMax], y: [yMin, yMax] }} preserveAspectRatio={false} height={300}>
                  <Coordinates.Cartesian />
                  {puntos.length > 1 && (
                    <Polyline points={puntos.map(p => [p.x, p.y] as vec.Vector2)} color="#0ea5e9" strokeWidth={2.5} />
                  )}
                  {puntos.map((p, i) => (
                    <Point key={i} x={p.x} y={p.y} color={i === 0 ? "#f59e0b" : "#0ea5e9"} />
                  ))}
                </Mafs>
              </div>
              <div className="rk-graph-legend">
                <span><span className="rk-legend-dot" style={{ background: '#f59e0b' }} />Punto inicial</span>
                <span><span className="rk-legend-dot" style={{ background: '#0ea5e9' }} />Iteraciones RK4</span>
              </div>
            </div>

            <div className="rk-card">
              <p className="rk-card-title">Tabla de iteraciones</p>
              <div className="rk-table-wrap">
                <table className="rk-table">
                  <thead>
                    <tr>
                      <th>Paso</th>
                      <th>x</th>
                      <th>y (aprox.)</th>
                      <th>h usado</th>
                      <th>K1</th>
                      <th>K2</th>
                      <th>K3</th>
                      <th>K4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puntos.map((p, i) => (
                      <tr key={i}>
                        <td className="td-paso">{p.paso}</td>
                        <td className="td-x">{p.x.toFixed(6)}</td>
                        <td className="td-y">{p.y.toFixed(8)}</td>
                        <td className="td-h">{p.h_usado != null ? p.h_usado : '—'}</td>
                        <td className="td-k">{p.k1 != null ? p.k1.toFixed(6) : '—'}</td>
                        <td className="td-k">{p.k2 != null ? p.k2.toFixed(6) : '—'}</td>
                        <td className="td-k">{p.k3 != null ? p.k3.toFixed(6) : '—'}</td>
                        <td className="td-k">{p.k4 != null ? p.k4.toFixed(6) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RungeKuttaComponent;