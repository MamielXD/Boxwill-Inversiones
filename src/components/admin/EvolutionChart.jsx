import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function EvolutionChart({ data }) {
  if (!data || data.length === 0) return null;

  let acumulado = 0;
  const chartData = data.map(item => {
    acumulado += parseFloat(item.total);
    return { mes: item.mes, total: acumulado };
  });

  return (
    <div style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }} className="p-6">
      <h3
        className="text-base font-semibold mb-4"
        style={{ color: 'var(--color-bw-white)', letterSpacing: 'var(--tracking-bw-tight)' }}
      >
        Evolución del Capital
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-bw-border)" />
          <XAxis
            dataKey="mes"
            stroke="var(--color-bw-muted)"
            tick={{ fill: 'var(--color-bw-muted)', fontSize: 11 }}
          />
          <YAxis
            stroke="var(--color-bw-muted)"
            tick={{ fill: 'var(--color-bw-muted)', fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => value.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
            contentStyle={{
              background: 'var(--color-bw-surface)',
              border: '1px solid var(--color-bw-border-strong)',
              borderRadius: 0,
              color: 'var(--color-bw-primary)',
            }}
            labelStyle={{ color: 'var(--color-bw-secondary)' }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 4, fill: '#60a5fa' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}