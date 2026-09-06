import React, { useEffect, useState, useCallback } from 'react';
import { Landmark, TrendingUp, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Trash2, X, Settings, Check, ArrowUp, ArrowDown, Edit2, Clock, CheckCircle2 } from 'lucide-react';

const S = {
  card:     { background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' },
  raised:   { background: 'var(--color-bw-raised)',  border: '1px solid var(--color-bw-border-strong)' },
  divider:  { borderTop: '1px solid var(--color-bw-border)' },
  input:    { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-white)', borderRadius: 0, width: '100%', padding: '0.5rem 0.625rem', fontSize: 'var(--text-bw-sm)' },
  label:    { color: 'var(--color-bw-muted)', fontSize: 'var(--text-bw-xs)', display: 'block', marginBottom: '0.25rem' },
};

const API_URL = import.meta.env.PUBLIC_API_URL + '/cuenta.php';

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });

const TIPO_META = {
  deposito:         { label: 'Depósito / Entrada',         icon: ArrowUpCircle,   color: 'text-blue-400',    borderColor: 'rgba(59,130,246,0.25)',  bg: 'rgba(59,130,246,0.05)',   sign: '+' },
  retiro:           { label: 'Retiro / Inversión',          icon: ArrowDownCircle, color: 'text-orange-400',  borderColor: 'rgba(234,88,12,0.25)',   bg: 'rgba(234,88,12,0.05)',    sign: '-' },
  rendimiento:      { label: 'Rendimiento / Ganancia',      icon: TrendingUp,      color: 'text-emerald-400', borderColor: 'rgba(16,185,129,0.25)', bg: 'rgba(16,185,129,0.05)',  sign: '+' },
  gasto:            { label: 'Gasto Op. / General',         icon: ArrowDownCircle, color: 'text-red-400',     borderColor: 'rgba(239,68,68,0.25)',   bg: 'rgba(239,68,68,0.05)',    sign: '-' },
  nomina:           { label: 'Extracción Nómina',           icon: ArrowDownCircle, color: 'text-purple-400',  borderColor: 'rgba(168,85,247,0.25)', bg: 'rgba(168,85,247,0.05)',  sign: '-' },
  ingreso_esperado: { label: 'Ingreso Esperado / En Cobro', icon: Clock,           color: 'text-yellow-400',  borderColor: 'rgba(234,179,8,0.25)',   bg: 'rgba(234,179,8,0.05)',    sign: '~' },
};

// Color del botón de guardar según tipo
const SAVE_BG = {
  deposito: '#2563eb', retiro: '#ea580c', gasto: '#dc2626',
  ingreso_esperado: '#ca8a04', rendimiento: '#059669', nomina: '#7c3aed',
};

export default function CuentaBancariaSection({ onTasaChange, globalMetrics }) {
  const [metrics, setMetrics]         = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(null);
  const [formData, setFormData]       = useState({ monto: '', fecha: '', notas: '', inversion_ref: '' });
  const [saving, setSaving]           = useState(false);
  const [editingMovId, setEditingMovId]   = useState(null);
  const [editMovData, setEditMovData]     = useState({ monto: '', fecha: '', notas: '', inversion_ref: '', tipo: '' });
  const [savingEdit, setSavingEdit]       = useState(false);
  const [convertingId, setConvertingId]   = useState(null);
  const [convertFecha, setConvertFecha]   = useState(new Date().toISOString().slice(0, 10));
  const [savingConvert, setSavingConvert] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm]       = useState({ nombre_banco: '', tasa_rendimiento: '', porcentaje_salario: '' });
  const [savingConfig, setSavingConfig]   = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [mRes, movRes] = await Promise.all([
        fetch(`${API_URL}?action=metrics`, { credentials: 'include' }),
        fetch(API_URL, { credentials: 'include' }),
      ]);
      if (mRes.ok) {
        const m = await mRes.json();
        setMetrics(m);
        if (onTasaChange) onTasaChange(parseFloat(m.tasa_rendimiento) || 8);
      }
      if (movRes.ok) setMovimientos(await movRes.json());
    } catch (e) { console.error('Error Cuenta:', e); }
    finally { setLoading(false); }
  }, [onTasaChange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAdd() {
    if (!formData.monto) return alert('Monto obligatorio');
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: showForm, monto: parseFloat(formData.monto), fecha: formData.fecha || new Date().toISOString().slice(0, 10), notas: formData.notas || null, inversion_ref: formData.inversion_ref || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setShowForm(null);
      setFormData({ monto: '', fecha: '', notas: '', inversion_ref: '' });
      await fetchAll();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await fetch(API_URL, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await fetchAll();
  }

  function startEditMov(m) {
    setEditingMovId(m.id);
    setEditMovData({ monto: m.monto || '', fecha: m.fecha || '', notas: m.notas || '', inversion_ref: m.inversion_ref || '', tipo: m.tipo || '' });
    setConvertingId(null);
  }

  async function handleSaveEdit(id) {
    setSavingEdit(true);
    try {
      const res = await fetch(API_URL, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tipo: editMovData.tipo, monto: parseFloat(editMovData.monto), fecha: editMovData.fecha, notas: editMovData.notas || null, inversion_ref: editMovData.inversion_ref || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al editar'); }
      setEditingMovId(null);
      await fetchAll();
    } catch (e) { alert(e.message); }
    finally { setSavingEdit(false); }
  }

  async function handleConvertToIngreso(m) {
    setSavingConvert(true);
    try {
      const res = await fetch(API_URL, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, tipo: 'deposito', monto: parseFloat(m.monto), fecha: convertFecha, notas: m.notas ? `${m.notas} (Cobrado - antes esperado)` : 'Cobrado (antes ingreso esperado)', inversion_ref: m.inversion_ref || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al convertir'); }
      setConvertingId(null);
      await fetchAll();
    } catch (e) { alert(e.message); }
    finally { setSavingConvert(false); }
  }

  function startEditConfig() {
    setConfigForm({ nombre_banco: metrics?.nombre_banco || '', tasa_rendimiento: metrics?.tasa_rendimiento || '8', porcentaje_salario: metrics?.porcentaje_salario || '0' });
    setEditingConfig(true);
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const res = await fetch(`${API_URL}?action=config`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_banco: configForm.nombre_banco, tasa_rendimiento: parseFloat(configForm.tasa_rendimiento), porcentaje_salario: parseFloat(configForm.porcentaje_salario) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setEditingConfig(false);
      await fetchAll();
    } catch (e) { alert(e.message); }
    finally { setSavingConfig(false); }
  }

  const meta = showForm ? TIPO_META[showForm] : null;
  const saldo = parseFloat(metrics?.saldo || 0);
  const saldoTotal = saldo + parseFloat(metrics?.total_esperado || 0);
  const tasa = parseFloat(metrics?.tasa_rendimiento || 8);
  const pNomina = parseFloat(metrics?.porcentaje_salario || 0);
  const gananciaBrutaMes   = parseFloat(globalMetrics?.ganancia_bruta_mes || 0);
  const gastosMes          = parseFloat(globalMetrics?.gastos_mes || 0);
  const gananciaNetaMes    = parseFloat(globalMetrics?.ganancia_neta_mes || 0);
  const nominaYaPagada     = parseFloat(globalMetrics?.nomina_ya_pagada_mes || 0);
  const baseSalarioMes     = gananciaNetaMes > 0 ? gananciaNetaMes * (pNomina / 100) : 0;
  const nominaRetenible    = Math.max(0, baseSalarioMes - nominaYaPagada);
  const nominaDisponible   = Math.min(nominaRetenible, saldo > 0 ? saldo : 0);

  // Línea ~158, antes del render
console.log('globalMetrics recibidos:', {
  ganancia_neta_mes: globalMetrics?.ganancia_neta_mes,
  ganancia_bruta_mes: globalMetrics?.ganancia_bruta_mes,
  gastos_mes: globalMetrics?.gastos_mes,
  nomina_ya_pagada_mes: globalMetrics?.nomina_ya_pagada_mes,
});

  return (
    <div className="mb-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Icono — sin gradiente, cuadrado, borde técnico */}
          <div className="w-7 h-7 flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
            <Landmark size={14} className="text-cyan-400" />
          </div>
          <div>
            {editingConfig ? (
              <input
                value={configForm.nombre_banco}
                onChange={e => setConfigForm({ ...configForm, nombre_banco: e.target.value })}
                className="text-base font-bold outline-none"
                style={{ background: 'transparent', color: 'var(--color-bw-white)', borderBottom: '1px solid #06b6d4' }}
              />
            ) : (
              <h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>
                {metrics?.nombre_banco || 'Cuenta Alto Rendimiento'}
              </h2>
            )}
            <div className="flex items-center gap-2">
              {editingConfig ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.01" min="0" max="100" value={configForm.tasa_rendimiento}
                      onChange={e => setConfigForm({ ...configForm, tasa_rendimiento: e.target.value })}
                      className="w-16 text-xs text-cyan-400 px-1.5 py-0.5 outline-none"
                      style={{ background: 'var(--color-bw-raised)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 0 }} />
                    <span className="text-xs mr-2" style={{ color: 'var(--color-bw-muted)' }}>% E.A.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Salario:</span>
                    <input type="number" step="0.01" min="0" value={configForm.porcentaje_salario}
                      onChange={e => setConfigForm({ ...configForm, porcentaje_salario: e.target.value })}
                      className="w-14 text-xs text-purple-400 px-1.5 py-0.5 outline-none"
                      style={{ background: 'var(--color-bw-raised)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 0 }} />
                    <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>% base util.</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-cyan-400 font-medium">{tasa}% E.A. · Nómina al {metrics?.porcentaje_salario || 0}%</p>
              )}
              {editingConfig ? (
                <div className="flex gap-1 ml-1">
                  <button onClick={saveConfig} disabled={savingConfig} className="text-green-500 hover:text-green-400"><Check size={13} /></button>
                  <button onClick={() => setEditingConfig(false)} style={{ color: 'var(--color-bw-muted)' }}><X size={13} /></button>
                </div>
              ) : (
                <button onClick={startEditConfig} title="Editar nombre y tasa"
                  style={{ color: 'var(--color-bw-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}
                >
                  <Settings size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 flex-wrap justify-end">
          {['deposito', 'retiro', 'rendimiento', 'gasto', 'ingreso_esperado'].map(tipo => {
            const t = TIPO_META[tipo];
            const Icon = t.icon;
            const labels = { deposito: 'Entrada', retiro: 'Retiro', rendimiento: 'Ganancia', gasto: 'Gasto', ingreso_esperado: 'Esperado' };
            return (
              <button key={tipo}
                onClick={() => { setShowForm(tipo); setFormData({ monto: '', fecha: '', notas: '', inversion_ref: '' }); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs transition-colors ${t.color}`}
                style={{ background: t.bg, border: `1px solid ${t.borderColor}`, borderRadius: 0 }}
              >
                <Icon size={13} /> {labels[tipo]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulario inline */}
      {showForm && meta && (
        <div className="mb-4 p-4" style={{ border: `1px solid ${meta.borderColor}`, background: meta.bg }}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
            <button onClick={() => setShowForm(null)} style={{ color: 'var(--color-bw-muted)' }}><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label style={S.label}>Monto (COP) {showForm === 'nomina' && `(Máx: ${fmt(nominaDisponible)})`}</label>
              <input type="number" step="0.01" autoFocus value={formData.monto}
                onChange={e => {
                  let v = parseFloat(e.target.value);
                  if (showForm === 'nomina' && v > nominaDisponible) v = nominaDisponible;
                  setFormData({ ...formData, monto: isNaN(v) ? e.target.value : v.toString() });
                }}
                placeholder="Ej: 50000" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Fecha</label>
              <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} style={S.input} />
            </div>
            <div>
              <label style={S.label}>
                {showForm === 'retiro' ? 'Destino (Inversión)' : showForm === 'gasto' ? 'Concepto (Herramientas, etc)' : showForm === 'ingreso_esperado' ? 'Origen / Deudor' : 'Origen / Referencia'}
              </label>
              <input type="text" value={formData.inversion_ref} onChange={e => setFormData({ ...formData, inversion_ref: e.target.value })}
                placeholder={showForm === 'retiro' ? 'Ej: Compra Ecopetrol' : showForm === 'gasto' ? 'Ej: Suscripción Adobe' : showForm === 'ingreso_esperado' ? 'Ej: Cliente X' : 'Ej: Venta celular'}
                style={S.input} />
            </div>
            <div>
              <label style={S.label}>Notas</label>
              <input type="text" value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} placeholder="Opcional" style={S.input} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} disabled={saving}
              className="px-5 py-2 text-white text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: SAVE_BG[showForm] || '#2563eb', borderRadius: 0 }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(null)} className="px-4 py-2 text-sm" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-sm" style={{ color: 'var(--color-bw-muted)' }}>Cargando cuenta...</div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="col-span-2 lg:col-span-1 p-4" style={{ ...S.card, border: '1px solid rgba(34,211,238,0.2)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Saldo Actual</p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmt(saldo)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>Balance disponible</p>
              {parseFloat(metrics?.total_esperado || 0) > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>
                  Total + Esperado: <span style={{ color: 'var(--color-bw-secondary)' }}>{fmt(saldoTotal)}</span>
                </p>
              )}
            </div>
            <div className="p-4" style={S.card}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Renta / Mes</p>
              <p className="text-lg font-bold text-emerald-400">{fmt(metrics?.rendimiento_mensual_proyectado)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>Proyectado al {tasa}%</p>
            </div>
            <div className="p-4" style={S.card}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Renta / Año</p>
              <p className="text-lg font-bold text-emerald-400">{fmt(metrics?.rendimiento_anual_proyectado)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>Si no mueves nada</p>
            </div>
            <div className="p-4" style={S.card}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Interés Producido</p>
              <p className="text-lg font-bold text-emerald-400">{fmt(metrics?.total_rendimientos)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>Beneficio en efectivo</p>
            </div>
          </div>

          {/* Nómina Directiva */}
          <div className="p-4 mb-6" style={{ ...S.card, border: '1px solid rgba(168,85,247,0.2)' }}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium mb-1 text-purple-300">Cálculo Nómina Directiva (Mes Actual)</p>
                <p className="text-2xl font-bold text-purple-400 mb-2">
                  {fmt(nominaDisponible)} <span className="text-xs font-normal" style={{ color: 'var(--color-bw-muted)' }}>disponible para retirar</span>
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] p-3 mt-2"
                  style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)', color: 'var(--color-bw-muted)' }}>
                  <div className="flex flex-col">
                    <span>Utilidad bruta mes:</span>
                    <span className="font-semibold text-green-400">{fmt(gananciaBrutaMes)}</span>
                  </div>
                  {gastosMes > 0 && (
                    <>
                      <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--color-bw-border)' }} />
                      <div className="flex flex-col">
                        <span>− Gastos mes:</span>
                        <span className="font-semibold text-red-400">-{fmt(gastosMes)}</span>
                      </div>
                    </>
                  )}
                  <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--color-bw-border)' }} />
                  <div className="flex flex-col">
                    <span>= Util. Neta mes:</span>
                    <span className={`font-bold ${gananciaNetaMes >= 0 ? 'text-gray-200' : 'text-red-400'}`}>{fmt(gananciaNetaMes)}</span>
                  </div>
                  <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--color-bw-border)' }} />
                  <div className="flex flex-col">
                    <span>Base {pNomina}% mes:</span>
                    <span className="font-semibold" style={{ color: 'var(--color-bw-secondary)' }}>{fmt(baseSalarioMes)}</span>
                  </div>
                  <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--color-bw-border)' }} />
                  <div className="flex flex-col">
                    <span>Abonado mes:</span>
                    <span className="font-semibold text-purple-400">{fmt(nominaYaPagada)}</span>
                  </div>
                  <div className="w-px h-6 hidden sm:block" style={{ background: 'var(--color-bw-border)' }} />
                  <div className="flex flex-col">
                    <span>Saldo cuenta req.:</span>
                    <span className={`font-bold ${saldo >= nominaRetenible ? 'text-green-500' : 'text-red-500'}`}>{fmt(saldo)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowForm('nomina'); setFormData({ monto: nominaDisponible.toString(), fecha: '', notas: 'Pago Nómina Directiva', inversion_ref: '' }); }}
                disabled={nominaDisponible <= 0}
                className="w-full md:w-auto shrink-0 px-6 py-3 text-white text-sm font-medium transition-colors disabled:opacity-40"
                style={{ background: '#7c3aed', borderRadius: 0 }}
                onMouseEnter={e => { if (nominaDisponible > 0) e.currentTarget.style.background = '#6d28d9'; }}
                onMouseLeave={e => e.currentTarget.style.background = '#7c3aed'}
              >
                Efectuar Pago Parcial/Total
              </button>
            </div>
          </div>

          {/* Extracto */}
          {movimientos.length > 0 ? (
            <div style={S.card} className="overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={S.divider}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-bw-white)' }}>Extracto</span>
                <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--color-bw-muted)' }}>
                  <span className="text-blue-400 flex items-center gap-1"><ArrowUp size={10} /> {fmt(metrics?.total_depositos)}</span>
                  <span className="text-emerald-400 flex items-center gap-1"><TrendingUp size={10} /> {fmt(metrics?.total_rendimientos)}</span>
                  <span className="text-orange-400 flex items-center gap-1"><ArrowDown size={10} /> {fmt(metrics?.total_retiros)}</span>
                  <span className="text-red-400 flex items-center gap-1"><ArrowDown size={10} /> {fmt(metrics?.total_gastos)}</span>
                  <span className="text-purple-400 flex items-center gap-1"><ArrowDown size={10} /> {fmt(metrics?.total_nomina)}</span>
                  {parseFloat(metrics?.total_esperado || 0) > 0 && (
                    <span className="text-yellow-400 flex items-center gap-1"><Clock size={10} /> {fmt(metrics?.total_esperado)}</span>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {movimientos.map(m => {
                  const t = TIPO_META[m.tipo] || TIPO_META['deposito'];
                  const Icon = t.icon;
                  const isEsperado = m.tipo === 'ingreso_esperado';

                  if (editingMovId === m.id) {
                    return (
                      <div key={m.id} className="px-4 py-3" style={{ background: 'var(--color-bw-raised)', borderBottom: '1px solid var(--color-bw-border)' }}>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                          <div>
                            <label style={{ ...S.label, fontSize: '0.625rem' }}>Tipo</label>
                            <select value={editMovData.tipo} onChange={e => setEditMovData({ ...editMovData, tipo: e.target.value })}
                              style={{ ...S.input, fontSize: '0.7rem', padding: '0.375rem 0.5rem' }}>
                              {Object.entries(TIPO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: '0.625rem' }}>Monto</label>
                            <input type="number" step="0.01" value={editMovData.monto} onChange={e => setEditMovData({ ...editMovData, monto: e.target.value })}
                              style={{ ...S.input, fontSize: '0.7rem', padding: '0.375rem 0.5rem' }} />
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: '0.625rem' }}>Fecha</label>
                            <input type="date" value={editMovData.fecha} onChange={e => setEditMovData({ ...editMovData, fecha: e.target.value })}
                              style={{ ...S.input, fontSize: '0.7rem', padding: '0.375rem 0.5rem' }} />
                          </div>
                          <div>
                            <label style={{ ...S.label, fontSize: '0.625rem' }}>Referencia</label>
                            <input type="text" value={editMovData.inversion_ref} onChange={e => setEditMovData({ ...editMovData, inversion_ref: e.target.value })}
                              style={{ ...S.input, fontSize: '0.7rem', padding: '0.375rem 0.5rem' }} />
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSaveEdit(m.id)} disabled={savingEdit}
                              className="px-3 py-1.5 text-white text-xs disabled:opacity-50 transition-colors" style={{ background: '#2563eb', borderRadius: 0 }}>
                              {savingEdit ? '...' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditingMovId(null)} className="px-2 py-1.5 text-xs" style={{ color: 'var(--color-bw-muted)' }}>✕</button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <input type="text" placeholder="Notas" value={editMovData.notas} onChange={e => setEditMovData({ ...editMovData, notas: e.target.value })}
                            style={{ ...S.input, fontSize: '0.7rem', padding: '0.375rem 0.5rem' }} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id}>
                      <div
                        className={`flex items-center justify-between px-4 py-3 group transition-colors ${isEsperado ? 'border-l-2 border-l-yellow-600' : ''}`}
                        style={{ borderBottom: '1px solid var(--color-bw-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bw-raised)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={15} className={`flex-shrink-0 ${t.color}`} />
                          <div>
                            <div className={`text-sm font-medium ${t.color} flex items-center gap-2`}>
                              {t.label}
                              {isEsperado && (
                                <span className="text-[9px] text-yellow-500 px-1.5 py-0.5 uppercase tracking-wider"
                                  style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                                  Pendiente
                                </span>
                              )}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>
                              {m.fecha}
                              {m.inversion_ref && <span className="ml-2">{m.inversion_ref}</span>}
                              {m.notas && <span className="ml-2">{m.notas}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${m.tipo === 'retiro' ? 'text-orange-400' : isEsperado ? 'text-yellow-400 opacity-70' : t.color}`}>
                            {t.sign}{fmt(m.monto)}
                          </span>
                          {isEsperado && (
                            <button onClick={() => { setConvertingId(convertingId === m.id ? null : m.id); setConvertFecha(new Date().toISOString().slice(0, 10)); setEditingMovId(null); }}
                              className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-400 transition-all" title="Convertir a ingreso real">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button onClick={() => { startEditMov(m); setConvertingId(null); }}
                            className="opacity-0 group-hover:opacity-100 transition-all hover:text-blue-400"
                            style={{ color: 'var(--color-bw-muted)' }}><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition-all hover:text-red-500"
                            style={{ color: 'var(--color-bw-muted)' }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {/* Convertir ingreso esperado */}
                      {convertingId === m.id && isEsperado && (
                        <div className="px-6 py-3 flex items-center gap-3 flex-wrap"
                          style={{ background: 'rgba(16,185,129,0.04)', borderTop: '1px solid rgba(16,185,129,0.2)', borderBottom: '1px solid var(--color-bw-border)' }}>
                          <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                          <span className="text-xs text-green-300 font-medium">Confirmar cobro de {fmt(m.monto)}</span>
                          <div>
                            <label style={{ ...S.label, fontSize: '0.625rem' }}>Fecha de cobro real</label>
                            <input type="date" value={convertFecha} onChange={e => setConvertFecha(e.target.value)}
                              style={{ ...S.input, width: 'auto', padding: '0.375rem 0.5rem', fontSize: '0.7rem', border: '1px solid rgba(16,185,129,0.35)' }} />
                          </div>
                          <button onClick={() => handleConvertToIngreso(m)} disabled={savingConvert}
                            className="px-4 py-1.5 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                            style={{ background: '#059669', borderRadius: 0 }}>
                            {savingConvert ? 'Procesando...' : 'Confirmar Ingreso'}
                          </button>
                          <button onClick={() => setConvertingId(null)} className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--color-bw-muted)', border: '1px dashed var(--color-bw-border)' }}>
              Sin movimientos. Registra tu primer depósito o rendimiento.
            </div>
          )}
        </>
      )}
    </div>
  );
}