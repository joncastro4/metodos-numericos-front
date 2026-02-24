import { useState, useEffect, useRef } from 'react';
import 'mathlive';
import { Mafs, Coordinates, Point, Polyline, Theme, vec } from "mafs";
import "mafs/core.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type MathfieldElement = HTMLElement & {
  value: string;
  getValue: (format: string) => string;
};

interface Iteracion {
  paso?: number;
  x: number;
  y: number;
  yr?: number;
  "error_%"?: number;
}

interface ApiResponse {
  iteraciones: Iteracion[];
  resultado_final: number;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const asciiToPython = (ascii: string): string => {
  let expr = ascii;

  expr = expr.replace(/(\w)\s+(sqrt|sin|cos|tan|exp|log|ln)\s*\(/g, '$1 * $2(');
  expr = expr.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  expr = expr.replace(/\)([a-zA-Z])/g, ')*$1');
  expr = expr.replace(/\)\s*\(/g, ')*(');
  expr = expr.replace(/\^/g, '**');
  expr = expr.replace(/\bln\b/g, 'log');

  return expr;
};

// ─── Component ───────────────────────────────────────────────────────────────
const HeunComponent = () => {
  const [latex, setLatex] = useState<string>("");
  const [pythonFormula, setPythonFormula] = useState<string>("");
  const [x0, setX0] = useState<string>("1");
  const [y0, setY0] = useState<string>("1");
  const [h, setH] = useState<string>("0.2");
  const [xFin, setXFin] = useState<string>("2");
  const [resultado, setResultado] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const mf = useRef<MathfieldElement>(null);

  useEffect(() => {
    const field = mf.current;
    if (!field) return;
    const handleInput = (e: Event) => {
      const target = e.target as MathfieldElement;
      setLatex(target.value);
      const ascii = target.getValue('ascii-math');
      setPythonFormula(asciiToPython(ascii));
    };
    field.addEventListener('input', handleInput);
    return () => field.removeEventListener('input', handleInput);
  }, []);

  const handleCalcular = async () => {
    if (!pythonFormula.trim()) {
      setError("Ingresa una ecuación antes de calcular.");
      return;
    }
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const response = await fetch("http://127.0.0.1:5000/resolver_heun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecuacion: pythonFormula,
          x0: parseFloat(x0),
          y0: parseFloat(y0),
          h: parseFloat(h),
          x_fin: parseFloat(xFin),
        }),
      });
      if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
      const data: ApiResponse = await response.json();
      const seen = new Set<number>();
      const unique = data.iteraciones.filter(p => {
        if (seen.has(p.x)) return false;
        seen.add(p.x);
        return true;
      });
      setResultado({ ...data, iteraciones: unique });
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed') || err.message?.includes('CORS')) {
        setError("CORS_ERROR");
      } else {
        setError(err.message || "Error desconocido.");
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

  // Detect whether the data includes yr / error_% columns
  const hasYr = puntos.some(p => p.yr !== undefined);
  const hasError = puntos.some(p => p["error_%"] !== undefined);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#1e293b' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        .hc-page { max-width: 860px; margin: 0 auto; padding: 32px 20px 60px; }

        .hc-header {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 28px; padding-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        .hc-icon-box {
          width: 48px; height: 48px; background: #2563eb;
          border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .hc-title { font-size: 1.45rem; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.2; }
        .hc-subtitle { font-size: 0.83rem; color: #64748b; margin: 3px 0 0; }

        .hc-card {
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 12px; padding: 22px 24px;
          margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .hc-card-title {
          font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #64748b; margin: 0 0 14px;
        }

        .hc-label { display: block; font-size: 0.8rem; font-weight: 500; color: #475569; margin-bottom: 5px; }
        .hc-input {
          width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1;
          border-radius: 8px; font-size: 0.95rem;
          font-family: 'Inter', system-ui, sans-serif;
          color: #0f172a; background: #fff; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .hc-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }

        .hc-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }

        .hc-math-wrap math-field {
          display: block; width: 100%;
          border: 1px solid #cbd5e1 !important; border-radius: 8px !important;
          padding: 10px 12px !important; font-size: 1.3rem;
          background: #fff !important; color: #0f172a !important; outline: none !important;
          --caret-color: #2563eb; --selection-background-color: rgba(37,99,235,0.15);
        }
        .hc-math-wrap math-field:focus-within {
          border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
        }
        .hc-formula-tag {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 10px;
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;
          padding: 5px 10px; font-size: 0.82rem; color: #1d4ed8;
          font-family: 'Courier New', monospace; word-break: break-all;
        }
        .hc-formula-dot { width: 6px; height: 6px; border-radius: 50%; background: #2563eb; flex-shrink: 0; }

        .hc-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 12px 24px; background: #2563eb; color: #fff;
          border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600;
          font-family: 'Inter', system-ui, sans-serif; cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.25); margin-bottom: 18px;
        }
        .hc-btn:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 4px 14px rgba(37,99,235,0.35); transform: translateY(-1px); }
        .hc-btn:active:not(:disabled) { transform: none; }
        .hc-btn:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .hc-error {
          display: flex; align-items: flex-start; gap: 10px;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
          padding: 14px 16px; color: #b91c1c; font-size: 0.875rem; line-height: 1.5; margin-bottom: 8px;
        }
        .hc-cors-hint {
          background: #fefce8; border: 1px solid #fde047; border-radius: 8px;
          padding: 13px 15px; font-size: 0.8rem; color: #713f12;
          margin-bottom: 18px; line-height: 1.7;
        }
        .hc-cors-hint code {
          background: #fef08a; border-radius: 4px; padding: 1px 5px;
          font-family: 'Courier New', monospace; font-size: 0.8rem;
        }

        .hc-result-badge {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; background: #eff6ff;
          border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-bottom: 18px;
        }
        .hc-result-label { font-size: 0.72rem; font-weight: 600; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.07em; }
        .hc-result-eq { font-size: 0.9rem; color: #3b82f6; margin-top: 2px; }
        .hc-result-value { font-size: 2.2rem; font-weight: 700; color: #1e40af; font-variant-numeric: tabular-nums; }

        .hc-table-wrap { overflow-x: auto; }
        table.hc-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .hc-table th {
          padding: 9px 16px; text-align: left; font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase; color: #64748b;
          border-bottom: 2px solid #e2e8f0; white-space: nowrap; background: #f8fafc;
        }
        .hc-table td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .hc-table tbody tr:hover td { background: #f8fafc; }
        .hc-table tbody tr:last-child td { border-bottom: none; }
        .td-step { color: #94a3b8; font-size: 0.8rem; }
        .td-x { color: #2563eb; font-weight: 500; }
        .td-y { color: #0f172a; font-weight: 500; }
        .td-delta { color: #16a34a; font-size: 0.82rem; }
        .td-delta-zero { color: #94a3b8; font-size: 0.82rem; }
        .td-yr { color: #7c3aed; font-weight: 500; }
        .td-error { color: #dc2626; font-size: 0.82rem; }
        .td-error-zero { color: #94a3b8; font-size: 0.82rem; }

        .hc-graph-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-top: 4px; }
        .hc-graph-legend { display: flex; gap: 18px; margin-top: 12px; font-size: 0.78rem; color: #64748b; }
        .hc-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .hc-spinner {
          display: inline-block; width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
      `}</style>

      <div className="hc-page">

        {/* Header */}
        <div className="hc-header">
          <div className="hc-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h1 className="hc-title">Método de Heun</h1>
            <p className="hc-subtitle">Euler Mejorado — Solución numérica de EDOs de primer orden</p>
          </div>
        </div>

        {/* Equation */}
        <div className="hc-card">
          <p className="hc-card-title">Ecuación diferencial &nbsp; dy/dx = f(x, y)</p>
          <div className="hc-math-wrap">
            {/* @ts-ignore */}
            <math-field ref={mf} />
          </div>
          {pythonFormula && (
            <div className="hc-formula-tag">
              <span className="hc-formula-dot" />
              Python: {pythonFormula}
            </div>
          )}
        </div>

        {/* Parameters */}
        <div className="hc-card">
          <p className="hc-card-title">Parámetros iniciales</p>
          <div className="hc-grid-4">
            <div>
              <label className="hc-label">x₀ — punto inicial</label>
              <input className="hc-input" type="number" value={x0} onChange={e => setX0(e.target.value)} step="any" />
            </div>
            <div>
              <label className="hc-label">y₀ — condición inicial</label>
              <input className="hc-input" type="number" value={y0} onChange={e => setY0(e.target.value)} step="any" />
            </div>
            <div>
              <label className="hc-label">h — tamaño de paso</label>
              <input className="hc-input" type="number" value={h} onChange={e => setH(e.target.value)} step="0.01" />
            </div>
            <div>
              <label className="hc-label">x final — límite</label>
              <input className="hc-input" type="number" value={xFin} onChange={e => setXFin(e.target.value)} step="any" />
            </div>
          </div>
        </div>

        {/* Button */}
        <button className="hc-btn" onClick={handleCalcular} disabled={loading}>
          {loading ? (
            <><span className="hc-spinner" /> Calculando...</>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Calcular
            </>
          )}
        </button>

        {/* Error */}
        {error === "CORS_ERROR" ? (
          <>
            <div className="hc-error">
              <span>⚠</span>
              <span>No se pudo conectar con el servidor — posible error de CORS. Asegúrate de que Flask esté corriendo y tenga CORS habilitado.</span>
            </div>
            <div className="hc-cors-hint">
              <strong>¿Cómo habilitar CORS en Flask?</strong><br />
              1. Instala la librería: <code>pip install flask-cors</code><br />
              2. Agrega estas líneas en tu <code>app.py</code>:<br />
              <code>from flask_cors import CORS</code><br />
              <code>CORS(app)</code>
            </div>
          </>
        ) : error ? (
          <div className="hc-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        {/* Results */}
        {resultado && (
          <>
            {/* Badge */}
            <div className="hc-result-badge">
              <div>
                <div className="hc-result-label">Resultado final</div>
                <div className="hc-result-eq">y({xFin}) ≈</div>
              </div>
              <div className="hc-result-value">{resultado.resultado_final.toFixed(6)}</div>
            </div>

            {/* Graph */}
            <div className="hc-card">
              <p className="hc-card-title">Gráfica de la solución aproximada</p>
              <div className="hc-graph-wrap">
                <Mafs
                  viewBox={{ x: [xMin, xMax], y: [yMin, yMax] }}
                  preserveAspectRatio={false}
                  height={300}
                >
                  <Coordinates.Cartesian />
                  {puntos.length > 1 && (
                    <Polyline
                      points={puntos.map(p => [p.x, p.y] as vec.Vector2)}
                      color="#2563eb"
                      strokeWidth={2.5}
                    />
                  )}
                  {puntos.map((p, i) => (
                    <Point key={i} x={p.x} y={p.y} color={i === 0 ? "#f59e0b" : "#2563eb"} />
                  ))}
                </Mafs>
              </div>
              <div className="hc-graph-legend">
                <span><span className="hc-legend-dot" style={{ background: '#f59e0b' }} />Punto inicial (x₀, y₀)</span>
                <span><span className="hc-legend-dot" style={{ background: '#2563eb' }} />Iteraciones</span>
              </div>
            </div>

            {/* Table */}
            <div className="hc-card">
              <p className="hc-card-title">Tabla de iteraciones</p>
              <div className="hc-table-wrap">
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>Paso</th>
                      <th>x</th>
                      <th>y (aprox.)</th>
                      <th>Δy</th>
                      {hasYr && <th>y real</th>}
                      {hasError && <th>Error (%)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {puntos.map((p, i) => {
                      const delta = i === 0 ? null : p.y - puntos[i - 1].y;
                      return (
                        <tr key={i}>
                          <td className="td-step">{p.paso ?? i}</td>
                          <td className="td-x">{p.x.toFixed(4)}</td>
                          <td className="td-y">{p.y.toFixed(6)}</td>
                          <td className={delta !== null ? 'td-delta' : 'td-delta-zero'}>
                            {delta !== null ? (delta >= 0 ? `+${delta.toFixed(6)}` : delta.toFixed(6)) : '—'}
                          </td>
                          {hasYr && (
                            <td className="td-yr">
                              {p.yr !== undefined ? p.yr.toFixed(6) : '—'}
                            </td>
                          )}
                          {hasError && (
                            <td className={p["error_%"] !== undefined && p["error_%"] > 0 ? 'td-error' : 'td-error-zero'}>
                              {p["error_%"] !== undefined ? `${p["error_%"].toFixed(6)}%` : '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
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

export default HeunComponent;