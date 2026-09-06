import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, PlusCircle, DollarSign, Trash2, X, Layers, BarChart2, Clock, Wallet, ArrowDownToLine, ArrowUp, ArrowDown } from 'lucide-react';

const API_URL = import.meta.env.PUBLIC_API_URL + '/brandlab.php';
const TASA_OPORTUNIDAD = 8.0;

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });

const inputStyle = {
  background: 'var(--color-bw-raised)',
  border: '1px solid var(--color-bw-border-strong)',
  color: 'var(--color-bw-white)',
  borderRadius: 0,
  padding: '0.5rem 0.625rem',
  fontSize: 'var(--text-bw-sm)',
  width: '100%',
};

export default function BrandLabSection() {
  const [metrics, setMetrics] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);
  const [formData, setFormData] = useState({ monto: '', fecha: '', notas: '', registrar_en_cuenta: true });
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    try {
      const [mRes, movRes] = await Promise.all([
        fetch(`${API_URL}?metrics=true`, { credentials: 'include' }),
        fetch(API_URL, { credentials: 'include' })
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (movRes.ok) setMovimientos(await movRes.json());
    } catch (e) {
      console.error('Error BrandLab:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleAdd() {
    if (!formData.monto) return alert('Monto obligatorio');
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: showForm,
          monto: parseFloat(formData.monto),
          fecha: formData.fecha || new Date().toISOString().slice(0, 10),
          notas: formData.notas || null,
          registrar_en_cuenta: formData.registrar_en_cuenta
        })
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      setShowForm(null);
      setFormData({ monto: '', fecha: '', notas: '', registrar_en_cuenta: true });
      await fetchAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await fetch(API_URL, {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await fetchAll();
  }

  const eaSuperaBench = (metrics?.ea_percent || 0) >= TASA_OPORTUNIDAD;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src="/isotipo-brandlab.png" alt="Boxwill BrandLab" className="w-7 h-7 object-contain" />
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>Boxwill BrandLab</h2>
            <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Participación Empresarial · Equity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowForm('inyeccion'); setFormData({ monto: '', fecha: '', notas: '', registrar_en_cuenta: true }); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-colors bw-btn-ghost"
          >
            <PlusCircle size={13} /> Inyección
          </button>
          <button
            onClick={() => { setShowForm('dividendo'); setFormData({ monto: '', fecha: '', notas: '', registrar_en_cuenta: true }); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs transition-colors bw-btn-ghost"
          >
            <DollarSign size={13} /> Dividendo
          </button>
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div
          className="mb-4 p-4"
          style={{
            border: '1px solid var(--color-bw-border-strong)',
            background: 'var(--color-bw-raised)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium flex items-center gap-1.5 ${showForm === 'inyeccion' ? 'text-[var(--color-bw-white)]' : 'text-[var(--color-bw-secondary)]'}`}>
              {showForm === 'inyeccion' ? <><Wallet size={15} /> Registrar Inyección de Capital</> : <><ArrowDownToLine size={15} /> Registrar Dividendo Recibido</>}
            </span>
            <button onClick={() => setShowForm(null)} style={{ color: 'var(--color-bw-muted)' }}><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Monto (COP)</label>
              <input type="number" step="0.01" value={formData.monto}
                onChange={e => setFormData({ ...formData, monto: e.target.value })}
                placeholder="Ej: 500000" autoFocus style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Fecha</label>
              <input type="date" value={formData.fecha}
                onChange={e => setFormData({ ...formData, fecha: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Notas (opcional)</label>
              <input type="text" value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Ej: Q1 2025" style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <button onClick={handleAdd} disabled={saving}
              className="px-5 py-2 text-white text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: showForm === 'inyeccion' ? '#2563eb' : '#059669', borderRadius: 0 }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--color-bw-secondary)' }}>
              <input type="checkbox" checked={formData.registrar_en_cuenta}
                onChange={e => setFormData({ ...formData, registrar_en_cuenta: e.target.checked })}
                className="w-4 h-4" style={{ accentColor: 'var(--color-bw-white)' }} />
              Sincronizar con Cuenta Bancaria
            </label>
            <button onClick={() => setShowForm(null)} className="px-4 py-2 text-sm ml-auto" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-sm" style={{ color: 'var(--color-bw-muted)' }}>Cargando datos BrandLab...</div>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {/* Capital Total */}
            <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Layers size={13} style={{ color: 'var(--color-bw-secondary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Capital Total</span>
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>{fmt(metrics?.total_inyectado)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Inyectado</p>
            </div>

            {/* Dividendos */}
            <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={13} style={{ color: 'var(--color-bw-secondary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Dividendos</span>
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>{fmt(metrics?.total_dividendos)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Recibidos</p>
            </div>

            {/* Saldo Neto */}
            <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: `1px solid ${(metrics?.ganancia_neta || 0) >= 0 ? 'rgba(34,197,94,0.2)' : 'var(--color-bw-border)'}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {(metrics?.ganancia_neta || 0) >= 0
                  ? <TrendingUp size={13} className="text-green-400" />
                  : <TrendingDown size={13} className="text-red-400" />
                }
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Saldo Neto</span>
              </div>
              <p className={`text-base font-bold ${(metrics?.ganancia_neta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(metrics?.ganancia_neta || 0) >= 0 ? '+' : ''}{fmt(metrics?.ganancia_neta)}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Div. - Capital</p>
            </div>

            {/* MOIC */}
            <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart2 size={13} style={{ color: 'var(--color-bw-secondary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>MOIC</span>
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>{(metrics?.moic || 0).toFixed(2)}x</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Multiplicador</p>
            </div>

            {/* E.A. % */}
            <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: `1px solid ${eaSuperaBench ? 'rgba(34,197,94,0.2)' : 'var(--color-bw-border)'}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={13} className={eaSuperaBench ? 'text-green-400' : 'text-gray-400'} />
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>E.A. %</span>
              </div>
              <p className={`text-base font-bold ${eaSuperaBench ? 'text-green-400' : 'text-yellow-500'}`}>
                {(metrics?.ea_percent || 0).toFixed(1)}%
              </p>
              <p className={`text-[10px] mt-0.5 ${eaSuperaBench ? 'text-green-600' : 'text-yellow-700'}`}>
                {eaSuperaBench ? `> ${TASA_OPORTUNIDAD}% banco ✓` : `< ${TASA_OPORTUNIDAD}% banco`}
              </p>
            </div>
          </div>

          {/* Historial */}
          {movimientos.length > 0 ? (
            <div style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-bw-white)' }}>Historial de Movimientos</span>
                <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>{movimientos.length} registros · {metrics?.dias_activo || 0} días activa</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {movimientos.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3 group transition-colors"
                    style={{ borderBottom: '1px solid var(--color-bw-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bw-raised)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-secondary)' }}>
                        {m.tipo === 'inyeccion' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-bw-primary)' }}>
                          {m.tipo === 'inyeccion' ? 'Inyección de Capital' : 'Dividendo Recibido'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>{m.fecha}{m.notas ? ` · ${m.notas}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm" style={{ color: 'var(--color-bw-white)' }}>
                        {m.tipo === 'inyeccion' ? '-' : '+'}{fmt(m.monto)}
                      </span>
                      <button onClick={() => handleDelete(m.id)}
                        className="opacity-0 group-hover:opacity-100 transition-all text-gray-600 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--color-bw-muted)', border: '1px dashed var(--color-bw-border)' }}>
              Aún no hay movimientos. Registra tu primera inyección o dividendo.
            </div>
          )}
        </>
      )}
    </div>
  );
}