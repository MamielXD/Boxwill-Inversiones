import React, { useEffect, useState } from 'react';
import { X, Boxes, Plus, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.PUBLIC_API_URL + '/inversiones.php';
const today = new Date().toISOString().slice(0, 10);
const fmt = n => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const input = { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-white)', padding: '0.45rem 0.55rem', width: '100%', borderRadius: 0, fontSize: '0.75rem' };

export default function DespieceModal({ row, onClose, onSaved }) {
  const [componentes, setComponentes] = useState([]);
  const [autoRellenar, setAutoRellenar] = useState(false);
  const [nombreResto, setNombreResto] = useState('Resto (auto)');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [priceModal, setPriceModal] = useState({ visible: false, componente: null, precioBruto: '', comision: '', fecha: today, esPrincipal: false });
  const costoTotal = Number(row?.monto || 0) + Number(row?.costo_operativo || 0) + Number(row?.total_gastos_detallados || 0);
  const asignado = componentes.reduce((sum, c) => sum + Number(c.costo_asignado || 0), 0);
  const falta = Math.round((costoTotal - asignado) * 100) / 100;
  const asignadoVisual = autoRellenar ? asignado + (falta > 0 ? falta : 0) : asignado;

  async function load() {
    if (!Number(row?.despiece)) {
      setComponentes([{ nombre: '', cantidad: 1, costo_asignado: '', valor_estimado: '' }, { nombre: '', cantidad: 1, costo_asignado: '', valor_estimado: '' }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=componentes&inversion_id=${row.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComponentes(Array.isArray(data) ? data.map(x => ({ ...x, cantidad: x.cantidad ? Number(x.cantidad) : 1 })) : []);
    } catch (e) {
      setErrorMessage('No se pudieron cargar las piezas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [row?.id]);

  const change = (i, key, value) => setComponentes(prev => prev.map((c, n) => n === i ? { ...c, [key]: value } : c));

  async function call(action, data) {
    const res = await fetch(API_URL, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'No se pudo guardar'); }
  }

  async function crear() {
    const suma = componentes.reduce((s, c) => s + (Number(c.costo_asignado) || 0), 0);
    if (!autoRellenar) {
      if (Math.abs(suma - costoTotal) > 0.01) { setErrorMessage(`Debes asignar exactamente ${fmt(costoTotal)} entre las piezas.`); return; }
    } else {
      if (suma - costoTotal > 0.01) { setErrorMessage(`Has asignado más de ${fmt(costoTotal)}. Ajusta los montos.`); return; }
    }

    let componentesFinales = componentes.map(c => ({ ...c, costo_asignado: Number(c.costo_asignado) || 0, cantidad: c.cantidad ? Number(c.cantidad) : 1, valor_estimado: c.valor_estimado ? Number(c.valor_estimado) : null }));
    if (autoRellenar) {
      const sumaFinal = componentesFinales.reduce((s, c) => s + (Number(c.costo_asignado) || 0), 0);
      const falta = Math.round((costoTotal - sumaFinal) * 100) / 100;
      if (falta > 0.009) {
        componentesFinales.push({ nombre: nombreResto || 'Resto (auto)', cantidad: 1, costo_asignado: falta, valor_estimado: null });
      }
    }

    setSaving(true);
    try {
      await call('crear_despiece', { inversion_id: row.id, componentes: componentesFinales });
      await onSaved();
      onClose();
    } catch (e) { setErrorMessage(e.message); } finally { setSaving(false); }
  }

  async function resolver(c, estado) {
    if (estado === 'vendido') {
      setPriceModal({ visible: true, componente: c, precioBruto: c.valor_estimado || '', comision: '', fecha: today, esPrincipal: false });
      return;
    }
    setSaving(true);
    try {
      await call('resolver_componente', { componente_id: c.id, estado, precio_venta: null, fecha: today, registrar_en_cuenta: false });
      await onSaved();
      await load();
    } catch (e) { setErrorMessage(e.message); } finally { setSaving(false); }
  }

  async function confirmPriceAndResolve() {
    const { componente: c, precioBruto, comision, fecha, esPrincipal } = priceModal;
    if (precioBruto === null || precioBruto === '' || Number(precioBruto) < 0) { setErrorMessage('Precio inválido'); return; }
    
    setSaving(true);
    try {
      await call('resolver_componente', { 
        componente_id: c.id, 
        estado: 'vendido', 
        precio_venta: Number(precioBruto), 
        fecha: fecha || today, 
        registrar_en_cuenta: true,
        es_principal: esPrincipal,
        comision: Number(comision) || 0
      });

      if (Number(comision) > 0) {
        await call('add_gasto', {
          inversion_id: row.id,
          monto: Number(comision),
          concepto: `Comisión/Gastos de venta (${c.nombre})`,
          fecha: fecha || today,
          registrar_en_cuenta: true
        });
      }

      setPriceModal({ visible: false, componente: null, precioBruto: '', comision: '', fecha: today, esPrincipal: false });
      await onSaved();
      await load();
    } catch (e) { setErrorMessage(e.message); } finally { setSaving(false); }
  }

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.85)' }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)' }}>
        <div className="flex justify-between gap-3 mb-2">
          <div className="flex gap-2">
            <Boxes className="text-orange-400" size={19} />
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--color-bw-white)' }}>Despiece: {row.nombre}</h3>
              <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>El lote solo se completa cuando todas las piezas estén resueltas.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-bw-muted)' }}><X /></button>
        </div>
        {errorMessage ? <div className="p-2 mb-3 text-sm" style={{ background: '#3b0a0a', color: 'white' }}>{errorMessage} <button onClick={() => setErrorMessage(null)} style={{ marginLeft: 8, color: '#ffdede' }}>Cerrar</button></div> : null}

        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--color-bw-muted)' }}>Cargando...</p>
        ) : !Number(row.despiece) ? (
          <>
            <div className="p-3 my-4 text-xs" style={{ background: 'var(--color-bw-raised)', color: 'var(--color-bw-secondary)' }}>Costo total a distribuir: <b>{fmt(costoTotal)}</b>. Asígnalo usando el valor de venta probable de cada pieza.</div>
            <div className="flex items-center gap-4 mb-2">
              <label className="text-xs flex items-center gap-2" style={{ color: 'var(--color-bw-muted)' }}>
                <input type="checkbox" checked={autoRellenar} onChange={e => setAutoRellenar(e.target.checked)} /> Asignar resto automáticamente
              </label>
              <span className="text-xs text-yellow-400">Restante: {fmt(falta)}</span>
              {autoRellenar ? <input className="text-xs" placeholder="Nombre para el resto" value={nombreResto} onChange={e => setNombreResto(e.target.value)} style={{ ...input, width: 220 }} /> : null}
            </div>
            <div className="space-y-2">
              {componentes.map((c, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                  <input placeholder="Pieza (ej: RAM 16 GB)" value={c.nombre} onChange={e => change(i, 'nombre', e.target.value)} style={input} />
                  <input type="number" min="1" step="1" placeholder="Cantidad" value={c.cantidad} onChange={e => change(i, 'cantidad', e.target.value)} style={input} />
                  <input type="number" placeholder="Costo asignado" value={c.costo_asignado} onChange={e => change(i, 'costo_asignado', e.target.value)} style={input} />
                  <input type="number" placeholder="Venta probable (opcional)" value={c.valor_estimado} onChange={e => change(i, 'valor_estimado', e.target.value)} style={input} />
                  <div className="flex items-center">
                    <button type="button" onClick={() => setComponentes(prev => prev.filter((_, n) => n !== i))} className="text-xs text-red-400 flex items-center justify-center" style={{ padding: '0.25rem' }} title="Eliminar pieza">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3">
              <button onClick={() => setComponentes([...componentes, { nombre: '', cantidad: 1, costo_asignado: '', valor_estimado: '' }])} className="text-xs text-cyan-400 flex gap-1"><Plus size={13} /> Añadir pieza</button>
              <span className={`text-xs ${(Math.abs(asignadoVisual - costoTotal) < .01 || (autoRellenar && asignado <= costoTotal)) ? 'text-green-400' : 'text-yellow-400'}`}>Asignado: {fmt(asignadoVisual)} / {fmt(costoTotal)}</span>
            </div>
            <button disabled={saving} onClick={crear} className="mt-4 px-4 py-2 text-xs text-white disabled:opacity-50" style={{ background: '#ea580c' }}>Confirmar despiece</button>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            {componentes.map(c => (
              <div key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                <div className="w-full">
                {priceModal.visible && priceModal.componente?.id === c.id ? (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.75)' }}>
                      <div style={{ width: 420, background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)', padding: 20, borderRadius: 6 }}>
                        <div className="mb-4 font-bold" style={{ color: 'var(--color-bw-white)' }}>Vender: {priceModal.componente?.nombre}</div>

                        <div className="space-y-3 mb-5">
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Precio Bruto de Venta*</label>
                            <input type="number" autoFocus value={priceModal.precioBruto} onChange={e => setPriceModal(p => ({ ...p, precioBruto: e.target.value }))} style={input} placeholder="Lo que pagó el cliente" />
                          </div>

                          <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Comisión / Gastos de Venta</label>
                            <input type="number" value={priceModal.comision} onChange={e => setPriceModal(p => ({ ...p, comision: e.target.value }))} style={input} placeholder="Ej: 15000 (Opcional)" />
                          </div>

                          <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-bw-muted)' }}>Fecha de Venta</label>
                            <input type="date" value={priceModal.fecha} onChange={e => setPriceModal(p => ({ ...p, fecha: e.target.value }))} style={input} />
                          </div>

                          <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer select-none" style={{ color: 'var(--color-bw-white)' }}>
                            <input type="checkbox" checked={priceModal.esPrincipal} onChange={e => setPriceModal(p => ({ ...p, esPrincipal: e.target.checked }))} />
                            Es la venta principal (Oculta texto "Venta por despiece")
                          </label>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button onClick={() => setPriceModal({ visible: false, componente: null, precioBruto: '', comision: '', fecha: today, esPrincipal: false })} className="px-4 py-2 text-xs" style={{ background: '#374151', color: 'white', borderRadius: 4 }}>Cancelar</button>
                          <button onClick={confirmPriceAndResolve} className="px-4 py-2 text-xs font-bold" style={{ background: '#059669', color: 'white', borderRadius: 4 }}>Confirmar Venta</button>
                        </div>
                      </div>
                  </div>
                ) : null}
                  <div className="flex items-center gap-3">
                    <b className="text-sm" style={{ color: 'var(--color-bw-white)' }}>{c.nombre}</b>
                    <span className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>x {c.cantidad ?? 1}</span>
                    <span className="text-xs font-medium" style={{ color: c.estado === 'pendiente' ? 'var(--color-bw-muted)' : (c.estado === 'vendido' ? '#059669' : '#0ea5e9') }}> {c.estado}</span>
                    {c.inventario_item_id ? <span className="text-xs" style={{ color: '#f59e0b' }}> · En inventario</span> : null}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>Costo asignado: {fmt(c.costo_asignado)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.estado === 'pendiente' ? <><button onClick={() => resolver(c, 'vendido')} className="text-xs px-3 py-1.5 font-medium" style={{ background: '#059669', color: 'white', borderRadius: 4 }}>Vender</button>
                  <button onClick={() => resolver(c, 'retenido')} className="text-xs px-3 py-1.5 font-medium" style={{ background: '#0ea5e9', color: 'white', borderRadius: 4 }}>Retener</button></> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}