import React, { useState } from 'react';

const TABS = [
  {
    key: 'creemos',
    label: 'En qué creemos',
    text: 'La educación es la herramienta más poderosa para transformar sociedades e impulsar a la humanidad. Creemos que la solución primordial para todos los problemas actuales de la humanidad es la educación, y que esta es una herramienta que nos permite construir y crear conocimiento que nos impulse como seres humanos para superar las dificultades que no permiten que exista equidad en el mundo.',
  },
  {
    key: 'invertimos',
    label: 'En qué invertimos',
    text: 'Diversificamos nuestro capital en mercados financieros globales, fondos de inversión colectiva, divisas y activos que garanticen rentabilidad sostenible. Cada inversión es evaluada bajo criterios de riesgo, retorno y alineación con nuestros valores institucionales.',
  },
  {
    key: 'hacemos',
    label: 'Por qué lo hacemos',
    text: 'Invertimos para generar recursos que permitan financiar proyectos de educación. Nuestra visión a largo plazo incluye el financiamiento de becas educativas, apoyo a causas sociales y la construcción de oportunidades para quienes más lo necesitan. El rendimiento financiero es el medio, la transformación social es el fin.',
  },
];

export default function Tabs() {
  const [active, setActive] = useState(TABS[0].key);

  const activeTab = TABS.find(t => t.key === active);

  return (
    <div className="w-full max-w-4xl mx-auto">

      {/* Navegación — borde inferior como referencia de la línea activa */}
      <nav
        role="tablist"
        aria-label="Secciones principales"
        className="flex flex-col sm:flex-row justify-center items-stretch sm:items-end gap-0 mb-14"
        style={{ borderBottom: '1px solid var(--color-bw-border)' }}
      >
        {TABS.map(tab => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className="relative px-6 py-4 text-base font-medium transition-colors duration-200 text-left sm:text-center focus-visible:outline-none"
              style={{
                color: isActive
                  ? 'var(--color-bw-white)'
                  : 'var(--color-bw-muted)',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-bw-secondary)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = 'var(--color-bw-muted)';
              }}
            >
              {tab.label}

              {/* Línea activa debajo del tab — se extiende hasta el borde del nav */}
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 right-0 transition-all duration-300 origin-left"
                style={{
                  height: '1px',
                  background: 'var(--color-bw-white)',
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                }}
              />
            </button>
          );
        })}
      </nav>

      {/* Panel de contenido con fade */}
      <div
        key={active}
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="animate-fadeIn px-2 sm:px-0"
      >
        <p
          className="text-center text-lg sm:text-xl max-w-3xl mx-auto"
          style={{
            color: 'var(--color-bw-secondary)',
            lineHeight: 'var(--leading-bw-relaxed)',
          }}
        >
          {activeTab?.text}
        </p>
      </div>
    </div>
  );
}