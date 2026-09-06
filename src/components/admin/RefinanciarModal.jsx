// RefinanciarModal.jsx
import React, { useState } from 'react';
import { HandCoins, X, AlertCircle, Check } from 'lucide-react';

const S = {
    card: { background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' },
    raised: { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)' },
    divider: { borderTop: '1px solid var(--color-bw-border)' },
    input: { background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border-strong)', color: 'var(--color-bw-white)', borderRadius: 0, width: '100%', padding: '0.5rem 0.625rem', fontSize: 'var(--text-bw-sm)' },
    label: { color: 'var(--color-bw-muted)', fontSize: 'var(--text-bw-xs)', display: 'block', marginBottom: '0.25rem' },
};

const API_URL = import.meta.env.PUBLIC_API_URL + '/prestamos.php';
const fmt = (n) => parseFloat(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });

export default function RefinanciarModal({ prestamo, onClose, onSuccess }) {
    const [fechaRefinanciacion, setFechaRefinanciacion] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [nuevaTasa, setNuevaTasa] = useState(prestamo?.tasa_mensual || '');
    const [nuevoPlazo, setNuevoPlazo] = useState(prestamo?.num_cuotas || '');
    const [perdonIntereses, setPerdonIntereses] = useState('');
    const [notas, setNotas] = useState('');
    const [calculando, setCalculando] = useState(false);
    const [ejecutando, setEjecutando] = useState(false);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);

    const handleCalcular = async () => {
        if (!fechaRefinanciacion) {
            setError('Selecciona una fecha de refinanciación');
            return;
        }
        if (!nuevoPlazo || parseInt(nuevoPlazo) <= 0) {
            setError('El nuevo plazo debe ser mayor a 0 meses');
            return;
        }
        setCalculando(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}?action=calcular_refinanciacion`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prestamo_id: prestamo.id,
                    fecha_refinanciacion: fechaRefinanciacion,
                    nueva_tasa: nuevaTasa ? parseFloat(nuevaTasa) : null,
                    nuevo_plazo: parseInt(nuevoPlazo),
                    perdon_intereses: parseFloat(perdonIntereses || 0)
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al calcular');
            }
            const data = await res.json();
            setPreview(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setCalculando(false);
        }
    };

    const handleEjecutar = async () => {
        if (!preview) {
            setError('Calcula primero la refinanciación');
            return;
        }
        if (!confirm('⚠️ ¿Confirmas la refinanciación?\n\nSe creará un NUEVO préstamo con los términos calculados.\nEl préstamo original quedará marcado como refinanciado.')) return;

        setEjecutando(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}?action=ejecutar_refinanciacion`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prestamo_id: prestamo.id,
                    fecha_refinanciacion: fechaRefinanciacion,
                    nueva_tasa: nuevaTasa ? parseFloat(nuevaTasa) : null,
                    nuevo_plazo: parseInt(nuevoPlazo),
                    perdon_intereses: parseFloat(perdonIntereses || 0),
                    notas: notas
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error al ejecutar refinanciación');
            }
            const data = await res.json();
            if (onSuccess) onSuccess(data);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setEjecutando(false);
        }
    };

    const saldoCapital = parseFloat(prestamo?.saldo_capital || prestamo?.monto_original || 0);
    const tasaOriginal = parseFloat(prestamo?.tasa_mensual || 0);
    const plazoOriginal = parseInt(prestamo?.num_cuotas || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)' }}>
            <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border-strong)' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 sticky top-0 z-10" style={{ background: 'var(--color-bw-surface)', borderBottom: '1px solid var(--color-bw-border)' }}>
                    <div>
                        <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-bw-white)' }}>
                            <HandCoins size={18} className="text-violet-400" />
                            Refinanciación de Deuda
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-bw-muted)' }}>
                            {prestamo?.prestatario} · Capital: {fmt(saldoCapital)} · {tasaOriginal}% mensual
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="transition-colors p-1 hover:bg-white/5"
                        style={{ color: 'var(--color-bw-muted)' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Error */}
                    {error && (
                        <div className="p-3 text-sm flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Información del préstamo original */}
                    <div className="p-3" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-bw-muted)' }}>📋 Préstamo Original</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                                <span style={{ color: 'var(--color-bw-muted)' }}>Saldo capital:</span>
                                <span className="font-medium block" style={{ color: 'var(--color-bw-white)' }}>{fmt(saldoCapital)}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--color-bw-muted)' }}>Tasa:</span>
                                <span className="font-medium block text-violet-400">{tasaOriginal}% mensual</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--color-bw-muted)' }}>Plazo:</span>
                                <span className="font-medium block" style={{ color: 'var(--color-bw-white)' }}>{plazoOriginal} meses</span>
                            </div>
                        </div>
                    </div>

                    {/* Formulario */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label style={S.label}>Fecha de Refinanciación *</label>
                            <input
                                type="date"
                                value={fechaRefinanciacion}
                                onChange={e => setFechaRefinanciacion(e.target.value)}
                                style={S.input}
                            />
                            <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>
                                Los intereses se calculan desde la creación hasta esta fecha
                            </p>
                        </div>
                        <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label style={S.label}>Nueva Tasa Mensual (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={nuevaTasa}
                                onChange={e => setNuevaTasa(e.target.value)}
                                placeholder="Dejar vacío = misma tasa"
                                style={S.input}
                            />
                        </div>
                        <div className="space-y-1">
                            <label style={S.label}>Nuevo Plazo (meses) *</label>
                            <input
                                type="number"
                                min="1"
                                value={nuevoPlazo}
                                onChange={e => setNuevoPlazo(e.target.value)}
                                placeholder="Ej: 12"
                                style={S.input}
                            />
                        </div>
                        <div className="space-y-1">
                            <label style={S.label}>Perdón de Intereses (COP)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={perdonIntereses}
                                onChange={e => setPerdonIntereses(e.target.value)}
                                placeholder="Ej: 50000"
                                style={S.input}
                            />
                            <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>
                                Descuento sobre intereses acumulados
                            </p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label style={S.label}>Notas adicionales</label>
                            <input
                                value={notas}
                                onChange={e => setNotas(e.target.value)}
                                placeholder="Motivo de la refinanciación, acuerdo con el deudor, etc."
                                style={S.input}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCalcular}
                        disabled={calculando}
                        className="w-full py-2.5 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        style={{ background: '#7c3aed', borderRadius: 0 }}
                    >
                        {calculando ? '⏳ Calculando...' : '📊 Calcular Refinanciación'}
                    </button>

                    {/* Vista Previa */}
                    {preview && (
                        <div className="p-4" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }}>
                            <p className="text-xs font-semibold text-violet-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <Check size={14} /> Vista Previa
                            </p>

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div className="p-2" style={{ background: 'var(--color-bw-raised)' }}>
                                    <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>Saldo Original</p>
                                    <p className="font-bold text-red-400">{fmt(preview.saldo_original_capital)}</p>
                                </div>
                                <div className="p-2" style={{ background: 'var(--color-bw-raised)' }}>
                                    <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>Interés Compuesto</p>
                                    <p className="font-bold text-orange-400">{fmt(preview.interes_acumulado_bruto)}</p>
                                </div>
                                {preview.perdon_intereses > 0 && (
                                    <div className="p-2" style={{ background: 'var(--color-bw-raised)' }}>
                                        <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>✂️ Perdón</p>
                                        <p className="font-bold text-emerald-400">-{fmt(preview.perdon_intereses)}</p>
                                    </div>
                                )}
                                <div className="p-2" style={{ background: 'var(--color-bw-raised)', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>🆕 Nuevo Saldo</p>
                                    <p className="font-bold text-xl" style={{ color: '#c4b5fd' }}>{fmt(preview.nuevo_saldo)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs p-2" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <div>
                                    <span style={{ color: 'var(--color-bw-muted)' }}>Cuota mensual:</span>
                                    <span className="font-bold block text-emerald-400">{fmt(preview.cuota_mensual)}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-bw-muted)' }}>Total a pagar:</span>
                                    <span className="font-bold block" style={{ color: 'var(--color-bw-white)' }}>{fmt(preview.total_a_pagar)}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-bw-muted)' }}>Interés total:</span>
                                    <span className="font-bold block text-orange-400">{fmt(preview.intereses_totales)}</span>
                                </div>
                            </div>

                            <div className="flex gap-1 text-[10px] mt-2" style={{ color: 'var(--color-bw-muted)' }}>
                                <span>📅 Primer pago: <strong style={{ color: 'var(--color-bw-secondary)' }}>{preview.fecha_primer_pago}</strong></span>
                                <span className="mx-1">·</span>
                                <span>⏱️ {preview.meses_atraso} meses atrasados</span>
                                <span className="mx-1">·</span>
                                <span>Tasa: <strong className="text-violet-400">{preview.tasa_nueva}%</strong></span>
                            </div>

                            {/* Tabla preview */}
                            {preview.tabla_preview && preview.tabla_preview.length > 0 && (
                                <div className="mt-3 max-h-40 overflow-y-auto">
                                    <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-bw-muted)' }}>📋 Plan de pagos (primeras cuotas):</p>
                                    <table className="w-full text-[10px]">
                                        <thead>
                                            <tr style={{ color: 'var(--color-bw-muted)' }}>
                                                <th className="text-left">#</th>
                                                <th className="text-left">Fecha</th>
                                                <th className="text-right">Cuota</th>
                                                <th className="text-right">Capital</th>
                                                <th className="text-right">Interés</th>
                                                <th className="text-right">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.tabla_preview.map((c, i) => (
                                                c['...'] ? (
                                                    <tr key={i}><td colSpan="6" className="text-center text-gray-600">···</td></tr>
                                                ) : (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--color-bw-border)' }}>
                                                        <td className="py-0.5">{c.cuota}</td>
                                                        <td className="py-0.5" style={{ color: 'var(--color-bw-secondary)' }}>{c.fecha}</td>
                                                        <td className="py-0.5 text-right" style={{ color: 'var(--color-bw-white)' }}>{fmt(c.cuota_total)}</td>
                                                        <td className="py-0.5 text-right text-blue-400">{fmt(c.capital)}</td>
                                                        <td className="py-0.5 text-right text-orange-400">{fmt(c.interes)}</td>
                                                        <td className="py-0.5 text-right" style={{ color: 'var(--color-bw-secondary)' }}>{fmt(c.saldo)}</td>
                                                    </tr>
                                                )
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--color-bw-border)' }}>
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm"
                            style={{ color: 'var(--color-bw-muted)' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleEjecutar}
                            disabled={!preview || ejecutando}
                            className="px-6 py-2.5 text-white text-sm font-medium transition-colors disabled:opacity-50 ml-auto"
                            style={{ background: '#059669', borderRadius: 0 }}
                        >
                            {ejecutando ? '⏳ Ejecutando...' : '✅ Ejecutar Refinanciación'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}