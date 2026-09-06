import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet, AlertTriangle, CheckCircle2, Crown } from 'lucide-react';

// Helpers de superficie para no repetir inline styles
const S = {
  card: {
    background: 'var(--color-bw-surface)',
    border: '1px solid var(--color-bw-border)',
  },
  cardAccent: (color) => ({
    background: 'var(--color-bw-surface)',
    border: `1px solid ${color}`,
  }),
  label: { color: 'var(--color-bw-muted)', fontSize: 'var(--text-bw-xs)' },
  subtext: { color: 'var(--color-bw-muted)', fontSize: '0.65rem' },
  divider: { borderTop: '1px solid var(--color-bw-border)' },
};

export default function MetricsCards({ metrics, tasaOportunidad, patrimonioData }) {
  if (!metrics) return null;

  const capitalVivo = parseFloat(metrics.capital_vivo) || 0;
  const valorActualVivo = parseFloat(metrics.valor_actual_vivo) || capitalVivo;
  const costoVendidos = parseFloat(metrics.costo_vendidos) || 0;

  const saldoBanco = patrimonioData?.saldoBanco || 0;
  const totalEsperado = patrimonioData?.totalEsperado || 0;
  const capitalEnCalle = patrimonioData?.capitalEnCalle || 0;
  const totalInteresRecibido = patrimonioData?.totalInteresRecibido || 0;
  const totalPrestado = patrimonioData?.totalPrestado || 0;
  const valorInventario = parseFloat(metrics.valor_inventario) || 0;

  const gananciaLiquida = (parseFloat(metrics.ganancia_liquida) || 0) + totalInteresRecibido;
  const costoHistorico = (parseFloat(metrics.costo_historico) || 0) + totalPrestado;
  const roiReal = costoHistorico > 0 ? (gananciaLiquida / costoHistorico) * 100 : 0;
  const roiMensualActual = parseFloat(metrics.roi_mensual_actual || 0);

  const gananciaVentasAccionesBolsa = parseFloat(metrics.ganancia_ventas_acciones_bolsa) || 0;
  const dividendosAccionesBolsa = parseFloat(metrics.dividendos_acciones_bolsa) || 0;
  const gananciaAccionesBolsa = gananciaVentasAccionesBolsa + dividendosAccionesBolsa;
  const esGananciaBolsa = gananciaAccionesBolsa >= 0;

  const esGanancia = gananciaLiquida >= 0;
  const ganaAlBenchmark = roiReal >= tasaOportunidad;

  const patrimonioTotal = saldoBanco + valorActualVivo + capitalEnCalle + valorInventario;
  const patrimonioConEsperado = patrimonioTotal + totalEsperado;

  return (
    <div className="space-y-4 mb-8">

      {/* Patrimonio Total — card prominente */}
      <div
        className="p-6 relative overflow-hidden"
        style={{
          background: 'var(--color-bw-surface)',
          border: '1px solid rgba(217, 179, 70, 0.25)',
        }}
      >
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: 'rgba(217,179,70,0.12)', border: '1px solid rgba(217,179,70,0.2)' }}
            >
              <Crown size={14} className="text-yellow-500" />
            </div>
            <div>
              <span className="text-sm font-semibold text-yellow-200">Patrimonio Total</span>
              <p className="text-[10px]" style={{ color: 'var(--color-bw-muted)' }}>Net Worth (Activos − Pasivos)</p>
            </div>
          </div>

          <p
            className="text-3xl font-bold mb-1"
            style={{ color: 'var(--color-bw-white)', letterSpacing: 'var(--tracking-bw-tight)' }}
          >
            {patrimonioTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
          </p>
          {totalEsperado > 0 && (
            <p className="text-xs text-yellow-600 mb-4">
              + {totalEsperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })} por cobrar → Total potencial:{' '}
              {patrimonioConEsperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
            </p>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4" style={S.divider}>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={S.label}>Cash (Banco)</p>
              <p className={`text-sm font-bold ${saldoBanco >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {saldoBanco.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={S.label}>Inversiones</p>
              <p className="text-sm font-bold text-blue-400">
                {valorActualVivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={S.label}>Préstamos (x cobrar)</p>
              <p className="text-sm font-bold text-emerald-400">
                {capitalEnCalle.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={S.label}>Inventario</p>
              <p className="text-sm font-bold text-orange-400">
                {valorInventario.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={S.label}>Esperados</p>
              <p className="text-sm font-bold text-yellow-500">
                {totalEsperado.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas secundarias — fila 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 flex flex-col justify-between" style={S.card}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>Patrimonio (Activos)</span>
              <Wallet size={18} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-bw-white)' }}>
              {valorActualVivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-3 pt-3 flex flex-col gap-1 text-[11px]" style={{ ...S.divider, color: 'var(--color-bw-muted)' }}>
            <div className="flex justify-between">
              <span>Capital Invertido (Base):</span>
              <span style={{ color: 'var(--color-bw-primary)' }}>
                {capitalVivo.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Variación no realizada:</span>
              <span className={valorActualVivo >= capitalVivo ? 'text-green-400' : 'text-red-400'}>
                {valorActualVivo > capitalVivo ? '+' : ''}
                {(valorActualVivo - capitalVivo).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col justify-between" style={S.card}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>Capital Recuperado</span>
              <DollarSign size={18} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-bw-white)' }}>
              {((parseFloat(metrics.total_recuperado) || 0) - (parseFloat(metrics.total_rendimientos_cuenta) || 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-3 pt-3 flex flex-col gap-1 text-[11px]" style={{ ...S.divider, color: 'var(--color-bw-muted)' }}>
            <div className="flex justify-between">
              <span>Ventas de capital:</span>
              <span className="text-emerald-400">
                {((parseFloat(metrics.total_recuperado) || 0) - (parseFloat(metrics.total_dividendos) || 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dividendos cobrados:</span>
              <span className="text-emerald-400">
                +{(parseFloat(metrics.total_dividendos) || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
            {parseFloat(metrics.total_esperado || 0) > 0 && (
              <div className="flex justify-between mt-1 pt-1 font-medium" style={S.divider}>
                <span>Por cobrar (Pendiente):</span>
                <span className="text-yellow-500">
                  + {parseFloat(metrics.total_esperado).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas de rendimiento — fila 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6" style={S.cardAccent(esGanancia ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>Ganancia Liquidada</span>
            {esGanancia
              ? <TrendingUp size={18} className="text-green-500" />
              : <TrendingDown size={18} className="text-red-500" />
            }
          </div>
          <p className={`text-2xl font-bold ${esGanancia ? 'text-green-500' : 'text-red-500'}`}>
            {esGanancia ? '+' : ''}{gananciaLiquida.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 flex flex-col gap-1 text-[11px]" style={{ ...S.divider, color: 'var(--color-bw-muted)' }}>
            <div className="flex justify-between">
              <span>Ventas + Dividendos + Rendimientos:</span>
              <span className="text-emerald-400">{(parseFloat(metrics.total_recuperado) || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Intereses de préstamos:</span>
              <span className="text-emerald-400">+{totalInteresRecibido.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Costo lo vendido:</span>
              <span className="text-red-400">-{parseFloat(metrics.costo_vendidos || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between mt-1 pt-1 font-medium" style={{ ...S.divider, color: 'var(--color-bw-secondary)' }}>
              <span>Utilidad bruta:</span>
              <span className={((parseFloat(metrics.total_recuperado || 0) + parseFloat(totalInteresRecibido || 0) - parseFloat(metrics.costo_vendidos || 0)) >= 0) ? 'text-green-400' : 'text-red-400'}>
                {((parseFloat(metrics.total_recuperado || 0)) + (parseFloat(totalInteresRecibido || 0)) - (parseFloat(metrics.costo_vendidos || 0))).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Gastos bancarios gen.:</span>
              <span className="text-red-400">-{parseFloat(metrics.total_gastos_banco || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Nómina Dir. (Retirada):</span>
              <span className="text-purple-400">-{parseFloat(metrics.total_nomina || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="p-6" style={S.cardAccent(ganaAlBenchmark ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>ROI Promedio % (Negocio)</span>
            {ganaAlBenchmark
              ? <CheckCircle2 size={18} className="text-green-400" />
              : <AlertTriangle size={18} className={gananciaLiquida > 0 ? 'text-yellow-500' : 'text-red-500'} />
            }
          </div>
          <p className={`text-2xl font-bold ${esGanancia ? 'text-green-500' : 'text-red-500'}`}>
            {esGanancia ? '+' : ''}{roiReal.toFixed(2)}%
          </p>
          <div className="mt-3 pt-3 flex flex-col gap-1 text-[11px]" style={{ ...S.divider, color: 'var(--color-bw-muted)' }}>
            <div className="flex justify-between">
              <span>Tasa de Oportunidad (Banco):</span>
              <span style={{ color: 'var(--color-bw-secondary)' }}>{tasaOportunidad}%</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Diferencia vs Banco:</span>
              <span className={ganaAlBenchmark ? 'text-green-400' : (gananciaLiquida > 0 ? 'text-yellow-500' : 'text-red-400')}>
                {ganaAlBenchmark ? '+' : ''}{(roiReal - tasaOportunidad).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>ROI Mensual Actual:</span>
              <span style={{ color: 'var(--color-bw-secondary)' }}>{roiMensualActual.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="p-6" style={S.cardAccent(esGananciaBolsa ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--color-bw-secondary)' }}>Acciones en Bolsa</span>
            {esGananciaBolsa
              ? <TrendingUp size={18} className="text-green-500" />
              : <TrendingDown size={18} className="text-red-500" />
            }
          </div>
          <p className={`text-2xl font-bold ${esGananciaBolsa ? 'text-green-500' : 'text-red-500'}`}>
            {esGananciaBolsa ? '+' : ''}{gananciaAccionesBolsa.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
          </p>
          <div className="mt-3 pt-3 flex flex-col gap-1 text-[11px] max-w-sm" style={{ ...S.divider, color: 'var(--color-bw-muted)' }}>
            <div className="flex justify-between">
              <span>Ganancia neta de ventas:</span>
              <span className={gananciaVentasAccionesBolsa >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {gananciaVentasAccionesBolsa >= 0 ? '+' : ''}{gananciaVentasAccionesBolsa.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dividendos cobrados:</span>
              <span className="text-emerald-400">+{dividendosAccionesBolsa.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Ratio dividendos/ventas:</span>
              <span style={{ color: 'var(--color-bw-secondary)' }}>
                {gananciaVentasAccionesBolsa !== 0 ? ((dividendosAccionesBolsa / gananciaVentasAccionesBolsa) * 100).toFixed(2) + '%' : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
