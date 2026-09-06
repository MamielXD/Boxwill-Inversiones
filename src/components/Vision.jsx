import React from 'react';
import { ArrowUpRight } from 'lucide-react';

const PARAGRAPHS = [
  'Boxwill Inversiones no es solo un vehículo de generación de riqueza. Es un compromiso con la humanidad, la equidad y la transformación social a través de la educación.',
  'Nuestro objetivo a mediano plazo es financiar proyectos educativos y apoyar iniciativas que democraticen el acceso al conocimiento y la investigación.',
];

const CLOSING_NOTE =
  'Cada inversión que realizamos hoy es un paso hacia un futuro donde la educación sea el motor de cambio que construya un mundo más equitativo.';

export default function Vision() {
  return (
    <section
      className="w-full max-w-3xl mx-auto px-4"
      aria-labelledby="vision-heading"
    >
      <div className="bw-side-rule">

        {/* Eyebrow */}
        <p className="bw-eyebrow mb-6">Visión a futuro</p>

        {/* Heading — sans-serif bold, tracking apretado */}
        <h2
          id="vision-heading"
          className="text-3xl md:text-4xl font-bold mb-8"
          style={{
            fontFamily: 'var(--font-bw-display)',
            letterSpacing: 'var(--tracking-bw-tight)',
            lineHeight: 'var(--leading-bw-tight)',
            color: 'var(--color-bw-white)',
          }}
        >
          Capital que construye<br />un mundo mejor.
        </h2>

        {/* Cuerpo */}
        <div className="space-y-4 mb-8">
          {PARAGRAPHS.map((p, i) => (
            <p
              key={i}
              style={{
                color: 'var(--color-bw-secondary)',
                lineHeight: 'var(--leading-bw-relaxed)',
                fontSize: 'var(--text-bw-lg)',
              }}
            >
              {p}
            </p>
          ))}

          <p
            className="italic"
            style={{
              color: 'var(--color-bw-muted)',
              lineHeight: 'var(--leading-bw-relaxed)',
              fontSize: 'var(--text-bw-base)',
            }}
          >
            {CLOSING_NOTE}
          </p>
        </div>

        {/* CTA — puente hacia boxwill.com */}
        <div
          className="pt-6"
          style={{ borderTop: '1px solid var(--color-bw-border)' }}
        >
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--color-bw-muted)' }}
          >
            ¿Quieres conocer más sobre quiénes somos?
          </p>
          <a
            href="https://boxwill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="bw-btn-primary"
          >
            Conoce Boxwill
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}