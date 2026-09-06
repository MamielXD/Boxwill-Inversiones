import React, { useEffect, useState, useCallback } from 'react';
import { HandCoins, ChevronDown, ChevronUp, PlusCircle, Trash2, X, Check, Landmark, AlertCircle, AlertTriangle, Pencil } from 'lucide-react';
import EditPrestamoModal from './EditPrestamoModal';
import RefinanciarModal from './RefinanciarModal';


const S = {
  card: { background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' },
  raised: { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)' },
  divider: { borderTop: '1px solid var(--color-bw-border)' },
  input: { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-white)', borderRadius: 0, width: '100%', padding: '0.5rem 0.625rem', fontSize: 'var(--text-bw-sm)' },
  label: { color: 'var(--color-bw-muted)', fontSize: 'var(--text-bw-xs)', display: 'block', marginBottom: '0.25rem' },
};

const API_URL = import.meta.env.PUBLIC_API_URL + '/prestamos.php';

const fmt = (n) => parseFloat(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const fmtPct = (n) => `${parseFloat(n || 0).toFixed(2)}%`;
const calcEA = (t) => ((Math.pow(1 + t / 100, 12) - 1) * 100).toFixed(2);
const calcNA = (t) => (parseFloat(t || 0) * 12).toFixed(2);
const DIAS_GRACIA = 5;
const DIAS_SIN_INTERES = 10;
const toDate = (v) => new Date(`${v}T00:00:00`);

function calcularTablaPreview(monto, tasaMensual, numCuotas, fechaInicio, comision = 0) {
  const r = tasaMensual / 100;
  const cuotaBase = r === 0
    ? monto / numCuotas
    : monto * (r * Math.pow(1 + r, numCuotas)) / (Math.pow(1 + r, numCuotas) - 1);
  const cuotaComision = comision / numCuotas;
  const cuota = cuotaBase + cuotaComision;
  const date = toDate(fechaInicio);
  date.setMonth(date.getMonth() + numCuotas);
  const fechaUltimaCuota = date.toISOString().slice(0, 10);
  return { cuota, totalPagar: cuota * numCuotas, totalIntereses: (cuota * numCuotas) - monto, fechaUltimaCuota };
}

function NuevoPrestamoForm({ onSaved, onCancel }) {
  const [f, setF] = useState({
    prestatario: '', monto_original: '', tasa_mensual: '', comision: '',
    num_cuotas: '', fecha_inicio: new Date().toISOString().slice(0, 10),
    notas: '', registrar_en_cuenta: true,
  });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const m = parseFloat(f.monto_original), r = parseFloat(f.tasa_mensual), n = parseInt(f.num_cuotas), c = parseFloat(f.comision || 0);
    if (m > 0 && r >= 0 && n > 0 && f.fecha_inicio) {
      const { cuota, totalPagar, totalIntereses, fechaUltimaCuota } = calcularTablaPreview(m, r, n, f.fecha_inicio, c);
      setPreview({ cuota, totalPagar, totalIntereses, fecha_ultima: fechaUltimaCuota });
    } else { setPreview(null); }
  }, [f.monto_original, f.tasa_mensual, f.num_cuotas, f.fecha_inicio, f.comision]);

  async function handleSave(e) {
    e.preventDefault();
    if (!f.prestatario || f.monto_original === '' || f.tasa_mensual === '' || !f.num_cuotas)
      return alert('Completa todos los campos requeridos');
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, monto_original: parseFloat(f.monto_original), tasa_mensual: parseFloat(f.tasa_mensual), comision: parseFloat(f.comision || 0), num_cuotas: parseInt(f.num_cuotas) }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error); }
      onSaved();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="mb-6 p-5" style={S.card}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-bw-white)' }}>Nuevo Préstamo</h3>
        <button type="button" onClick={onCancel} style={{ color: 'var(--color-bw-muted)' }}><X size={15} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="space-y-1 sm:col-span-3 md:col-span-1">
          <label style={S.label}>Prestatario *</label>
          <input value={f.prestatario} onChange={e => setF({ ...f, prestatario: e.target.value })} placeholder="Nombre de quien recibe el préstamo" style={S.input} />
        </div>
        <div className="space-y-1">
          <label style={S.label}>Capital Prestado (COP) *</label>
          <input type="number" step="0.01" value={f.monto_original} onChange={e => setF({ ...f, monto_original: e.target.value })} placeholder="Ej: 2000000" style={S.input} />
        </div>
        <div className="space-y-1">
          <label style={S.label}>Tasa Mensual (%) *</label>
          <input type="number" step="0.01" min="0" value={f.tasa_mensual} onChange={e => setF({ ...f, tasa_mensual: e.target.value })} placeholder="Ej: 2.5" style={S.input} />
          {parseFloat(f.tasa_mensual) > 0 && (
            <p className="text-xs text-violet-400 mt-1">≈ {calcEA(parseFloat(f.tasa_mensual))}% E.A. · {calcNA(parseFloat(f.tasa_mensual))}% N.A.</p>
          )}
        </div>
        <div className="space-y-1">
          <label style={S.label}>Comisión / Cargo Fijo (COP)</label>
          <input type="number" step="0.01" min="0" value={f.comision} onChange={e => setF({ ...f, comision: e.target.value })} placeholder="Ej: 100000" style={S.input} />
        </div>
        <div className="space-y-1">
          <label style={S.label}>Número de Cuotas *</label>
          <input type="number" min="1" value={f.num_cuotas} onChange={e => setF({ ...f, num_cuotas: e.target.value })} placeholder="Ej: 12" style={S.input} />
        </div>
        <div className="space-y-1">
          <label style={S.label}>Fecha de Inicio *</label>
          <input type="date" value={f.fecha_inicio} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} style={S.input} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <label style={S.label}>Notas</label>
          <input value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Destino del préstamo, garantías, etc." style={S.input} />
        </div>
      </div>

      {preview && (
        <div className="mb-4 p-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <p className="text-xs font-semibold text-violet-400 mb-2 uppercase tracking-wider">Vista Previa del Préstamo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-bw-muted)' }}>Cuota Mensual</p>
              <p className="font-bold" style={{ color: 'var(--color-bw-white)' }}>{fmt(preview.cuota)}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-bw-muted)' }}>Total a Recibir</p>
              <p className="font-bold text-emerald-400">{fmt(preview.totalPagar)}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-bw-muted)' }}>Total Intereses</p>
              <p className="font-bold text-emerald-400">{fmt(preview.totalIntereses)}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-bw-muted)' }}>Última Cuota</p>
              <p className="font-bold" style={{ color: 'var(--color-bw-secondary)' }}>{preview.fecha_ultima}</p>
            </div>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
        <input type="checkbox" checked={f.registrar_en_cuenta} onChange={e => setF({ ...f, registrar_en_cuenta: e.target.checked })} className="accent-cyan-500 w-4 h-4" />
        <div className="flex items-center gap-1.5">
          <Landmark size={13} className="text-cyan-400" />
          <span className="text-xs text-cyan-300">Registrar retiro en Cuenta Bancaria al crear</span>
        </div>
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 text-white text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: '#7c3aed', borderRadius: 0 }}>
          {saving ? 'Creando...' : 'Crear Préstamo'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
      </div>
    </form>
  );
}

function PrestamoCard({ prestamo, onPagoAdded, onDeleted, onEdit, onRefinanciar }) {
  const [expanded, setExpanded] = useState(false);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [pagoForm, setPagoForm] = useState({ monto: '', fecha: new Date().toISOString().slice(0, 10), notas: '', registrar_en_cuenta: true });
  const [saving, setSaving] = useState(false);
  const [liquidacion, setLiquidacion] = useState({
    saldo_capital: prestamo.saldo_capital,
    interes_liquidacion: prestamo.interes_liquidacion,
    monto_liquidacion: prestamo.monto_liquidacion,
    dias_desde_inicio: prestamo.dias_desde_inicio,
  });
  const [tablaDetalle, setTablaDetalle] = useState(null);
  const [cargandoTabla, setCargandoTabla] = useState(false);

  const monto = parseFloat(prestamo.monto_original);
  const totalPagado = parseFloat(prestamo.total_pagado || 0);
  const comision = parseFloat(prestamo.comision || 0);
  const cuota = parseFloat(prestamo.cuota);
  const abonoCuotaActual = parseFloat(prestamo.abono_cuota_actual || 0);
  const totalEsperado = prestamo.estado === 'pagado' ? totalPagado : parseFloat(prestamo.total_programado);
  const totalIntereses = prestamo.estado === 'pagado' ? totalEsperado - monto : parseFloat(prestamo.total_intereses_programados);
  const pctPagado = prestamo.estado === 'pagado' ? 100 : (totalEsperado > 0 ? Math.min(100, (totalPagado / totalEsperado) * 100) : 0);
  const saldoProgramado = prestamo.estado === 'pagado' ? 0 : parseFloat(prestamo.saldo_programado || 0);
  const estaActivo = prestamo.estado === 'activo';
  const tasaEA = calcEA(parseFloat(prestamo.tasa_mensual));
  const tasaNA = calcNA(parseFloat(prestamo.tasa_mensual));
  const proximaCuota = prestamo.proxima_cuota;
  const montoLiquidacion = parseFloat(prestamo.monto_liquidacion || 0);
  const interesLiquidacion = parseFloat(prestamo.interes_liquidacion || 0);
  const isLiquidacionAnticipada = estaActivo && montoLiquidacion > 0 && montoLiquidacion < saldoProgramado - 1;
  const montoPendienteHoy = isLiquidacionAnticipada ? montoLiquidacion : saldoProgramado;
  const isTotalRepayment = parseFloat(pagoForm.monto || 0) >= (montoLiquidacion - 100);
  const enMora = prestamo.en_mora;

  useEffect(() => {
    if (!showPagoForm) return;
    const fecha = pagoForm.fecha || new Date().toISOString().slice(0, 10);
    const hoy = new Date().toISOString().slice(0, 10);
    if (fecha === hoy) {
      setLiquidacion({ saldo_capital: prestamo.saldo_capital, interes_liquidacion: prestamo.interes_liquidacion, monto_liquidacion: prestamo.monto_liquidacion, dias_desde_inicio: prestamo.dias_desde_inicio });
      return;
    }
    let cancelado = false;
    fetch(`${API_URL}?action=liquidacion&id=${prestamo.id}&fecha=${fecha}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && !cancelado) setLiquidacion(data); })
      .catch(() => { });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoForm.fecha, showPagoForm, prestamo.id]);

  useEffect(() => {
    if (!expanded || tablaDetalle) return;
    let cancelado = false;
    setCargandoTabla(true);
    fetch(`${API_URL}?action=tabla&id=${prestamo.id}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && !cancelado) setTablaDetalle(data); })
      .catch(() => { })
      .finally(() => { if (!cancelado) setCargandoTabla(false); });
    return () => { cancelado = true; };
  }, [expanded, tablaDetalle, prestamo.id]);

  async function handlePago(e) {
    e.preventDefault();
    if (!pagoForm.monto) return alert('Monto obligatorio');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}?action=pago`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestamo_id: prestamo.id, monto: parseFloat(pagoForm.monto), fecha: pagoForm.fecha, notas: pagoForm.notas, registrar_en_cuenta: pagoForm.registrar_en_cuenta }),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error); }
      setShowPagoForm(false);
      setPagoForm({ monto: '', fecha: new Date().toISOString().slice(0, 10), notas: '', registrar_en_cuenta: true });
      onPagoAdded();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  }

  // Borde de la card según estado
  const cardBorder = prestamo.estado === 'pagado'
    ? '1px solid rgba(34,197,94,0.2)'
    : enMora
      ? '1px solid rgba(239,68,68,0.4)'
      : 'var(--color-bw-border)';

  return (
    <div style={{ background: 'var(--color-bw-surface)', border: cardBorder, overflow: 'hidden' }}>
      <div className="p-4">
        {/* Cabecera de la card */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate" style={{ color: 'var(--color-bw-white)' }}>{prestamo.prestatario}</h4>
              {enMora && (
                <span className="px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 animate-pulse text-red-400"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertTriangle size={9} /> En Mora
                </span>
              )}
              <span className={`px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 ${prestamo.estado === 'pagado' ? 'text-green-400' : enMora ? 'text-red-500' : 'text-violet-400'
                }`} style={{
                  background: prestamo.estado === 'pagado' ? 'rgba(34,197,94,0.08)' : enMora ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.1)',
                  border: prestamo.estado === 'pagado' ? '1px solid rgba(34,197,94,0.2)' : enMora ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(139,92,246,0.25)',
                }}>
                {prestamo.estado === 'pagado' ? <><Check size={9} /> Pagado</> : 'Activo'}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>
              {fmt(monto)} · {parseFloat(prestamo.tasa_mensual) > 0 ? `${fmtPct(prestamo.tasa_mensual)}/mes (${tasaEA}% E.A.)` : 'Sin interés'}{comision > 0 ? ` + ${fmt(comision)} comisión` : ''} · {prestamo.num_cuotas} cuotas · desde {prestamo.fecha_inicio}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-bw-muted)' }}>
              Equivalencia: {tasaEA}% E.A. compuesta · {tasaNA}% N.A.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold" style={{ color: 'var(--color-bw-white)' }}>
              {abonoCuotaActual > 0 && estaActivo ? fmt(cuota - abonoCuotaActual) : fmt(cuota)}
              <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-bw-muted)' }}>/mes</span>
            </p>
            {abonoCuotaActual > 0 && estaActivo && (
              <p className="text-[10px] text-emerald-500 font-medium -mt-1">{fmt(abonoCuotaActual)} ya abonados</p>
            )}
            {estaActivo && proximaCuota && (
              <p className={`text-xs font-medium flex items-center gap-1 justify-end ${enMora ? 'text-red-400' : 'text-gray-500'}`}>
                {enMora ? <><AlertCircle size={10} /> Vencida:</> : 'Próxima:'} {proximaCuota.fecha_vencimiento}
                {enMora && <span className="ml-1 text-red-600">(+{DIAS_GRACIA}d gracia)</span>}
              </p>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>
            <span className="text-emerald-400">{fmt(totalPagado)} recibido</span>
            <span>{fmt(montoPendienteHoy)} pendiente</span>
          </div>
          <div className="h-1.5 overflow-hidden" style={{ background: 'var(--color-bw-raised)' }}>
            <div className="h-full transition-all" style={{ width: `${pctPagado}%`, background: 'linear-gradient(to right, #7c3aed, #10b981)' }} />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>
            <span>{pctPagado.toFixed(1)}% cobrado</span>
            <span>Total: {fmt(totalEsperado)} (Intereses: {fmt(totalIntereses)})</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {estaActivo && (
            <button onClick={() => { setPagoForm({ ...pagoForm, monto: montoLiquidacion.toFixed(2), notas: 'Liquidación total del préstamo' }); setShowPagoForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-violet-400 text-xs transition-colors"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 0 }}>
              Liquidar (Pago Total)
            </button>
          )}
          {/*  NUEVO BOTÓN DE REFINANCIACIÓN */}
          {estaActivo && (
            <button
              onClick={() => {
                if (typeof onRefinanciar === 'function') onRefinanciar(prestamo);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-amber-400 text-xs transition-colors"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 0 }}>
              <HandCoins size={11} /> Refinanciar
            </button>
          )}
          {estaActivo && (
            <button onClick={() => setShowPagoForm(!showPagoForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-400 text-xs transition-colors"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 0 }}>
              <Check size={11} /> Registrar Pago
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors"
            style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', borderRadius: 0, color: 'var(--color-bw-secondary)' }}>
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            Tabla de Amortización
          </button>
          <button onClick={() => onEdit(prestamo)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ml-auto"
            style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', borderRadius: 0, color: 'var(--color-bw-muted)' }}>
            <Pencil size={11} />
          </button>
          <button onClick={() => { if (confirm('¿Eliminar préstamo y todos sus pagos?')) onDeleted(prestamo.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors hover:text-red-400"
            style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', borderRadius: 0, color: 'var(--color-bw-muted)' }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Formulario de pago */}
      {showPagoForm && (
        <div className="px-4 pb-4 pt-4" style={{ borderTop: '1px solid var(--color-bw-border)', background: 'rgba(16,185,129,0.03)' }}>
          <form onSubmit={handlePago}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-emerald-400">Registrar Pago Recibido</p>
              {isTotalRepayment && (
                <span className="text-[10px] font-bold text-black px-2 py-0.5 uppercase" style={{ background: '#10b981' }}>
                  Pago total / Liquidación
                </span>
              )}
            </div>

            {/* Info liquidación */}
            <div className="mb-3 px-3 py-2 text-xs" style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.05)' }}>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: 'var(--color-bw-muted)' }}>Liquidar al {pagoForm.fecha || new Date().toISOString().slice(0, 10)}</span>
                <span className="font-semibold text-violet-300">{fmt(montoLiquidacion)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-1 text-[11px]" style={{ color: 'var(--color-bw-muted)' }}>
                <span>Capital pendiente: {fmt(liquidacion.saldo_capital)}</span>
                <span>Interés + comisión: {fmt(liquidacion.interes_liquidacion)}</span>
              </div>
              {isLiquidacionAnticipada && (
                <p className="mt-1 text-[11px] text-emerald-400">El monto pendiente se calcula como liquidación anticipada, por eso es menor que la deuda programada.</p>
              )}
              {liquidacion.dias_desde_inicio < DIAS_SIN_INTERES && (
                <p className="mt-1 text-[11px] text-emerald-400">Si se devuelve antes de {DIAS_SIN_INTERES} días, no se cobra interés prorrogado.</p>
              )}
              {parseInt(prestamo.num_cuotas) === 1 && liquidacion.dias_desde_inicio >= DIAS_SIN_INTERES && (
                <p className="mt-1 text-[11px] text-cyan-400">En préstamos a 1 cuota, la liquidación prorratea la tasa por días.</p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="space-y-1 sm:col-span-1">
                <label style={S.label}>Monto</label>
                <input type="number" step="0.01" autoFocus value={pagoForm.monto}
                  onChange={e => setPagoForm({ ...pagoForm, monto: e.target.value })}
                  placeholder={fmt(cuota)} style={S.input} />
              </div>
              <div className="space-y-1">
                <label style={S.label}>Fecha</label>
                <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })} style={S.input} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label style={S.label}>Notas</label>
                <input value={pagoForm.notas} onChange={e => setPagoForm({ ...pagoForm, notas: e.target.value })} placeholder="Cuota #, transferencia, etc." style={S.input} />
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pagoForm.registrar_en_cuenta} onChange={e => setPagoForm({ ...pagoForm, registrar_en_cuenta: e.target.checked })} className="accent-cyan-500 w-3.5 h-3.5" />
                <span className="text-xs text-cyan-400">Registrar en Cuenta Bancaria</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-4 py-1.5 text-white text-xs disabled:opacity-50 transition-colors"
                  style={{ background: '#059669', borderRadius: 0 }}>
                  {saving ? '...' : 'Guardar Pago'}
                </button>
                <button type="button" onClick={() => setShowPagoForm(false)} className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de amortización */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-bw-border)' }}>
          {cargandoTabla || !tablaDetalle ? (
            <div className="text-center py-6 text-xs" style={{ color: 'var(--color-bw-muted)' }}>Cargando tabla de amortización...</div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead style={{ background: 'var(--color-bw-raised)', position: 'sticky', top: 0 }}>
                  <tr>
                    {['#', 'Fecha', 'Cuota', 'Capital', 'Interés', 'Pendiente', 'Saldo'].map((h, i) => (
                      <th key={h} className={`py-2 px-3 font-medium ${i >= 2 ? 'text-right' : 'text-left'}`}
                        style={{ color: i === 5 ? '#34d399' : 'var(--color-bw-muted)', letterSpacing: 'var(--tracking-bw-wide)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablaDetalle.tabla.map((c, i) => {
                    const cuotasPagadas = tablaDetalle.cuotas_pagadas;
                    const pagada = prestamo.estado === 'pagado' || i < cuotasPagadas;
                    const parcial = prestamo.estado !== 'pagado' && i === cuotasPagadas;
                    return (
                      <tr key={i}
                        style={{
                          opacity: pagada ? 0.4 : 1,
                          background: parcial ? 'rgba(139,92,246,0.06)' : 'transparent',
                          borderBottom: '1px solid var(--color-bw-border)',
                        }}>
                        <td className="py-2 px-3" style={{ color: 'var(--color-bw-muted)' }}>
                          {pagada ? <span className="text-green-600"><Check size={11} /></span> : c.cuota_num}
                        </td>
                        <td className="py-2 px-3" style={{ color: 'var(--color-bw-secondary)' }}>{c.fecha_vencimiento}</td>
                        <td className="py-2 px-3 text-right" style={{ color: 'var(--color-bw-white)' }}>{fmt(c.cuota_total)}</td>
                        <td className="py-2 px-3 text-right text-blue-400">{fmt(c.capital)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">{fmt(c.interes)}</td>
                        <td className="py-2 px-3 text-right font-medium" style={{ color: 'var(--color-bw-white)' }}>
                          {pagada ? fmt(0) : parcial ? fmt(c.cuota_total - tablaDetalle.abono_cuota_actual) : fmt(c.cuota_total)}
                        </td>
                        <td className="py-2 px-3 text-right" style={{ color: 'var(--color-bw-secondary)' }}>{fmt(c.saldo_restante)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PrestamosSection() {
  const [prestamos, setPrestamos] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrestamo, setEditingPrestamo] = useState(null);
  const [refinanciandoPrestamo, setRefinanciandoPrestamo] = useState(null);


  const fetchAll = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(API_URL, { credentials: 'include' }),
        fetch(`${API_URL}?action=metrics`, { credentials: 'include' }),
      ]);
      if (pRes.ok) setPrestamos(await pRes.json());
      if (mRes.ok) setMetrics(await mRes.json());
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleDelete(id) {
    await fetch(API_URL, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await fetchAll();
  }

  async function handleSaveEdit(updatedData) {
    const res = await fetch(API_URL, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
    if (!res.ok) { const error = await res.json(); throw new Error(error.error); }
    await fetchAll();
  }

  return (
    <div className="mb-8">
      {editingPrestamo && (
        <EditPrestamoModal prestamo={editingPrestamo} onClose={() => setEditingPrestamo(null)} onSave={handleSaveEdit} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <HandCoins size={14} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>Préstamos</h2>
            <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Capital prestado con sistema de amortización francesa</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-violet-400 text-xs transition-colors"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 0 }}>
          <PlusCircle size={13} /> Nuevo Préstamo
        </button>
      </div>

      {showForm && <NuevoPrestamoForm onSaved={() => { setShowForm(false); fetchAll(); }} onCancel={() => setShowForm(false)} />}

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-4" style={S.card}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Capital en Calle</p>
            <p className="text-xl font-bold text-violet-400">{fmt(metrics.capital_en_calle)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Pendiente</p>
          </div>
          <div className="p-4" style={S.card}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Recuperado</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-bw-white)' }}>{fmt(metrics.total_recuperado)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Total cobrado</p>
          </div>
          <div className="p-4" style={S.card}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Intereses</p>
            <p className="text-xl font-bold text-emerald-400">{fmt(metrics.total_interes_recibido)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>Ganancia neta</p>
          </div>
          <div className="p-4" style={S.card}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-bw-muted)' }}>Activos</p>
            <p className="text-xl font-bold" style={{ color: 'var(--color-bw-white)' }}>{metrics.num_prestamos_activos}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>En seguimiento</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--color-bw-muted)' }}>Cargando préstamos...</div>
      ) : prestamos.length === 0 && !showForm ? (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--color-bw-muted)', border: '1px dashed var(--color-bw-border)' }}>
          Sin préstamos registrados. Crea el primero con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {prestamos.filter(p => p.estado !== 'pagado').map(p => (
              <PrestamoCard key={p.id} prestamo={p} onPagoAdded={fetchAll} onDeleted={handleDelete} onEdit={setEditingPrestamo} onRefinanciar={setRefinanciandoPrestamo} />
            ))}
          </div>

          {prestamos.some(p => p.estado === 'pagado') && (
            <details className="group overflow-hidden" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }}>
              <summary className="p-4 cursor-pointer text-sm font-medium transition-colors flex items-center justify-between outline-none"
                style={{ color: 'var(--color-bw-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}
              >
                <span className="flex items-center gap-2">
                  <Check size={15} className="text-emerald-500" />
                  Préstamos Completados ({prestamos.filter(p => p.estado === 'pagado').length})
                </span>
                <ChevronDown size={15} className="group-open:rotate-180 transition-transform" />
              </summary>
              <div className="p-4 pt-0 space-y-3 mt-2" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                {prestamos.filter(p => p.estado === 'pagado').map(p => (
                  <PrestamoCard key={p.id} prestamo={p} onPagoAdded={fetchAll} onDeleted={handleDelete} onEdit={setEditingPrestamo} onRefinanciar={setRefinanciandoPrestamo} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {/* Modal de Refinanciación */}
      {refinanciandoPrestamo && (
        <RefinanciarModal
          prestamo={refinanciandoPrestamo}
          onClose={() => setRefinanciandoPrestamo(null)}
          onSuccess={(data) => {
            console.log('Refinanciación exitosa:', data);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}