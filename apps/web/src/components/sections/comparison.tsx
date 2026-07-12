import { Reveal } from '../reveal';

const ROWS = [
  ['Personalizar CV por vacante', 'Manual, horas por semana', 'Automático con IA'],
  ['Enviar aplicaciones', 'Rellenar cada formulario', 'Un toque'],
  ['Seguimiento', 'Hoja de cálculo', 'Dashboard en tiempo real'],
  ['Encontrar vacantes', 'Buscar en 10 portales', 'Agregadas y con match'],
  ['Coach de carrera', 'No incluido', 'IA disponible 24/7'],
];

export function Comparison() {
  return (
    <section id="comparison" className="bg-surface/40 py-24">
      <div className="mx-auto max-w-4xl px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">La diferencia</p>
            <h2 className="mt-3 text-balance font-display text-4xl text-foreground">
              Nab vs. la forma tradicional
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 text-left font-medium text-muted"></th>
                  <th className="p-4 text-left font-medium text-muted">La forma tradicional</th>
                  <th className="rounded-t-sm bg-primary-soft p-4 text-left font-semibold text-primary">
                    Con Nab
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, old, nab]) => (
                  <tr key={label} className="border-b border-border/60">
                    <td className="p-4 font-medium text-foreground">{label}</td>
                    <td className="p-4 text-muted">{old}</td>
                    <td className="bg-primary-soft/40 p-4 text-foreground">✓ {nab}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
