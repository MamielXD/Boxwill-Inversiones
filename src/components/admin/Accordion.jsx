import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Accordion({ title, defaultOpen = false, alwaysOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen || alwaysOpen);

  // Si es "siempre abierto", mostramos el contenido sin el estilo de acordeón
  if (alwaysOpen) {
    return (
      <div className="mb-4">
        <div className="p-3 mb-2" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)', color: 'var(--color-bw-white)', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ background: 'var(--color-bw-surface)' }}>{children}</div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex justify-between items-center p-3" style={{ background: 'var(--color-bw-raised)', border: '1px solid var(--color-bw-border)' }}>
        <div style={{ color: 'var(--color-bw-white)', fontWeight: 600 }}>{title}</div>
        <div style={{ color: 'var(--color-bw-muted)' }}>{open ? <ChevronUp /> : <ChevronDown />}</div>
      </button>
      {open ? <div className="p-3" style={{ border: '1px solid var(--color-bw-border)', borderTop: 'none', background: 'var(--color-bw-surface)' }}>{children}</div> : null}
    </div>
  );
}
