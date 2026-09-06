import React, { useEffect, useState } from 'react';
import { X, Settings, ChevronUp, ChevronDown } from 'lucide-react';

const KEY_PREFIX = 'bw.admin.openSections.';

// Definición de secciones disponibles con su orden por defecto
const SECTION_DEFS = [
  { key: 'metrics', label: 'Métricas generales' },
  { key: 'brandlab', label: 'BrandLab' },
  { key: 'portafolio', label: 'Portafolio General' },
  { key: 'cuenta', label: 'Cuenta Bancaria' },
  { key: 'herramientas', label: 'Herramientas e Inventario' },
  { key: 'ingresar', label: 'Ingresar Operación' },
  { key: 'prestamos', label: 'Préstamos' },
  { key: 'graficos', label: 'Análisis de Portafolio' },
  { key: 'vendidos', label: 'Inversiones Liquidadas' },
];

const DEFAULT_PREFS = {
  metrics: { visible: true, open: true, accordion: true, order: 0 },
  brandlab: { visible: true, open: false, accordion: true, order: 1 },
  portafolio: { visible: true, open: false, accordion: true, order: 2 },
  cuenta: { visible: true, open: false, accordion: true, order: 3 },
  herramientas: { visible: true, open: false, accordion: true, order: 4 },
  ingresar: { visible: true, open: false, accordion: true, order: 5 },
  prestamos: { visible: true, open: false, accordion: true, order: 6 },
  graficos: { visible: true, open: false, accordion: true, order: 7 },
  vendidos: { visible: true, open: false, accordion: true, order: 8 },
};

// Subcomponente: Checkbox técnico alineado al Design System
const SquareCheck = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer group select-none">
    
    {/* EL INPUT OCULTO QUE FALTABA */}
    <input 
      type="checkbox" 
      className="hidden" 
      checked={checked} 
      onChange={onChange} 
    />
    
    <div 
      className={`w-4 h-4 border flex items-center justify-center transition-colors duration-[var(--duration-bw-fast)] ease-[var(--ease-bw)]
      ${checked 
        ? 'bg-[var(--color-bw-white)] border-[var(--color-bw-white)] text-[var(--color-bw-black)]' 
        : 'border-[var(--color-bw-border-strong)] text-transparent group-hover:border-[var(--color-bw-secondary)]'
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
      </svg>
    </div>
    <span className={`text-[var(--text-bw-xs)] font-medium tracking-[var(--tracking-bw-wider)] uppercase transition-colors duration-[var(--duration-bw-fast)]
      ${checked ? 'text-[var(--color-bw-white)]' : 'text-[var(--color-bw-muted)] group-hover:text-[var(--color-bw-secondary)]'}`}
    >
      {label}
    </span>
  </label>
);

export default function PanelSettings({ userId, open, onClose, onSave }) {
  const key = KEY_PREFIX + (userId || 'guest');
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = {};
        SECTION_DEFS.forEach(({ key: k }) => {
          merged[k] = { ...DEFAULT_PREFS[k], ...(parsed[k] || {}) };
        });
        setPrefs(merged);
      } else {
        setPrefs(DEFAULT_PREFS);
      }
    } catch (e) { 
      setPrefs(DEFAULT_PREFS); 
    }
  }, [open, key]);

  function update(key, field, value) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], [field]: value } }));
  }

  function move(index, dir) {
    const ordered = [...SECTION_DEFS].sort((a, b) => prefs[a.key].order - prefs[b.key].order);
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[newIndex];
    setPrefs(p => ({
      ...p,
      [a.key]: { ...p[a.key], order: p[b.key].order },
      [b.key]: { ...p[b.key], order: p[a.key].order },
    }));
  }

  function save() {
    localStorage.setItem(key, JSON.stringify(prefs));
    if (onSave) onSave(prefs);
    onClose();
    // Nota: window.location.reload() es agresivo en React. 
    // Si tu app depende del estado global, considera actualizarlo vía props/context en lugar de recargar.
    window.location.reload();
  }

  const ordered = [...SECTION_DEFS].sort((a, b) => prefs[a.key].order - prefs[b.key].order);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-bw-fade-in backdrop-blur-sm">
      <div 
        className="w-full max-w-2xl bg-[var(--color-bw-surface)] border border-[var(--color-bw-border-strong)] p-6 md:p-8 flex flex-col shadow-[var(--shadow-bw-lg)]"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="flex items-center gap-2 text-[var(--color-bw-white)] font-display text-[var(--text-bw-xl)] font-semibold tracking-[var(--tracking-bw-tight)] mb-1">
              <Settings size={20} className="text-[var(--color-bw-secondary)]" /> 
              Preferencias del Panel
            </h2>
            <p className="text-[var(--text-bw-sm)] text-[var(--color-bw-muted)]">
              Personaliza el orden, visibilidad y comportamiento de cada módulo.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-[var(--color-bw-muted)] hover:text-[var(--color-bw-white)] transition-colors duration-[var(--duration-bw-fast)] p-1"
            aria-label="Cerrar preferencias"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bw-divider mb-6"></div>

        {/* Lista de Secciones */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-6">
          {ordered.map((sec, i) => {
            const p = prefs[sec.key];
            return (
              <div 
                key={sec.key} 
                className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-[var(--color-bw-raised)] border border-[var(--color-bw-border)] hover:border-[var(--color-bw-border-strong)] transition-colors duration-[var(--duration-bw-fast)]"
              >
                {/* Controles de orden */}
                <div className="flex md:flex-col gap-1 items-center border-r border-[var(--color-bw-border)] pr-4 mr-2">
                  <button 
                    onClick={() => move(i, -1)} 
                    disabled={i === 0} 
                    className="text-[var(--color-bw-muted)] hover:text-[var(--color-bw-white)] disabled:opacity-20 disabled:hover:text-[var(--color-bw-muted)] transition-colors"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button 
                    onClick={() => move(i, 1)} 
                    disabled={i === ordered.length - 1} 
                    className="text-[var(--color-bw-muted)] hover:text-[var(--color-bw-white)] disabled:opacity-20 disabled:hover:text-[var(--color-bw-muted)] transition-colors"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                {/* Título de la sección */}
                <div className="flex-1">
                  <span className="text-[var(--text-bw-base)] text-[var(--color-bw-primary)] font-medium">
                    {sec.label}
                  </span>
                </div>

                {/* Controles (Checkboxes) */}
                <div className="flex flex-wrap items-center gap-6">
                  <SquareCheck 
                    checked={!!p.visible} 
                    onChange={() => update(sec.key, 'visible', !p.visible)} 
                    label="Visible" 
                  />
                  <SquareCheck 
                    checked={!!p.accordion} 
                    onChange={() => update(sec.key, 'accordion', !p.accordion)} 
                    label="Acordeón" 
                  />
                  <SquareCheck 
                    checked={!!p.open} 
                    onChange={() => update(sec.key, 'open', !p.open)} 
                    label="Abierto" 
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / Actions */}
        <div className="pt-6 border-t border-[var(--color-bw-border)] flex justify-end gap-4 mt-auto">
          <button onClick={onClose} className="bw-btn-ghost">
            Descartar
          </button>
          <button onClick={save} className="bw-btn-primary">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}