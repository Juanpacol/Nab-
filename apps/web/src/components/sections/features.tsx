import { Card } from '@nab/ui';
import { Reveal } from '../reveal';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Personalización con IA',
    desc: 'CV y carta de presentación adaptados a cada vacante, optimizados para pasar los filtros ATS.',
  },
  {
    icon: '⚡',
    title: 'Aplica con un toque',
    desc: 'Desliza para aplicar. Nab completa formularios y envía tu solicitud sin que tú lo hagas.',
  },
  {
    icon: '📱',
    title: 'Web y móvil sincronizados',
    desc: 'Empieza en el escritorio, continúa en el teléfono. Todo en tiempo real.',
  },
  {
    icon: '📊',
    title: 'Seguimiento inteligente',
    desc: 'Un dashboard unificado con el estado de cada aplicación, entrevistas y respuestas.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Cómo funciona</p>
          <h2 className="mt-3 text-balance font-display text-4xl text-foreground">
            Cuatro cosas que hacen el trabajo pesado por ti
          </h2>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <Card className="h-full p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary-soft text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-xl text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
