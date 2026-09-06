import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const calcEA = (tasaMensual) => ((Math.pow(1 + tasaMensual / 100, 12) - 1) * 100).toFixed(2);
const calcNA = (tasaMensual) => (parseFloat(tasaMensual || 0) * 12).toFixed(2);

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

export default function EditPrestamoModal({ prestamo, onClose, onSave }) {
  const [f, setF] = useState({
    prestatario: '', monto_original: '', tasa_mensual: '', comision: '',
    num_cuotas: '', fecha_inicio: '', notas: '', estado: 'activo',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prestamo) {
      setF({
        id: prestamo.id,
        prestatario: prestamo.prestatario || '',
        monto_original: prestamo.monto_original || '',
        tasa_mensual: prestamo.tasa_mensual || '0',
        comision: prestamo.comision || '0',
        num_cuotas: prestamo.num_cuotas || '',
        fecha_inicio: prestamo.fecha_inicio || '',
        notas: prestamo.notas || '',
        estado: prestamo.estado || 'activo',
      });
    }
  }, [prestamo]);

  if (!prestamo) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!f.prestatario || f.monto_original === '' || f.tasa_mensual === '' || !f.num_cuotas) {
      return alert('Completa todos los campos requeridos');
    }
    setSaving(true);
    try {
      await onSave({
        ...f,
        monto_original: parseFloat(f.monto_original),
        tasa_mensual: parseFloat(f.tasa_mensual),
        comision: parseFloat(f.comision || 0),
        num_cuotas: parseInt(f.num_cuotas),
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
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
              Editar Préstamo
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>{f.prestatario}</p>
          </div>
          <button type="button" onClick={onClose}
            style={{ color: 'var(--color-bw-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-bw-white)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-bw-muted)'}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label style={labelStyle}>Prestatario *</label>
                <input value={f.prestatario} onChange={e => setF({ ...f, prestatario: e.target.value })}
                  placeholder="Nombre de quien recibe el préstamo" required style={inputStyle} />
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Capital Prestado (COP) *</label>
                <input type="number" step="0.01" value={f.monto_original}
                  onChange={e => setF({ ...f, monto_original: e.target.value })}
                  placeholder="Ej: 2000000" required style={inputStyle} />
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Tasa Mensual (%) *</label>
                <input type="number" step="0.01" min="0" value={f.tasa_mensual}
                  onChange={e => setF({ ...f, tasa_mensual: e.target.value })}
                  placeholder="Ej: 2.5" required style={inputStyle} />
                {parseFloat(f.tasa_mensual) > 0 && (
                  <p className="text-xs mt-1 text-violet-400">
                    ≈ {calcEA(parseFloat(f.tasa_mensual))}% E.A. compuesta · {calcNA(parseFloat(f.tasa_mensual))}% N.A.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Comisión / Cargo Fijo (COP)</label>
                <input type="number" step="0.01" min="0" value={f.comision}
                  onChange={e => setF({ ...f, comision: e.target.value })}
                  placeholder="Ej: 100000" style={inputStyle} />
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Número de Cuotas *</label>
                <input type="number" min="1" value={f.num_cuotas}
                  onChange={e => setF({ ...f, num_cuotas: e.target.value })}
                  placeholder="Ej: 12" required style={inputStyle} />
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Fecha de Inicio *</label>
                <input type="date" value={f.fecha_inicio}
                  onChange={e => setF({ ...f, fecha_inicio: e.target.value })}
                  required style={inputStyle} />
              </div>

              <div className="space-y-1">
                <label style={labelStyle}>Estado *</label>
                <select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={inputStyle}>
                  <option value="activo">Activo</option>
                  <option value="pagado">Pagado / Completado</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label style={labelStyle}>Notas</label>
                <textarea rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })}
                  placeholder="Observaciones adicionales..." style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
            <button type="button" onClick={onClose} className="bw-btn-ghost text-sm px-5 py-2.5">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors disabled:opacity-50"
              style={{ borderRadius: 0 }}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}