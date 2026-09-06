import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DistributionChart({ data }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(item => ({
    name: item.categoria,
    value: parseFloat(item.total)
  }));

  return (
    <div style={{ background: 'var(--color-bw-surface)', border: '1px solid var(--color-bw-border)' }} className="p-6">
      <h3
        className="text-base font-semibold mb-4"
        style={{ color: 'var(--color-bw-white)', letterSpacing: 'var(--tracking-bw-tight)' }}
      >
        Distribución por Categoría
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => value.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
            contentStyle={{
              background: 'var(--color-bw-surface)',
              border: '1px solid var(--color-bw-border-strong)',
              borderRadius: 0,
              color: 'var(--color-bw-primary)',
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--color-bw-secondary)', fontSize: 'var(--text-bw-xs)' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}