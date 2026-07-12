import { Reveal } from '../reveal';

const FAQS = [
  {
    q: '¿Cómo genera Nab mi CV y carta?',
    a: 'Nuestra IA analiza cada vacante y adapta tu CV y carta usando tu experiencia real, resaltando lo relevante y optimizando para los filtros ATS. Siempre puedes revisar y editar antes de enviar.',
  },
  {
    q: '¿De dónde salen las ofertas de empleo?',
    a: 'Agregamos vacantes desde bolsas de trabajo verificadas y páginas de carreras oficiales de las empresas, actualizadas a diario.',
  },
  {
    q: '¿Es compatible con los sistemas ATS?',
    a: 'Sí. Los documentos que genera Nab están estructurados con las palabras clave adecuadas para superar los filtros automáticos más comunes.',
  },
  {
    q: '¿Qué pasa si se me acaban los créditos?',
    a: 'Puedes esperar al siguiente ciclo mensual o cambiar de plan en cualquier momento. Los créditos no usados no se acumulan.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Claro. No hay contratos ni permanencia. Cancelas desde tu panel con un clic.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-24">
      <Reveal>
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Preguntas</p>
          <h2 className="mt-3 text-balance font-display text-4xl text-foreground">
            Lo que la gente suele preguntar
          </h2>
        </div>
      </Reveal>
      <div className="mt-12 space-y-3">
        {FAQS.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.05}>
            <details className="group rounded border border-border bg-surface p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground">
                {item.q}
                <span className="text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
