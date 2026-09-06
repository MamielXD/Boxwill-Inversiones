import React, { useEffect, useState } from 'react';
import MetricsCards from './MetricsCards';
import DistributionChart from './DistributionChart';
import EvolutionChart from './EvolutionChart';
import EditModal from './EditModal';
import BrandLabSection from './BrandLabSection';
import CuentaBancariaSection from './CuentaBancariaSection';
import PrestamosSection from './PrestamosSection';
import HerramientasSection from './HerramientasSection';
import Accordion from './Accordion';
import PanelSettings from './PanelSettings';
import DespieceModal from './DespieceModal';
import { Edit2, Trash2, AlertTriangle, Info, DollarSign, PlusCircle, Wrench, Boxes, ChevronUp, ChevronDown, Layers, BarChart2, TrendingUp, TrendingDown, X } from 'lucide-react';

const API_URL = import.meta.env.PUBLIC_API_URL + '/inversiones.php';
const CUENTA_API = import.meta.env.PUBLIC_API_URL + '/cuenta.php';
const PRESTAMOS_API = import.meta.env.PUBLIC_API_URL + '/prestamos.php';
const HERRAMIENTAS_API = import.meta.env.PUBLIC_API_URL + '/herramientas.php';

export const CATEGORIAS = [
  'Tecnología', 'Electrónica', 'Ropa y Accesorios', 'Equity / Empresas',
  'Acciones en Bolsa', 'Bienes Raíces', 'Vehículos', 'Servicios', 'Otro', 'Sin categoría',
];

// Estilos reutilizables del panel
const S = {
  input: {
    background: 'var(--color-bw-raised)',
    border: '1px solid var(--color-bw-border-strong)',
    color: 'var(--color-bw-white)',
    borderRadius: 0,
    padding: '0.625rem 0.75rem',
    width: '100%',
  },
  card: {
    background: 'var(--color-bw-surface)',
    border: '1px solid var(--color-bw-border)',
  },
  sectionDivider: {
    borderTop: '1px solid var(--color-bw-border)',
  },
};

function useInversiones() {
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchInversiones() {
    try {
      setLoading(true);
      const res = await fetch(API_URL, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar inversiones');
      const data = await res.json();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(`${API_URL}?metrics=true`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar métricas');
      setMetrics(await res.json());
    } catch (err) {
      console.error('Error al cargar métricas:', err);
    }
  }

  async function addInversion(inversion) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inversion)
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al agregar'); }
      await fetchInversiones(); await fetchMetrics();
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async function updateInversion(id, data) {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      if (!res.ok) throw new Error('Error al actualizar');
      await fetchInversiones(); await fetchMetrics();
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  async function deleteInversion(id) {
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Error al eliminar');
      await fetchInversiones(); await fetchMetrics();
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }

  useEffect(() => { fetchInversiones(); fetchMetrics(); }, []);

  return { rows, metrics, loading, error, addInversion, updateInversion, deleteInversion, fetchInversiones, fetchMetrics };
}

function useInventarioItems() {
  const [items, setItems] = useState([]);

  async function fetchItems() {
    try {
      const res = await fetch(HERRAMIENTAS_API, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.filter(i => i.estado === 'activo'));
    } catch (e) { console.error('Error al cargar inventario:', e); }
  }

  useEffect(() => { fetchItems(); }, []);
  return { items, fetchItems };
}

function usePatrimonioData() {
  const [data, setData] = useState({ saldoBanco: 0, totalEsperado: 0, capitalEnCalle: 0, totalInteresRecibido: 0, totalPrestado: 0 });

  async function fetchPatrimonio() {
    try {
      const [cuentaRes, prestamosRes] = await Promise.all([
        fetch(`${CUENTA_API}?action=metrics`, { credentials: 'include' }),
        fetch(`${PRESTAMOS_API}?action=metrics`, { credentials: 'include' }),
      ]);
      const cuentaData = cuentaRes.ok ? await cuentaRes.json() : {};
      const prestamosData = prestamosRes.ok ? await prestamosRes.json() : {};
      setData({
        saldoBanco: parseFloat(cuentaData.saldo || 0),
        totalEsperado: parseFloat(cuentaData.total_esperado || 0),
        capitalEnCalle: parseFloat(prestamosData.capital_en_calle || 0),
        totalInteresRecibido: parseFloat(prestamosData.total_interes_recibido || 0),
        totalPrestado: parseFloat(prestamosData.total_prestado || 0),
      });
    } catch (e) { console.error('Error fetching patrimonio:', e); }
  }

  useEffect(() => { fetchPatrimonio(); }, []);
  return { data, fetchPatrimonio };
}

export default function AdminPanel({ onLogout, userId, initPrefs }) {
  const { rows, metrics, loading, error, addInversion, updateInversion, deleteInversion, fetchInversiones, fetchMetrics } = useInversiones();
  const { items: inventarioItems, fetchItems: fetchInventarioItems } = useInventarioItems();
  const { data: patrimonioData } = usePatrimonioData();
  const [showSold, setShowSold] = useState(false);
  const [tasaOportunidad, setTasaOportunidad] = useState(8.0);
  const today = new Date().toISOString().slice(0, 10);

  const emptyForm = {
    nombre: '', monto: '', categoria: 'Sin categoría', fecha: today,
    costo_operativo: '', estado: 'activo', precio_venta: '', fecha_venta: '',
    valor_actual: '', notas: '', cantidad: '', precio_unitario: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [addingDivId, setAddingDivId] = useState(null);
  const [addingGastoId, setAddingGastoId] = useState(null);
  const [gastosList, setGastosList] = useState([]);
  const [editingGastoId, setEditingGastoId] = useState(null);
  const [despieceRow, setDespieceRow] = useState(null);
  const [divForm, setDivForm] = useState({ monto: '', fecha: '', registrar_en_cuenta: true });
  const gastoManualInicial = { modo: 'manual', monto: '', concepto: '', item_id: '', cantidad_usada: '', fecha: today, registrar_en_cuenta: true };
  const [gastoForm, setGastoForm] = useState(gastoManualInicial);
  const [showCharts, setShowCharts] = useState(false);
  const [chartMode, setChartMode] = useState('activo');
  const [openSections, setOpenSections] = useState({});
  const [showSettings, setShowSettings] = useState(false);

  async function fetchGastos(inversionId) {
    try {
      const res = await fetch(`${API_URL}?gastos=true&inversion_id=${inversionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar gastos');
      setGastosList(await res.json());
    } catch (err) { console.error(err); }
  }

  useEffect(() => { if (addingGastoId) fetchGastos(addingGastoId); }, [addingGastoId]);

  // Load user preferences from backend (passed via initPrefs)
  useEffect(() => {
    if (initPrefs) {
      setOpenSections(initPrefs);
    }
  }, [initPrefs]);

  // Helper para renderizar secciones según preferencias
  function renderSection(key, title, content, opts = {}) {
    const p = openSections[key] || { visible: true, open: false, accordion: true };
    if (p.visible === false) return null;
    if (p.accordion === false) {
      // Siempre abierto, sin estilo acordeón: solo título sobre línea divisora
      return (
        <div className="mb-4">
          <div className="py-2 mb-3" style={{ borderBottom: '1px solid var(--color-bw-border)', color: 'var(--color-bw-white)', fontWeight: 600, letterSpacing: 'var(--tracking-bw-wide)' }}>
            {title}
          </div>
          {content}
        </div>
      );
    }
    return (
      <Accordion title={title} defaultOpen={!!p.open}>
        {content}
      </Accordion>
    );
  }

  async function handleAddGasto(id) {
    const esInventario = gastoForm.modo === 'inventario';
    if (esInventario && !gastoForm.item_id) return alert('Selecciona un item de inventario');
    const item = inventarioItems.find(i => String(i.id) === String(gastoForm.item_id));
    if (esInventario && ['consumible', 'repuesto'].includes(item?.tipo) && (!gastoForm.cantidad_usada || Number(gastoForm.cantidad_usada) <= 0)) return alert('Indica la cantidad utilizada');
    if (!esInventario && (!gastoForm.monto || !gastoForm.concepto)) return alert('Monto y concepto son obligatorios');
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(esInventario
          ? { action: 'add_gasto', inversion_id: id, item_id: Number(gastoForm.item_id), cantidad_usada: ['consumible', 'repuesto'].includes(item?.tipo) ? Number(gastoForm.cantidad_usada) : null, fecha: gastoForm.fecha || today }
          : { action: 'add_gasto', inversion_id: id, monto: parseFloat(gastoForm.monto), concepto: gastoForm.concepto, fecha: gastoForm.fecha || today, registrar_en_cuenta: gastoForm.registrar_en_cuenta })
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Error al registrar gasto'); }
      setGastoForm(gastoManualInicial);
      fetchGastos(id); fetchInversiones(); fetchMetrics(); fetchInventarioItems();
    } catch (err) { alert(err.message); }
  }

  async function handleEditGasto(gasto) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'actualizar_gasto', id: gasto.id, monto: parseFloat(gasto.monto), concepto: gasto.concepto, fecha: gasto.fecha })
      });
      if (!res.ok) throw new Error('Error al actualizar gasto');
      setEditingGastoId(null);
      fetchGastos(addingGastoId); fetchInversiones(); fetchMetrics(); fetchInventarioItems();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteGasto(gastoId) {
    if (!confirm('¿Eliminar este gasto detallado?')) return;
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_gasto', id: gastoId })
      });
      if (!res.ok) throw new Error('Error al eliminar gasto');
      fetchGastos(addingGastoId); fetchInversiones(); fetchMetrics();
    } catch (err) { alert(err.message); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError(null);
    if (!form.nombre || !form.monto) { setFormError('Nombre y costo de compra obligatorios'); return; }
    const payload = {
      nombre: form.nombre, monto: parseFloat(form.monto),
      categoria: form.categoria || 'Sin categoría', fecha: form.fecha || today,
      costo_operativo: form.costo_operativo ? parseFloat(form.costo_operativo) : 0,
      estado: form.estado,
      valor_actual: form.valor_actual ? parseFloat(form.valor_actual) : null,
      precio_venta: form.precio_venta ? parseFloat(form.precio_venta) : null,
      fecha_venta: form.fecha_venta || null,
      notas: form.notas || null,
      cantidad: form.cantidad ? parseFloat(form.cantidad) : null,
      precio_unitario: form.precio_unitario ? parseFloat(form.precio_unitario) : null,
      costo_operativo_venta: form.costo_operativo_venta ? parseFloat(form.costo_operativo_venta) : 0,
      valor_actual_unitario: form.valor_actual_unitario ? parseFloat(form.valor_actual_unitario) : null
    };
    const result = await addInversion(payload);
    if (result.success) { setForm(emptyForm); setShowAdvanced(false); setFormError(null); } else { setFormError(result.error); }
  }

  async function handleAddDividendo(id) {
    if (!divForm.monto) return alert('Monto del dividendo es obligatorio');
    try {
      const res = await fetch(API_URL, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_dividendo', inversion_id: id, monto: parseFloat(divForm.monto), fecha: divForm.fecha || new Date().toISOString().slice(0, 10), registrar_en_cuenta: divForm.registrar_en_cuenta })
      });
      if (!res.ok) throw new Error('Error al registrar dividendo');
      setAddingDivId(null);
      setDivForm({ monto: '', fecha: '', registrar_en_cuenta: true });
      fetchInversiones(); fetchMetrics();
    } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar registro? Se borrarán sus dividendos asociados también.')) return;
    const result = await deleteInversion(id);
    if (!result.success) alert(result.error);
  }

  async function handleSaveEdit(id, data) {
    const result = await updateInversion(id, data);
    if (!result.success) alert(result.error);
  }

  function calcularMétricasRow(r) {
    const totalDivs = parseFloat(r.total_dividendos) || 0;
    const totalGastosDet = parseFloat(r.total_gastos_detallados) || 0;
    const costoOpVenta = parseFloat(r.costo_operativo_venta) || 0;
    const costoTotal = parseFloat(r.monto) + (parseFloat(r.costo_operativo) || 0) + costoOpVenta + totalGastosDet - (parseFloat(r.valor_transferido) || 0);
    const esVendido = r.estado === 'vendido';
    const venta = esVendido && r.precio_venta ? parseFloat(r.precio_venta) : 0;
    const ganancia = (venta + totalDivs) - costoTotal;
    const roi = (ganancia / costoTotal) * 100;
    const dividendYield = costoTotal > 0 ? (totalDivs / costoTotal) * 100 : 0;
    const fechaCompraObj = new Date(r.fecha);
    const endDate = esVendido && r.fecha_venta ? new Date(r.fecha_venta) : new Date();
    const diffDays = Math.max(1, Math.ceil((endDate - fechaCompraObj) / (1000 * 60 * 60 * 24)));
    let factorEA = Math.pow(1 + (roi / 100), 365 / diffDays);
    let eaPercent = (factorEA - 1) * 100;
    if (!isFinite(eaPercent)) eaPercent = 999999;
    eaPercent = Math.max(-100, eaPercent);
    let usaEM = eaPercent > 999;
    let emPercent = usaEM ? (Math.pow(1 + (roi / 100), 30 / diffDays) - 1) * 100 : null;
    let eaPrevisto = null, emPrevisto = null, usaEMPrev = false, gananciaPrevista = null;
    if (!esVendido && r.categoria === 'Acciones en Bolsa' && r.valor_actual > 0) {
      gananciaPrevista = (parseFloat(r.valor_actual) + totalDivs) - costoTotal;
      const roiProy = (gananciaPrevista / costoTotal) * 100;
      const fProy = Math.pow(1 + (roiProy / 100), 365 / diffDays);
      eaPrevisto = (fProy - 1) * 100;
      if (!isFinite(eaPrevisto)) eaPrevisto = 999999;
      eaPrevisto = Math.max(-100, eaPrevisto);
      usaEMPrev = eaPrevisto > 999;
      if (usaEMPrev) emPrevisto = (Math.pow(1 + (roiProy / 100), 30 / diffDays) - 1) * 100;
    }
    return { costoTotal, ganancia, roi, diffDays, eaPercent, esVendido, totalDivs, dividendYield, eaPrevisto, gananciaPrevista, totalGastosDet, costoOpVenta, usaEM, emPercent, usaEMPrev, emPrevisto };
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--color-bw-muted)' }}>Cargando...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bw-black)', color: 'var(--color-bw-primary)', fontFamily: 'var(--font-bw-body)' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6" style={S.sectionDivider}>
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-bw-white)', letterSpacing: 'var(--tracking-bw-tight)', fontFamily: 'var(--font-bw-display)' }}>
              Panel de Administración
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-bw-muted)' }}>Gestiona flujo de caja y rentabilidad real</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} title="Preferencias" className="bw-btn-ghost text-sm px-3 py-2">⚙</button>
            <button onClick={onLogout} className="bw-btn-ghost text-sm px-4 py-2">Cerrar Sesión</button>
          </div>
        </header>

        <PanelSettings initPrefs={initPrefs} open={showSettings} onClose={() => setShowSettings(false)} onSave={(prefs) => setOpenSections(prefs)} />

        {/* Secciones ordenadas según preferencias */}
        {(() => {
          const ordered = Object.keys(openSections).length
            ? Object.entries(openSections).sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
            : [
                ['metrics', {}], ['brandlab', {}], ['portafolio', {}], ['cuenta', {}],
                ['herramientas', {}], ['ingresar', {}], ['prestamos', {}], ['graficos', {}], ['vendidos', {}]
              ];

          return ordered.map(([key]) => {
            switch (key) {
              case 'metrics':
                return renderSection('metrics', 'Métricas generales',
                  <MetricsCards metrics={metrics} tasaOportunidad={tasaOportunidad} patrimonioData={patrimonioData} />);
              case 'brandlab':
                return userId === 1 ? renderSection('brandlab', 'BrandLab', <BrandLabSection />) : null;
              case 'cuenta':
                return renderSection('cuenta', 'Cuenta Bancaria',
                  <CuentaBancariaSection onTasaChange={setTasaOportunidad} globalMetrics={metrics} />);
              case 'herramientas':
                return renderSection('herramientas', 'Herramientas e Inventario', <HerramientasSection />);
              case 'prestamos':
                return renderSection('prestamos', 'Préstamos', <PrestamosSection />);
              case 'ingresar':
                return renderSection('ingresar',
                  <span className="flex items-center gap-2"><PlusCircle size={14} /> Ingresar Operación / Adquisición</span>,
                  <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {formError ? <div className="md:col-span-4 p-2 mb-2 text-sm" style={{ background: '#3b0a0a', color: 'white' }}>{formError} <button onClick={() => setFormError(null)} style={{ marginLeft: 8, color: '#ffdede' }}>Cerrar</button></div> : null}
                    <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Nombre de la inversión</label>
                        <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                          placeholder="Ej: Boxwill BrandLab" style={S.input} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Categoría</label>
                      <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={S.input}>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {form.categoria === 'Acciones en Bolsa' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs flex items-center gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Info size={11} /> Cantidad de Acciones</label>
                          <input type="number" step="0.0001" value={form.cantidad}
                            onChange={e => {
                              const cant = e.target.value;
                              const pu = form.precio_unitario;
                              const newMonto = (parseFloat(cant) || 0) * (parseFloat(pu) || 0);
                              setForm({ ...form, cantidad: cant, monto: newMonto > 0 ? newMonto.toString() : form.monto });
                            }}
                            placeholder="Ej: 15.5" style={S.input} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs flex items-center gap-1" style={{ color: 'var(--color-bw-secondary)' }}><Info size={11} /> P. Unitario Compra</label>
                          <input type="number" step="0.01" value={form.precio_unitario}
                            onChange={e => {
                              const pu = e.target.value;
                              const cant = form.cantidad;
                              const newMonto = (parseFloat(cant) || 0) * (parseFloat(pu) || 0);
                              setForm({ ...form, precio_unitario: pu, monto: newMonto > 0 ? newMonto.toString() : form.monto });
                            }}
                            placeholder="En COP o USD..." style={S.input} />
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Costo Total de Compra (Monto)*</label>
                      <input type="number" step="0.01" value={form.monto}
                        onChange={e => setForm({ ...form, monto: e.target.value })}
                        placeholder="Ej: 30000" style={S.input} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Costos Extra (Operativos)</label>
                      <input type="number" step="0.01" value={form.costo_operativo}
                        onChange={e => setForm({ ...form, costo_operativo: e.target.value })}
                        placeholder="Ej: 40000" style={S.input} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Fecha Inversión</label>
                      <input type="date" value={form.fecha}
                        onChange={e => setForm({ ...form, fecha: e.target.value })} style={S.input} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Patrimonio Estimado Inicial</label>
                      <input type="number" step="0.01" value={form.valor_actual}
                        onChange={e => setForm({ ...form, valor_actual: e.target.value })}
                        placeholder="Precio actual de mercado" style={S.input} />
                    </div>
                    <div className="flex items-end md:col-span-1">
                      <button className="w-full px-8 py-3 font-medium text-sm bw-btn-primary" type="submit">
                        Registrar Compra
                      </button>
                    </div>
                    <div className="md:col-span-4">
                      <button type="button" onClick={() => { setShowAdvanced(!showAdvanced); setFormError(null); }} className="text-xs" style={{ color: 'var(--color-bw-secondary)' }}>{showAdvanced ? 'Ocultar' : 'Mostrar'} campos avanzados</button>
                    </div>
                    {showAdvanced ? (
                      <div className="md:col-span-4 p-3" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                        {formError ? <div className="mb-2 p-2 text-sm" style={{ background: '#3b0a0a', color: 'white' }}>{formError} <button onClick={() => setFormError(null)} style={{ marginLeft: 8, color: '#ffdede' }}>Cerrar</button></div> : null}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Costo Op. (venta)</label>
                            <input type="number" step="0.01" value={form.costo_operativo_venta || ''} onChange={e => setForm({ ...form, costo_operativo_venta: e.target.value })} style={S.input} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Valor actual unitario</label>
                            <input type="number" step="0.01" value={form.valor_actual_unitario || ''} onChange={e => setForm({ ...form, valor_actual_unitario: e.target.value })} style={S.input} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Estado</label>
                            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={S.input}>
                              <option value="activo">activo</option>
                              <option value="vendido">vendido</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Fecha venta</label>
                            <input type="date" value={form.fecha_venta || ''} onChange={e => setForm({ ...form, fecha_venta: e.target.value })} style={S.input} />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Notas / Origen</label>
                            <input value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} style={S.input} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </form>);
              case 'portafolio':
                return renderSection('portafolio', 'Portafolio General',
                  <div className="mb-12 overflow-hidden" style={S.card}>
                    <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
                      <h3 className="font-medium flex gap-2 items-center" style={{ color: 'var(--color-bw-white)' }}>
                        <DollarSign size={18} /> Portafolio General
                      </h3>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-bw-muted)' }}>
                        <Info size={13} />
                        <span>Benchmark: <strong style={{ color: 'var(--color-bw-secondary)' }}>{tasaOportunidad}% E.A.</strong> (Cuenta Alto Rendimiento)</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--color-bw-raised)' }}>
                          <tr>
                            {['Activo', 'Estado', 'Costo Inversión', 'Flujo (Venta/Div/Est.)', 'Retorno Neto', 'Rendimiento', 'Acciones'].map((h, i) => (
                              <th key={i} className={`py-3 px-4 text-xs font-medium uppercase ${i >= 2 && i <= 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}
                                style={{ color: 'var(--color-bw-muted)', letterSpacing: 'var(--tracking-bw-wide)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.filter(r => r.estado === 'activo').map(r => {
                            const m = calcularMétricasRow(r);
                            const pierdeVsBench = m.eaPercent < tasaOportunidad && m.ganancia > 0;
                            const esEquity = m.totalDivs > 0;

                            return (
                              <React.Fragment key={r.id}>
                                <tr className="transition-colors" style={{ borderBottom: '1px solid var(--color-bw-border)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bw-raised)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  {/* Activo */}
                                  <td className="py-4 px-4">
                                    <div className="font-medium" style={{ color: 'var(--color-bw-white)' }}>{r.nombre}</div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>
                                      {r.fecha} • {r.categoria}
                                      {r.categoria === 'Acciones en Bolsa' && r.cantidad && (
                                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-secondary)' }}>
                                          {Number(r.cantidad).toLocaleString('es-CO')} u · {Number(r.precio_unitario || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} c/u
                                        </div>
                                      )}
                                      {r.conceptos_gastos && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {r.conceptos_gastos.split(', ').map((c, idx) => (
                                            <span key={idx} className="text-orange-400 text-[9px] px-1.5 py-0.5 flex items-center gap-1"
                                              style={{ background: 'rgba(194,65,12,0.1)', border: '1px solid rgba(194,65,12,0.2)' }}>
                                              <Wrench size={8} /> {c}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  {/* Estado */}
                                  <td className="py-4 px-4">
                                    <span className="px-2 py-1 text-xs"
                                      style={m.esVendido
                                        ? { background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
                                        : { background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                                      }>
                                      {m.esVendido ? 'Vendido' : 'Activo'}
                                    </span>
                                  </td>
                                  {/* Costo */}
                                  <td className="py-4 px-4 text-right" style={{ color: 'var(--color-bw-white)' }}>
                                    <div className="flex flex-col items-end">
                                      {r.categoria === 'Acciones en Bolsa' ? (
                                        <>
                                          <span>{Number(r.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
                                          {(parseFloat(r.costo_operativo) > 0 || m.totalGastosDet > 0 || m.costoOpVenta > 0) && (
                                            <span className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>
                                              + {Number(parseFloat(r.costo_operativo) + m.totalGastosDet + m.costoOpVenta).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} com/gastos
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <span>{m.costoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
                                          {m.totalGastosDet > 0 && (
                                            <span className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>
                                              (inc. {m.totalGastosDet.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} det.)
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  {/* Flujo */}
                                  <td className="py-4 px-4 text-right">
                                    <div className="flex flex-col items-end">
                                      {m.esVendido && r.precio_venta && (
                                        <div style={{ color: 'var(--color-bw-white)' }}>
                                          + {parseFloat(r.precio_venta).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                                          <span className="text-[10px] ml-1" style={{ color: 'var(--color-bw-muted)' }}>(Venta)</span>
                                        </div>
                                      )}
                                      {!m.esVendido && r.valor_actual && parseFloat(r.valor_actual) > 0 && (
                                        <div className="text-green-400">
                                          ~ {parseFloat(r.valor_actual).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                                          <span className="text-[10px] ml-1 text-green-700">(Est.)</span>
                                        </div>
                                      )}
                                      {esEquity && (
                                        <div className="text-green-400 mt-1">
                                          + {m.totalDivs.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                                          <span className="text-[10px] ml-1 text-green-700">(Div)</span>
                                        </div>
                                      )}
                                      {!m.esVendido && !esEquity && !r.valor_actual && <span style={{ color: 'var(--color-bw-muted)' }}>-</span>}
                                    </div>
                                  </td>

                                  {/* Retorno Neto */}
                                  <td className="py-4 px-4 text-right">
                                    <div className="flex flex-col items-end">
                                      {m.gananciaPrevista !== null ? (
                                        <>
                                          <span className={`font-bold ${m.gananciaPrevista >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {m.gananciaPrevista >= 0 ? '+' : ''}{m.gananciaPrevista.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                                          </span>
                                          <span className="text-[10px] text-green-600 font-medium uppercase tracking-tighter">Proyectado</span>
                                        </>
                                      ) : (
                                        <span className={`font-bold ${m.ganancia >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          {m.ganancia >= 0 ? '+' : ''}{m.ganancia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Rendimiento (E.A.) */}
                                  <td className="py-4 px-4 text-right">
                                    <div className="flex flex-col items-end">
                                      {m.eaPrevisto !== null ? (
                                        <>
                                          <span className="text-green-400 font-bold">
                                            {m.gananciaPrevista !== null ? `+${((m.gananciaPrevista / m.costoTotal) * 100).toFixed(1)}% ROI` : ''}
                                          </span>
                                          <span className="text-[10px] text-green-600 font-medium uppercase">
                                            {m.usaEMPrev ? `${m.emPrevisto.toFixed(1)}% EM` : `${m.eaPrevisto.toFixed(1)}% EA`}
                                          </span>
                                        </>
                                      ) : !m.esVendido && esEquity ? (
                                        <span className="text-green-400 font-bold">{m.dividendYield.toFixed(1)}% Div. Yield</span>
                                      ) : m.esVendido ? (
                                        <>
                                          <span className={`font-bold ${m.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {m.roi >= 0 ? '+' : ''}{m.roi.toFixed(1)}% ROI
                                          </span>
                                          <span className={`text-[10px] font-medium uppercase ${pierdeVsBench ? 'text-yellow-500' : 'text-gray-500'}`}>
                                            {m.usaEM ? (m.emPercent > 999 ? 'Extremo' : `${m.emPercent.toFixed(1)}% EM`) : `${m.eaPercent.toFixed(1)}% EA`}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="italic" style={{ color: 'var(--color-bw-muted)' }}>En marcha</span>
                                      )}
                                      <span className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>{m.diffDays} d. inmov.</span>
                                    </div>
                                  </td>

                                  {/* Acciones */}
                                  <td className="py-4 px-4 text-center">
                                    <div className="flex justify-center gap-3">
                                      <button onClick={() => setEditingRow(r)} className="p-1 hover:text-blue-400 transition-colors" title="Editar">
                                        <Edit2 size={15} />
                                      </button>
                                      {['Acciones en Bolsa', 'Equity / Empresas'].includes(r.categoria) && (
                                        <button onClick={() => setAddingDivId(r.id)} className="p-1 hover:text-green-400 transition-colors" title="Añadir Dividendo/Ingreso">
                                          <PlusCircle size={15} />
                                        </button>
                                      )}
                                      <button onClick={() => setAddingGastoId(r.id)} className="p-1 hover:text-orange-400 transition-colors" title="Añadir Gasto Detallado">
                                        <Wrench size={15} />
                                      </button>
                                      <button onClick={() => setDespieceRow(r)} className="p-1 hover:text-purple-400 transition-colors" title="Despiece (Mover a Inventario)">
                                        <Boxes size={15} />
                                      </button>
                                      <button onClick={() => handleDelete(r.id)} className="p-1 hover:text-red-400 transition-colors" title="Eliminar">
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan="7" className="py-12 text-center text-sm" style={{ color: 'var(--color-bw-muted)' }}>
                                No hay operaciones registradas. Registra tu primera adquisición.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>);
              default:
                return null;
            }
          });
        })()}

        {/* Acordeón Gráficos */}
        {renderSection('graficos', 'Análisis de Portafolio',
          <div className="p-6">
            <div className="flex justify-end mb-6">
              <div className="flex p-1" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                <button onClick={() => setChartMode('activo')}
                  className="px-4 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: chartMode === 'activo' ? '#2563eb' : 'transparent', color: chartMode === 'activo' ? '#fff' : 'var(--color-bw-muted)', borderRadius: 0 }}>
                  Actuales
                </button>
                <button onClick={() => setChartMode('historico')}
                  className="px-4 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: chartMode === 'historico' ? '#4f46e5' : 'transparent', color: chartMode === 'historico' ? '#fff' : 'var(--color-bw-muted)', borderRadius: 0 }}>
                  Históricos
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {metrics && <DistributionChart data={chartMode === 'activo' ? metrics.distribucion_activa : metrics.distribucion} />}
              {metrics && <EvolutionChart data={chartMode === 'activo' ? metrics.evolucion_activa : metrics.evolucion} />}
            </div>
          </div>
        )}

        {/* Acordeón Vendidos */}
        {rows.some(r => r.estado === 'vendido') && renderSection('vendidos', 'Inversiones Liquidadas (Vendidas)',
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ background: 'var(--color-bw-raised)' }}>
                <tr>
                  {['Activo', 'Costo', 'Venta / Flujo', 'Retorno', 'Rendimiento', 'Acciones'].map((h, i) => (
                    <th key={i} className={`py-3 px-4 text-xs font-medium uppercase ${i === 0 ? 'text-left' : i === 5 ? 'text-center' : 'text-right'}`}
                      style={{ color: 'var(--color-bw-muted)', letterSpacing: 'var(--tracking-bw-wide)' }}>
                      {h}
                    </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(r => r.estado === 'vendido').map(r => {
                      const m = calcularMétricasRow(r);
                      const pierdeVsBench = m.eaPercent < tasaOportunidad && m.ganancia > 0;
                      return (
                        <tr key={r.id} className="transition-colors" style={{ borderBottom: '1px solid var(--color-bw-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bw-raised)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td className="py-4 px-4">
                            <div className="font-medium" style={{ color: 'var(--color-bw-white)' }}>{r.nombre}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>{r.fecha} • {r.fecha_venta}</div>
                          </td>
                          <td className="py-4 px-4 text-right" style={{ color: 'var(--color-bw-secondary)' }}>
                            {m.costoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-4 text-right" style={{ color: 'var(--color-bw-white)' }}>
                            {parseFloat(r.precio_venta || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`font-bold ${m.ganancia >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {m.ganancia >= 0 ? '+' : ''}{m.ganancia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`font-bold ${m.roi >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                                {m.roi >= 0 ? '+' : ''}{m.roi.toFixed(1)}% ROI
                              </span>
                              <span className={`text-[10px] font-medium uppercase ${pierdeVsBench ? 'text-yellow-500' : 'text-gray-500'}`}>
                                {m.usaEM ? (m.emPercent > 999 ? 'Extremo' : `${m.emPercent.toFixed(1)}% EM`) : `${m.eaPercent.toFixed(1)}% EA`}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setEditingRow(r)} className="text-blue-500 hover:text-blue-400 transition-colors"><Edit2 size={15} /></button>
                              <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Análisis de desempeño */}
                <div className="p-6" style={{ borderTop: '1px solid var(--color-bw-border)', background: 'var(--color-bw-raised)' }}>
                  <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-bw-white)' }}>Análisis de Desempeño (Top 3)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <h5 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-green-500">
                        <TrendingUp size={13} /> Mejores Inversiones (Para repetir)
                      </h5>
                      <div className="space-y-3">
                        {(() => {
                          const soldRows = rows.filter(r => r.estado === 'vendido').map(r => ({ ...r, ...calcularMétricasRow(r) }));
                          const top3 = [...soldRows].filter(r => r.ganancia > 0).sort((a, b) => b.eaPercent - a.eaPercent).slice(0, 3);
                          if (top3.length === 0) return <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Aún no hay inversiones ganadoras.</p>;
                          return top3.map((r, i) => (
                            <div key={r.id} className="flex justify-between items-center p-2"
                              style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                              <div className="flex gap-2 items-center">
                                <span className="text-green-600 font-bold text-xs">{i + 1}.</span>
                                <span className="text-sm truncate max-w-[150px]" style={{ color: 'var(--color-bw-secondary)' }} title={r.nombre}>{r.nombre}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-sm text-green-500 font-semibold">{r.eaPercent.toFixed(1)}% EA</span>
                                <span className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>+{r.ganancia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} neto</span>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="p-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <h5 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 text-red-500">
                        <TrendingDown size={13} /> Peores Inversiones (Evitar errores)
                      </h5>
                      <div className="space-y-3">
                        {(() => {
                          const soldRows = rows.filter(r => r.estado === 'vendido').map(r => ({ ...r, ...calcularMétricasRow(r) }));
                          const top3Peores = [...soldRows].sort((a, b) => a.eaPercent - b.eaPercent).slice(0, 3);
                          if (top3Peores.length === 0) return <p className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>No hay registros suficientes.</p>;
                          return top3Peores.map((r, i) => (
                            <div key={r.id} className="flex justify-between items-center p-2"
                              style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                              <div className="flex gap-2 items-center">
                                <span className="text-red-600 font-bold text-xs">{i + 1}.</span>
                                <span className="text-sm truncate max-w-[150px]" style={{ color: 'var(--color-bw-secondary)' }} title={r.nombre}>{r.nombre}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`text-sm font-semibold ${r.ganancia > 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  {r.eaPercent.toFixed(1)}% EA
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>
                                  {r.ganancia >= 0 ? '+' : ''}{r.ganancia.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} neto
                                </span>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

        {/* --- Modales de Acción --- */}
        {editingRow && (
          <EditModal
            row={editingRow}
            onClose={() => setEditingRow(null)}
            onSave={(id, data) => handleSaveEdit(id, data)}
          />
        )}

        {despieceRow && (
          <DespieceModal row={despieceRow} onClose={() => setDespieceRow(null)} onSaved={async () => { await fetchInversiones(); await fetchMetrics(); }} />
        )}

        {/* Modal: Añadir Dividendo / Ingreso */}
        {addingDivId && (() => {
          const inv = rows.find(r => r.id === addingDivId);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
              <div className="w-full max-w-md mx-4" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>Añadir Dividendo / Ingreso</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>{inv?.nombre}</p>
                  </div>
                  <button onClick={() => setAddingDivId(null)} className="transition-colors" style={{ color: 'var(--color-bw-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}>
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Monto del dividendo/ingreso*</label>
                    <input type="number" step="0.01" value={divForm.monto} onChange={e => setDivForm({ ...divForm, monto: e.target.value })}
                      placeholder="Ej: 15000" style={S.input} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Fecha</label>
                    <input type="date" value={divForm.fecha} onChange={e => setDivForm({ ...divForm, fecha: e.target.value })} style={S.input} />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--color-bw-secondary)' }}>
                    <input type="checkbox" checked={divForm.registrar_en_cuenta} onChange={e => setDivForm({ ...divForm, registrar_en_cuenta: e.target.checked })} />
                    Sincronizar con Cuenta Bancaria
                  </label>
                </div>
                <div className="flex justify-end gap-3 p-5" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                  <button onClick={() => setAddingDivId(null)} className="bw-btn-ghost text-sm px-4 py-2">Cancelar</button>
                  <button onClick={() => handleAddDividendo(addingDivId)} className="bw-btn-primary text-sm px-4 py-2">Guardar</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal: Añadir Gasto Detallado */}
        {addingGastoId && (() => {
          const inv = rows.find(r => r.id === addingGastoId);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
              <div className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: 'var(--color-bw-white)' }}>Añadir Gasto Detallado</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>{inv?.nombre}</p>
                  </div>
                  <button onClick={() => setAddingGastoId(null)} className="transition-colors" style={{ color: 'var(--color-bw-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}>
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Lista de gastos ya registrados */}
                  {gastosList.length > 0 && (
                    <div className="pt-2" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                      <p className="text-xs mb-2" style={{ color: 'var(--color-bw-muted)' }}>Gastos registrados</p>
                      <div className="space-y-1">
                        {gastosList.map(g => (
                          <div key={g.id} className="flex justify-between items-center text-xs p-2 group transition-colors"
                            style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                            {editingGastoId === g.id ? (
                              <div className="flex items-center gap-2 w-full">
                                <input className="text-sm p-1" style={{ ...S.input, width: '8rem', padding: '0.25rem 0.5rem' }}
                                  value={g.concepto} onChange={e => setGastosList(prev => prev.map(x => x.id === g.id ? { ...x, concepto: e.target.value } : x))} />
                                <input type="number" className="text-sm p-1" style={{ ...S.input, width: '6rem', padding: '0.25rem 0.5rem' }}
                                  value={g.monto} onChange={e => setGastosList(prev => prev.map(x => x.id === g.id ? { ...x, monto: e.target.value } : x))} />
                                <input type="date" className="text-sm p-1" style={{ ...S.input, width: 'auto', padding: '0.25rem 0.5rem' }}
                                  value={g.fecha} onChange={e => setGastosList(prev => prev.map(x => x.id === g.id ? { ...x, fecha: e.target.value } : x))} />
                                <button onClick={() => handleEditGasto(g)} className="text-[10px] text-white px-2 py-1 bw-btn-primary">Guardar</button>
                                <button onClick={() => setEditingGastoId(null)} className="text-[10px] px-2 py-1" style={{ color: 'var(--color-bw-muted)' }}>Cancelar</button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-4">
                                  <span style={{ color: 'var(--color-bw-muted)' }}>{g.fecha}</span>
                                  <span className="font-medium" style={{ color: 'var(--color-bw-white)' }}>{g.concepto}</span>
                                  <span className="font-bold" style={{ color: 'var(--color-bw-secondary)' }}>{Number(g.monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {!g.item_id && <button onClick={() => setEditingGastoId(g.id)} className="transition-colors" style={{ color: 'var(--color-bw-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}><Edit2 size={12} /></button>}
                                  <button onClick={() => handleDeleteGasto(g.id)} className="transition-colors" style={{ color: 'var(--color-bw-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}><Trash2 size={12} /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formulario nuevo gasto */}
                  <div className="pt-3" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                    <p className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-bw-secondary)' }}><PlusCircle size={13} /> Nuevo gasto</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Tipo</label>
                        <select value={gastoForm.modo} onChange={e => setGastoForm({ ...gastoManualInicial, modo: e.target.value, fecha: gastoForm.fecha })} style={S.input}>
                          <option value="manual">Gasto manual</option>
                          <option value="inventario">Usar inventario</option>
                        </select>
                      </div>
                      {gastoForm.modo === 'inventario' ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Item de inventario</label>
                            <select value={gastoForm.item_id} onChange={e => setGastoForm({ ...gastoForm, item_id: e.target.value, cantidad_usada: '' })} style={S.input}>
                              <option value="">Selecciona herramienta o consumible</option>
                              {inventarioItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.nombre} · {['consumible', 'repuesto'].includes(item.tipo) ? `${item.cantidad_restante} ${item.unidad_medida} disp.` : 'Herramienta'}
                                </option>
                              ))}
                            </select>
                          </div>
                          {['consumible', 'repuesto'].includes(inventarioItems.find(i => String(i.id) === String(gastoForm.item_id))?.tipo) && (
                            <div className="space-y-1">
                              <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Cantidad usada</label>
                              <input type="number" min="0.0001" step="0.0001" value={gastoForm.cantidad_usada}
                                onChange={e => setGastoForm({ ...gastoForm, cantidad_usada: e.target.value })} placeholder="Ej: 2" style={S.input} />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Concepto*</label>
                            <input value={gastoForm.concepto} onChange={e => setGastoForm({ ...gastoForm, concepto: e.target.value })}
                              placeholder="Ej: Envío, comisión, reparación" style={S.input} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Monto*</label>
                            <input type="number" step="0.01" value={gastoForm.monto} onChange={e => setGastoForm({ ...gastoForm, monto: e.target.value })}
                              placeholder="Ej: 5000" style={S.input} />
                          </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs" style={{ color: 'var(--color-bw-muted)' }}>Fecha</label>
                        <input type="date" value={gastoForm.fecha} onChange={e => setGastoForm({ ...gastoForm, fecha: e.target.value })} style={S.input} />
                      </div>
                      {gastoForm.modo === 'manual' && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--color-bw-secondary)' }}>
                          <input type="checkbox" checked={gastoForm.registrar_en_cuenta} onChange={e => setGastoForm({ ...gastoForm, registrar_en_cuenta: e.target.checked })} />
                          Registrar en Cuenta Bancaria
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 p-5" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                  <button onClick={() => setAddingGastoId(null)} className="bw-btn-ghost text-sm px-4 py-2">Cerrar</button>
                  <button onClick={() => handleAddGasto(addingGastoId)} className="bw-btn-primary text-sm px-4 py-2">Añadir Gasto</button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
