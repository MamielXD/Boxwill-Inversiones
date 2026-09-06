import React, { useCallback, useEffect, useState } from 'react';
import { Boxes, Plus, RefreshCw, Trash2, Wrench, Package, X, History } from 'lucide-react';
import Accordion from './Accordion';

const API_URL = import.meta.env.PUBLIC_API_URL + '/herramientas.php';
const today = () => new Date().toISOString().slice(0, 10);
const fmt = n => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Mismo umbral que usa el backend para "por agotarse" (<20%): rojo. Entre 20-50%: amarillo. Resto: verde.
const stockColor = pct => pct === null ? 'var(--color-bw-muted)' : pct < 20 ? '#ef4444' : pct < 50 ? '#eab308' : '#22c55e';
const S = {
  card: { background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' },
  input: { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-white)', borderRadius: 0, width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.75rem' },
  label: { color: 'var(--color-bw-muted)', fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem' },
};

const StockBar = ({ item }) => {
  if (item.tipo === 'herramienta') return <span style={{ color: 'var(--color-bw-muted)' }}>—</span>;
  const pct = item.porcentaje_restante;
  const color = stockColor(pct);
  return (
    <div className="flex flex-col items-end gap-1">
      <span style={{ color: 'var(--color-bw-secondary)' }}>{item.cantidad_restante} / {item.cantidad_total} {item.unidad_medida}</span>
      <div style={{ width: '5.5rem', height: 3, background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
};

export default function HerramientasSection() {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reponerId, setReponerId] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [usos, setUsos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tipo: 'consumible', nombre: '', costo_compra: '', fecha_compra: today(), unidad_medida: 'unidades', cantidad_total: '', notas: '', registrar_en_cuenta: true });
  const [reposicion, setReposicion] = useState({ cantidad_agregada: '', costo_compra: '', fecha: today(), registrar_en_cuenta: true });

  const fetchAll = useCallback(async () => {
    try {
      const [itemsRes, metricsRes] = await Promise.all([
        fetch(API_URL, { credentials: 'include' }),
        fetch(`${API_URL}?action=metrics`, { credentials: 'include' }),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (e) { console.error('Error al cargar herramientas:', e); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function request(url, method, body) {
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'No se pudo guardar'); }
    return res.json();
  }

  async function addItem(e) {
    e.preventDefault(); setSaving(true);
    try {
      await request(API_URL, 'POST', {
        ...form,
        costo_compra: Number(form.costo_compra),
        cantidad_total: ['consumible', 'repuesto'].includes(form.tipo) ? Number(form.cantidad_total) : undefined,
      });
      setFormOpen(false);
      setForm({ tipo: 'consumible', nombre: '', costo_compra: '', fecha_compra: today(), unidad_medida: 'unidades', cantidad_total: '', notas: '', registrar_en_cuenta: true });
      fetchAll();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function reponer(e) {
    e.preventDefault(); setSaving(true);
    try {
      await request(`${API_URL}?action=reponer`, 'POST', { id: reponerId, ...reposicion, cantidad_agregada: Number(reposicion.cantidad_agregada), costo_compra: Number(reposicion.costo_compra) });
      setReponerId(null); setReposicion({ cantidad_agregada: '', costo_compra: '', fecha: today(), registrar_en_cuenta: true }); fetchAll();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  }

  async function remove(item) {
    if (!confirm(`¿Eliminar ${item.nombre}? Se conservarán los costos históricos de las reparaciones.`)) return;
    try { await request(API_URL, 'DELETE', { id: item.id }); fetchAll(); } catch (e) { alert(e.message); }
  }

  async function showHistory(item) {
    if (historyItem?.id === item.id) { setHistoryItem(null); setUsos([]); return; }
    try {
      const res = await fetch(`${API_URL}?action=usos&item_id=${item.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo cargar el historial');
      setHistoryItem(item); setUsos(await res.json());
    } catch (e) { alert(e.message); }
  }

  return <div className="mb-8">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3"><div className="w-7 h-7 flex items-center justify-center" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)' }}><Boxes size={15} style={{ color: 'var(--color-bw-secondary)' }} /></div><div><h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>Herramientas e Inventario</h2><p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Costos distribuidos por cada reparación</p></div></div>
      <button onClick={() => setFormOpen(!formOpen)} className="flex items-center gap-1.5 px-3 py-2 text-xs bw-btn-ghost"><Plus size={13} /> Registrar compra</button>
    </div>

    {formOpen && <form onSubmit={addItem} className="p-4 mb-4" style={S.card}>
      <div className="flex justify-between mb-3"><span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>Nueva compra</span><button type="button" onClick={() => setFormOpen(false)} style={{ color: 'var(--color-bw-muted)' }}><X size={15} /></button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div><label style={S.label}>Tipo</label><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={S.input}><option value="consumible">Consumible</option><option value="repuesto">Repuesto / pieza</option><option value="herramienta">Herramienta reutilizable</option></select></div>
        <div><label style={S.label}>Nombre</label><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={S.input} /></div>
        <div><label style={S.label}>Costo de compra</label><input required type="number" step="0.01" min="0.01" value={form.costo_compra} onChange={e => setForm({ ...form, costo_compra: e.target.value })} style={S.input} /></div>
        <div><label style={S.label}>Fecha</label><input type="date" value={form.fecha_compra} onChange={e => setForm({ ...form, fecha_compra: e.target.value })} style={S.input} /></div>
        {['consumible', 'repuesto'].includes(form.tipo) && <><div><label style={S.label}>Cantidad adquirida</label><input required type="number" min="0.0001" step="0.0001" value={form.cantidad_total} onChange={e => setForm({ ...form, cantidad_total: e.target.value })} style={S.input} /></div><div><label style={S.label}>Unidad de medida</label><input required value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })} placeholder="unidad, cable, módulo" style={S.input} /></div></>}
        <div><label style={S.label}>Notas</label><input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={S.input} /></div>
      </div>
      <div className="flex items-center gap-3 mt-3"><label className="text-xs flex gap-2" style={{ color: 'var(--color-bw-muted)' }}><input type="checkbox" checked={form.registrar_en_cuenta} onChange={e => setForm({ ...form, registrar_en_cuenta: e.target.checked })} /> {form.tipo === 'repuesto' ? 'Registrar retiro en Banco' : 'Registrar gasto operativo en Banco'}</label><button disabled={saving} className="px-4 py-2 text-xs bw-btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar compra'}</button></div>
    </form>}

    {reponerId && (() => {
      const itemParaReposicion = items.find(i => i.id === reponerId);
      const labelReponer = itemParaReposicion?.tipo === 'repuesto' ? 'Registrar retiro en Banco' : 'Registrar gasto operativo en Banco';
      return <form onSubmit={reponer} className="p-4 mb-4" style={{ ...S.card, borderColor: 'rgba(34,197,94,.3)' }}><p className="text-xs text-green-400 mb-3">Reposición de stock</p><div className="grid grid-cols-1 sm:grid-cols-4 gap-3"><input required type="number" min="0.0001" step="0.0001" placeholder="Cantidad agregada" value={reposicion.cantidad_agregada} onChange={e => setReposicion({ ...reposicion, cantidad_agregada: e.target.value })} style={S.input} /><input required type="number" step="0.01" min="0.01" placeholder="Costo de compra" value={reposicion.costo_compra} onChange={e => setReposicion({ ...reposicion, costo_compra: e.target.value })} style={S.input} /><input type="date" value={reposicion.fecha} onChange={e => setReposicion({ ...reposicion, fecha: e.target.value })} style={S.input} /><div className="flex gap-2"><button disabled={saving} className="px-3 text-xs text-white" style={{ background: '#059669' }}>Reponer</button><button type="button" onClick={() => setReponerId(null)} className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button></div></div><label className="text-xs flex gap-2 mt-3" style={{ color: 'var(--color-bw-muted)' }}><input type="checkbox" checked={reposicion.registrar_en_cuenta} onChange={e => setReposicion({ ...reposicion, registrar_en_cuenta: e.target.checked })} /> {labelReponer}</label></form>;
    })()}

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      {[['Herramientas activas', metrics?.herramientas_activas || 0], ['Valor en herramientas', fmt(metrics?.total_invertido_herramientas)], ['Valor en repuestos', fmt(metrics?.valor_repuestos)], ['Valor en consumibles', fmt(metrics?.valor_restante_consumibles)], ['Costo distribuido del mes', fmt(metrics?.costo_operativo_distribuido_mes)]].map(([label, value]) => <div key={label} className="p-3" style={S.card}><p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>{label}</p><p className="text-lg font-bold" style={{ color: 'var(--color-bw-white)' }}>{value}</p></div>)}
    </div>
    {metrics?.consumibles_por_agotarse?.length > 0 && <div className="text-xs p-3 mb-4 text-yellow-300" style={{ background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.2)' }}>Por agotarse: {metrics.consumibles_por_agotarse.map(i => `${i.nombre} (${i.cantidad_restante} ${i.unidad_medida})`).join(', ')}</div>}
    {
      (() => {
        const activos = items.filter(i => i.estado === 'activo');
        const otros = items.filter(i => i.estado !== 'activo');
        return (
          <>
            <div style={S.card} className="overflow-x-auto mb-3">
              <table className="min-w-full text-xs">
                <thead style={{ background: 'var(--color-bw-raised)', color: 'var(--color-bw-muted)' }}>
                  <tr><th className="text-left p-3">Item</th><th className="text-left p-3">Tipo</th><th className="text-right p-3">Disponible</th><th className="text-right p-3">Costo</th><th className="p-3">Acciones</th></tr>
                </thead>
                <tbody>
                  {activos.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                      <td className="p-3 font-medium" style={{ color: 'var(--color-bw-white)' }}>{item.nombre}<span className="block text-[10px]" style={{ color: item.estado === 'activo' ? 'var(--color-bw-muted)' : '#f87171' }}>{item.estado}</span></td>
                      <td className="p-3">{item.tipo === 'herramienta' ? <span className="flex gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Wrench size={12} /> Herramienta</span> : <span className="flex gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Package size={12} /> {item.tipo === 'repuesto' ? 'Repuesto' : 'Consumible'}</span>}</td>
                      <td className="p-3 text-right"><StockBar item={item} /></td>
                      <td className="p-3 text-right">{fmt(item.costo_compra)}</td>
                      <td className="p-3"><div className="flex justify-center gap-3"><button onClick={() => showHistory(item)} title="Historial de usos" className="text-cyan-400"><History size={13} /></button>{item.tipo !== 'herramienta' && <button onClick={() => setReponerId(item.id)} title="Reponer" className="text-green-400"><RefreshCw size={13} /></button>}<button onClick={() => remove(item)} title="Eliminar" className="text-red-400"><Trash2 size={13} /></button></div></td>
                    </tr>
                  ))}
                  {activos.length === 0 && <tr><td colSpan="5" className="text-center p-6" style={{ color: 'var(--color-bw-muted)' }}>Aún no hay herramientas, consumibles o repuestos registrados.</td></tr>}
                </tbody>
              </table>
            </div>
            {otros.length > 0 ? (
              <Accordion title={`Agotados / Otros (${otros.length})`} defaultOpen={false}>
                <div style={S.card} className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead style={{ background: 'var(--color-bw-raised)', color: 'var(--color-bw-muted)' }}>
                      <tr>
                        <th className="text-left p-3">Item</th>
                        <th className="text-left p-3">Tipo</th>
                        <th className="text-right p-3">Disponible</th>
                        <th className="text-right p-3">Costo</th>
                        <th className="p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otros.map(item => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                          <td className="p-3 font-medium" style={{ color: 'var(--color-bw-white)' }}>
                            {item.nombre}
                            <span className="block text-[10px]" style={{ color: item.estado === 'activo' ? 'var(--color-bw-muted)' : '#f87171' }}>{item.estado}</span>
                          </td>
                          <td className="p-3">
                            {item.tipo === 'herramienta' ? (
                              <span className="flex gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Wrench size={12} /> Herramienta</span>
                            ) : (
                              <span className="flex gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Package size={12} /> {item.tipo === 'repuesto' ? 'Repuesto' : 'Consumible'}</span>
                            )}
                          </td>
                          <td className="p-3 text-right"><StockBar item={item} /></td>
                          <td className="p-3 text-right">{fmt(item.costo_compra)}</td>
                          <td className="p-3">
                            <div className="flex justify-center gap-3">
                              <button onClick={() => showHistory(item)} title="Historial de usos" className="text-cyan-400"><History size={13} /></button>
                              {item.tipo !== 'herramienta' && <button onClick={() => setReponerId(item.id)} title="Reponer" className="text-green-400"><RefreshCw size={13} /></button>}
                              <button onClick={() => remove(item)} title="Eliminar" className="text-red-400"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Accordion>
            ) : null}
          </>
        );
      })()
    }
    {historyItem && <div className="mt-3 p-4" style={S.card}><p className="text-xs font-medium mb-2" style={{ color: 'var(--color-bw-secondary)' }}>Historial de uso: {historyItem.nombre}</p>{usos.length ? <div className="space-y-1">{usos.map(uso => <div key={uso.id} className="flex justify-between text-xs p-2" style={{ background: 'var(--color-bw-raised)' }}><span>{uso.fecha} · {uso.inversion_nombre || 'Sin inversión'}</span><span style={{ color: 'var(--color-bw-white)' }}>{uso.cantidad_usada ? `${uso.cantidad_usada} ${historyItem.unidad_medida} · ` : ''}{fmt(uso.costo_calculado)}</span></div>)}</div> : <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Aún no tiene usos registrados.</p>}</div>}
  </div>;
}