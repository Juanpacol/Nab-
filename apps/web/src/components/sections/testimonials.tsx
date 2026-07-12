import { Card } from '@nab/ui';
import { Reveal } from '../reveal';

const TESTIMONIALS = [
  {
    quote:
      'Conseguí tres entrevistas en mi primera semana. Nab hizo en minutos lo que me tomaba horas cada noche.',
    name: 'Camila R.',
    role: 'Product Designer · contratada en Figma',
  },
  {
    quote:
      'El CV que generó pasó todos los filtros. Antes ni me respondían; ahora tengo problemas de agenda.',
    name: 'Andrés M.',
    role: 'Backend Engineer · contratado en Stripe',
  },
  {
    quote:
      'El coach de IA me preparó para cada entrevista. Vale cada peso. Se lo recomendé a todo mi equipo.',
    name: 'Valentina T.',
    role: 'Data Analyst · contratada en Netflix',
  },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Historias reales</p>
          <h2 className="mt-3 text-balance font-display text-4xl text-foreground">
            De buscar empleo a elegir oferta
          </h2>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <Card className="flex h-full flex-col p-6">
              <p className="flex-1 font-display text-lg italic leading-relaxed text-foreground">
                “{t.quote}”
              </p>
              <div className="mt-6">
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="text-sm text-muted">{t.role}</p>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
