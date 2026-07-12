import type { NormalizedJob } from '@nab/shared';
import type { JobAdapter } from './types.js';

const COMPANIES = ['Airbnb', 'Stripe', 'Figma', 'Netflix', 'Plaid', 'Notion', 'Vercel', 'Linear'];
const ROLES = [
  'Ingeniero de Software Frontend',
  'Ingeniero de Software Backend',
  'Ingeniero Full Stack',
  'Diseñador de Producto',
  'Product Manager',
  'Ingeniero de Datos',
  'Ingeniero DevOps',
  'Ingeniero de Machine Learning',
  'Diseñador UX',
  'Analista de Datos',
];
const LOCATIONS = ['Remoto', 'Ciudad de México', 'Bogotá', 'Madrid', 'Buenos Aires', 'Remoto (LATAM)'];
const SKILLS = ['TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS', 'Go', 'Figma'];

/**
 * Genera vacantes demo deterministas para desarrollo local sin fuentes reales.
 * Idéntico en espíritu al seed, pero produce más variedad para probar filtros.
 */
export class MockAdapter implements JobAdapter {
  readonly provider = 'MOCK';

  constructor(private readonly count = 40) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    const jobs: NormalizedJob[] = [];
    for (let i = 0; i < this.count; i++) {
      const company = COMPANIES[i % COMPANIES.length]!;
      const role = ROLES[i % ROLES.length]!;
      const location = LOCATIONS[i % LOCATIONS.length]!;
      const skills = [SKILLS[i % SKILLS.length], SKILLS[(i + 3) % SKILLS.length]];
      jobs.push({
        source: 'MOCK',
        externalId: `mock-${i + 1}`,
        title: role,
        company,
        location,
        remote: i % 2 === 0,
        description: `En ${company} buscamos un ${role}. Trabajarás con ${skills.join(
          ' y ',
        )} construyendo productos usados por millones de personas. Ofrecemos crecimiento, equipo sólido y buen salario.`,
        salaryMin: 50000 + i * 1500,
        salaryMax: 90000 + i * 2500,
        currency: 'USD',
        atsType: 'mock',
        applyUrl: `https://example.com/apply/mock-${i + 1}`,
        postedAt: new Date(Date.now() - i * 43200000),
      });
    }
    return jobs;
  }
}
