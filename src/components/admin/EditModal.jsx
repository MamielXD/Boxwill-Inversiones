import React, { useState, useEffect } from 'react';
import { X, Unlock, Lock, AlertTriangle, Landmark } from 'lucide-react';

const CUENTA_API = import.meta.env.PUBLIC_API_URL + '/cuenta.php';

const CATEGORIAS = [
  'Tecnología', 'Electrónica', 'Ropa y Accesorios', 'Equity / Empresas',
  'Acciones en Bolsa', 'Bienes Raíces', 'Vehículos', 'Servicios', 'Otro', 'Sin categoría',
];

// Estilos de input reutilizables
const inputStyle = {
  background: 'var(--color-bw-raised)',
  border: '1px solid var(--color-bw-border-strong)',
  color: 'var(--color-bw-white)',
  borderRadius: 0,
  width: '100%',
  padding: '0.625rem 0.75rem',
  fontSize: 'var(--text-bw-sm)',
};

const labelStyle = {
  display: 'block',
  fontSize: 'var(--text-bw-xs)',
  color: 'var(--color-bw-muted)',
  marginBottom: '0.375rem',
};

export default function EditModal({ row, onClose, onSave }) {
  const [f, setF] = useState({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [registrarEnCuenta, setRegistrarEnCuenta] = useState(true);

  const eraActivo = row?.estado !== 'vendido';

  useEffect(() => {
    if (row) {
      setF({
        nombre: row.nombre || '',
        monto: row.monto || '',
        categoria: row.categoria || 'Sin categoría',
        fecha: row.fecha || '',
        costo_operativo: row.costo_operativo || '',
        costo_operativo_venta: row.costo_operativo_venta || '',
        estado: row.estado || 'activo',
        valor_actual: row.valor_actual || '',
        precio_venta: row.precio_venta || '',
        fecha_venta: row.fecha_venta || '',
        notas: row.notas || '',
        cantidad: row.cantidad || '',
        precio_unitario: row.precio_unitario || '',
        valor_actual_unitario: row.valor_actual_unitario || '',
      });
      setAdvancedMode(false);
      setRegistrarEnCuenta(row.estado !== 'vendido');
    }
  }, [row]);

  if (!row) return null;

  const seEstaVendiendo = f.estado === 'vendido' && eraActivo;
  const precioVentaNum = parseFloat(f.precio_venta) || 0;
  const costoOpCompraNum = parseFloat(f.costo_operativo) || 0;
  const costoOpVentaNum = parseFloat(f.costo_operativo_venta) || 0;
  const netoCuenta = Math.max(0, precioVentaNum - costoOpVentaNum);

  async function handleSave() {
    onSave(row.id, {
      costo_operativo: f.costo_operativo !== '' ? parseFloat(f.costo_operativo) : 0,
      costo_operativo_venta: f.costo_operativo_venta !== '' ? parseFloat(f.costo_operativo_venta) : 0,
      estado: f.estado,
      valor_actual: f.estado === 'activo' && f.valor_actual !== '' ? parseFloat(f.valor_actual) : null,
      precio_venta: f.estado === 'vendido' && f.precio_venta !== '' ? parseFloat(f.precio_venta) : null,
      fecha_venta: f.estado === 'vendido' && f.fecha_venta ? f.fecha_venta : null,
      notas: f.notas || null,
      ...(advancedMode ? {
        nombre: f.nombre,
        monto: parseFloat(f.monto),
        categoria: f.categoria,
        fecha: f.fecha,
        cantidad: f.categoria === 'Acciones en Bolsa' && f.cantidad ? parseFloat(f.cantidad) : null,
        precio_unitario: f.categoria === 'Acciones en Bolsa' && f.precio_unitario ? parseFloat(f.precio_unitario) : null,
        valor_actual_unitario: f.categoria === 'Acciones en Bolsa' && f.valor_actual_unitario ? parseFloat(f.valor_actual_unitario) : null,
      } : {}),
    });

    if (seEstaVendiendo && registrarEnCuenta && netoCuenta > 0) {
      try {
        await fetch(CUENTA_API, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'deposito',
            monto: netoCuenta,
            fecha: f.fecha_venta || new Date().toISOString().slice(0, 10),
            inversion_ref: f.nombre || row.nombre,
            notas: `Venta neta (${precioVentaNum.toLocaleString('es-CO')} - ${costoOpVentaNum.toLocaleString('es-CO')} costos venta)`,
          }),
        });
      } catch (e) {
        console.error('Error al registrar en cuenta:', e);
      }
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-bw-white)', letterSpacing: 'var(--tracking-bw-tight)' }}>
              Editar Inversión
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>{row.nombre}</p>
          </div>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--color-bw-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Valuación y Estado */}
          <div>
            <h3 className="bw-eyebrow mb-4">Valuación y Estado</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="space-y-1">
                <label style={labelStyle}>
                  {f.estado === 'vendido' ? 'Costos de Compra (ya pagados)' : 'Costos Operativos (Reparaciones, comisiones)'}
                </label>
                {f.estado === 'vendido' ? (
                  <div className="p-2.5 text-sm" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)', color: 'var(--color-bw-muted)' }}>
                    {costoOpCompraNum > 0
                      ? costoOpCompraNum.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })
                      : '$0'
                    }
                    <span className="text-[10px] ml-2" style={{ color: 'var(--color-bw-muted)' }}>(fijo, ya descontado al comprar)</span>
                  </div>
                ) : (
                  <input type="number" value={f.costo_operativo} onChange={e => setF({ ...f, costo_operativo: e.target.value })} placeholder="0" style={inputStyle} />
                )}
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Estado</label>
                <select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={inputStyle}>
                  <option value="activo">Activo / En Inversión</option>
                  <option value="vendido">Liquidado (Vendido)</option>
                </select>
              </div>

              {f.estado === 'activo' ? (
                <div className="space-y-4 sm:col-span-2">
                  <div className="space-y-1">
                    <label style={labelStyle}>Valor de Mercado / Patrimonio Estimado</label>
                    <input type="number" value={f.valor_actual} onChange={e => setF({ ...f, valor_actual: e.target.value })} placeholder="Precio actual de mercado" style={{ ...inputStyle, border: '1px solid rgba(96,165,250,0.4)' }} />
                  </div>
                  {f.categoria === 'Acciones en Bolsa' && (
                    <div className="space-y-1">
                      <label style={{ ...labelStyle, color: '#93c5fd' }}>Valor de Mercado Unitario (por acción)</label>
                      <input type="number" step="0.01" value={f.valor_actual_unitario} onChange={e => {
                        const pu = e.target.value;
                        const cant = f.cantidad;
                        const newValor = (parseFloat(cant) || 0) * (parseFloat(pu) || 0);
                        setF({ ...f, valor_actual_unitario: pu, valor_actual: newValor > 0 ? newValor.toString() : f.valor_actual });
                      }} placeholder="Precio actual por unidad" style={{ ...inputStyle, border: '1px solid rgba(96,165,250,0.3)' }} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label style={labelStyle}>Precio de Venta (Total recibido) *</label>
                    <input type="number" value={f.precio_venta} onChange={e => setF({ ...f, precio_venta: e.target.value })} placeholder="Ej: 150000" style={inputStyle} />
                  </div>
                  <div className="space-y-1">
                    <label style={labelStyle}>Fecha de Venta</label>
                    <input type="date" value={f.fecha_venta} onChange={e => setF({ ...f, fecha_venta: e.target.value })} style={inputStyle} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label style={{ ...labelStyle, color: '#fdba74' }}>Costos Operativos de Venta (comisión venta, envío, etc.)</label>
                    <input type="number" value={f.costo_operativo_venta} onChange={e => setF({ ...f, costo_operativo_venta: e.target.value })} placeholder="Ej: 9000" style={{ ...inputStyle, border: '1px solid rgba(234,88,12,0.4)' }} />
                    <p className="text-[10px] mt-1 text-orange-500">Estos son los costos SOLO de la venta, separados de los costos de compra.</p>
                  </div>
                </>
              )}

              <div className="space-y-1 sm:col-span-2">
                <label style={labelStyle}>Notas</label>
                <textarea rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Observaciones, compradores, plataforma usada..."
                  style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
          </div>

          {/* Registro automático en cuenta */}
          {seEstaVendiendo && (
            <div
              className="p-4 transition-all"
              style={{
                border: registrarEnCuenta ? '1px solid rgba(34,211,238,0.3)' : '1px solid var(--color-bw-border)',
                background: registrarEnCuenta ? 'rgba(34,211,238,0.04)' : 'var(--color-bw-raised)',
              }}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={registrarEnCuenta} onChange={e => setRegistrarEnCuenta(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-cyan-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark size={14} className="text-cyan-400" />
                    <span className="text-sm font-medium text-cyan-300">Registrar ingreso en Cuenta Bancaria</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-bw-muted)' }}>
                    {netoCuenta > 0
                      ? <>Entrará {netoCuenta.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} a tu cuenta <span style={{ color: 'var(--color-bw-muted)' }}>(Venta {precioVentaNum.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} − Costos Venta {costoOpVentaNum.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })})</span></>
                      : 'Completa el Precio de Venta para habilitar el registro automático.'
                    }
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Modo Avanzado */}
          <div className="pt-4" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
            <button
              type="button"
              onClick={() => setAdvancedMode(!advancedMode)}
              className="flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2"
              style={{
                background: advancedMode ? 'rgba(194,65,12,0.15)' : 'var(--color-bw-raised)',
                border: advancedMode ? '1px solid rgba(194,65,12,0.4)' : '1px solid var(--color-bw-border-strong)',
                color: advancedMode ? '#fb923c' : 'var(--color-bw-secondary)',
                borderRadius: 0,
              }}
            >
              {advancedMode ? <Unlock size={13} /> : <Lock size={13} />}
              {advancedMode ? 'Modo Avanzado Activo' : 'Activar Modo Avanzado'}
              {!advancedMode && <span className="text-xs ml-1" style={{ color: 'var(--color-bw-muted)' }}>(editar datos clave)</span>}
            </button>

            {advancedMode && (
              <div className="mt-4 p-4" style={{ background: 'rgba(194,65,12,0.06)', border: '1px solid rgba(194,65,12,0.2)' }}>
                <div className="flex items-center gap-2 mb-4 text-orange-400">
                  <AlertTriangle size={14} />
                  <span className="text-xs font-medium">Modo Avanzado: Cambiar estos valores afecta los cálculos históricos de ROI y E.A.%</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label style={{ ...labelStyle, color: '#fdba74' }}>Nombre / Activo</label>
                    <input type="text" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.4)' }} />
                  </div>
                  <div className="space-y-1">
                    <label style={{ ...labelStyle, color: '#fdba74' }}>Costo de Compra / Capital Inicial</label>
                    <input type="number" value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.4)' }} />
                  </div>

                  {f.categoria === 'Acciones en Bolsa' && (
                    <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                      <div className="space-y-1">
                        <label style={{ ...labelStyle, color: '#fdba74' }}>Cantidad</label>
                        <input type="number" step="0.0001" value={f.cantidad}
                          onChange={e => {
                            const cant = e.target.value;
                            const pu = f.precio_unitario;
                            const newMonto = (parseFloat(cant) || 0) * (parseFloat(pu) || 0);
                            setF({ ...f, cantidad: cant, monto: newMonto > 0 ? newMonto.toString() : f.monto });
                          }}
                          style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.3)' }} />
                      </div>
                      <div className="space-y-1">
                        <label style={{ ...labelStyle, color: '#fdba74' }}>P. Unitario Compra</label>
                        <input type="number" step="0.01" value={f.precio_unitario}
                          onChange={e => {
                            const pu = e.target.value;
                            const cant = f.cantidad;
                            const newMonto = (parseFloat(cant) || 0) * (parseFloat(pu) || 0);
                            setF({ ...f, precio_unitario: pu, monto: newMonto > 0 ? newMonto.toString() : f.monto });
                          }}
                          style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.3)' }} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label style={{ ...labelStyle, color: '#fdba74' }}>Fecha de Compra / Inversión</label>
                    <input type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.4)' }} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label style={{ ...labelStyle, color: '#fdba74' }}>Categoría</label>
                    <select value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })} style={{ ...inputStyle, border: '1px solid rgba(194,65,12,0.4)' }}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
          <button onClick={onClose} className="bw-btn-ghost text-sm px-5 py-2.5">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors" style={{ borderRadius: 0 }}>
            {seEstaVendiendo && registrarEnCuenta && netoCuenta > 0 ? 'Guardar y Registrar en Cuenta' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}