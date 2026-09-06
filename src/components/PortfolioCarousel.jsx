import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    eyebrow: 'Renta Variable',
    title: 'Mercados Financieros',
    desc: 'Inversión estratégica en ETFs indexados, acciones de empresas consolidadas y divisas internacionales. Diversificación geográfica para mitigar riesgos y maximizar retornos a largo plazo.',
    img: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=600&fit=crop',
  },
  {
    id: 2,
    eyebrow: 'Gestión Colectiva',
    title: 'Fondos de Inversión Colectiva',
    desc: 'Participación en fondos administrados profesionalmente con enfoque en rentabilidad sostenible. Balance entre renta fija y variable según condiciones del mercado.',
    img: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop',
  },
  {
    id: 3,
    eyebrow: 'Próximamente',
    title: 'Impacto Social',
    desc: 'Próximamente: financiamiento de becas educativas, apoyo a proyectos de transformación social y generación de oportunidades para comunidades vulnerables.',
    img: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1200&h=600&fit=crop',
    soon: true,
  },
];

export default function PortfolioCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent(c => (c + 1) % SLIDES.length), []);
  const prev = useCallback(() => setCurrent(c => (c - 1 + SLIDES.length) % SLIDES.length), []);
  const goTo = useCallback(idx => setCurrent(idx), []);

  return (
    <div
      className="relative w-full"
      role="region"
      aria-label="Portafolio de inversiones"
      aria-roledescription="carrusel"
    >
      {/* Track — sin overflow visible, sin border-radius */}
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: `transform var(--duration-bw-slow) var(--ease-bw)`,
          }}
        >
          {SLIDES.map((slide, idx) => (
            <article
              key={slide.id}
              className="min-w-full relative"
              aria-hidden={idx !== current}
              aria-roledescription="slide"
              aria-label={slide.title}
            >
              <div
                className="relative bg-black"
                style={{ height: 'clamp(300px, 48vw, 500px)' }}
              >
                {/* Imagen con opacidad controlada */}
                <img
                  src={slide.img}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover"
                  style={{ opacity: slide.soon ? 0.15 : 0.3 }}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />

                {/* Gradiente pronunciado — legibilidad primero */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.6) 45%, rgba(0,0,0,0.05) 100%)',
                  }}
                />

                {/* Línea de acento superior — marca técnica */}
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'var(--color-bw-border)' }}
                />

                {/* Contenido */}
                <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                  <div className="max-w-2xl">
                    {/* Eyebrow */}
                    <p
                      className="bw-eyebrow mb-3"
                      style={{
                        color: slide.soon
                          ? 'var(--color-bw-muted)'
                          : 'var(--color-bw-accent)',
                      }}
                    >
                      {slide.eyebrow}
                    </p>

                    {/* Título */}
                    <h3
                      className="text-3xl md:text-4xl font-bold mb-4"
                      style={{
                        color: 'var(--color-bw-white)',
                        fontFamily: 'var(--font-bw-display)',
                        letterSpacing: 'var(--tracking-bw-tight)',
                        lineHeight: 'var(--leading-bw-tight)',
                      }}
                    >
                      {slide.title}
                    </h3>

                    {/* Descripción */}
                    <p
                      className="text-base md:text-lg max-w-xl"
                      style={{
                        color: 'var(--color-bw-secondary)',
                        lineHeight: 'var(--leading-bw-normal)',
                      }}
                    >
                      {slide.desc}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Barra inferior: flechas + dots en una línea */}
      <div
        className="flex items-center justify-between mt-0 px-8 md:px-12 py-4"
        style={{ borderTop: '1px solid var(--color-bw-border)' }}
      >
        {/* Flecha anterior */}
        <button
          onClick={prev}
          aria-label="Slide anterior"
          className="p-1 transition-colors duration-150 focus-visible:outline-none"
          style={{ color: 'var(--color-bw-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-bw-white)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-bw-muted)')}
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>

        {/* Dots — líneas horizontales, más técnicas que círculos */}
        <div className="flex items-center gap-3" role="group" aria-label="Navegación de slides">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              aria-label={`Ir al slide ${idx + 1}`}
              aria-current={current === idx ? 'true' : undefined}
              className="focus-visible:outline-none transition-all duration-300"
              style={{
                display: 'block',
                width: current === idx ? '2rem' : '0.75rem',
                height: '1px',
                backgroundColor:
                  current === idx
                    ? 'var(--color-bw-white)'
                    : 'var(--color-bw-border-strong)',
              }}
            />
          ))}
        </div>

        {/* Flecha siguiente */}
        <button
          onClick={next}
          aria-label="Siguiente slide"
          className="p-1 transition-colors duration-150 focus-visible:outline-none"
          style={{ color: 'var(--color-bw-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-bw-white)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-bw-muted)')}
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Accesibilidad: estado del carrusel para lectores de pantalla */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {current + 1} de {SLIDES.length}: {SLIDES[current].title}
      </p>
    </div>
  );
}