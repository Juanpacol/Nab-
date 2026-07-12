/**
 * Seed de datos demo para desarrollo.
 * Crea: extensión pgvector, un usuario demo con perfil, ~20 vacantes,
 * algunas aplicaciones de ejemplo y artículos de ayuda para el bot de soporte.
 *
 * Ejecutar: pnpm db:seed
 */
import { PrismaClient, Plan, ApplicationStatus, JobSourceProvider } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@nab.app';

const COMPANIES = [
  { name: 'Airbnb', ats: 'greenhouse' },
  { name: 'Stripe', ats: 'greenhouse' },
  { name: 'Figma', ats: 'greenhouse' },
  { name: 'Netflix', ats: 'lever' },
  { name: 'Plaid', ats: 'lever' },
  { name: 'Notion', ats: 'greenhouse' },
  { name: 'Vercel', ats: 'lever' },
  { name: 'Linear', ats: 'greenhouse' },
];

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

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length] as T;
}

async function main() {
  console.log('🌱 Sembrando datos demo de Nab...');

  // Asegurar extensión pgvector (idempotente).
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');

  // --- Usuario demo ---
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Usuario Demo',
      plan: Plan.PRO,
      creditsRemaining: 200,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          headline: 'Ingeniero Full Stack · React & Node',
          summary:
            'Ingeniero con 5 años de experiencia construyendo productos web escalables con TypeScript, React y Node.js.',
          skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Next.js'],
          locations: ['Remoto', 'Ciudad de México'],
          desiredRoles: ['Ingeniero Full Stack', 'Ingeniero Frontend'],
          salaryMin: 60000,
          salaryMax: 110000,
        },
      },
    },
  });

  // Registrar el grant inicial de créditos en el ledger (idempotente por refId).
  await prisma.creditLedger.upsert({
    where: { id: `seed-grant-${user.id}` },
    update: {},
    create: {
      id: `seed-grant-${user.id}`,
      userId: user.id,
      delta: 200,
      reason: 'SUBSCRIPTION_GRANT',
      refId: 'seed',
    },
  });

  // --- Vacantes ---
  const jobs = [];
  for (let i = 0; i < 20; i++) {
    const company = pick(COMPANIES, i);
    const role = pick(ROLES, i);
    const externalId = `demo-${i + 1}`;
    const job = await prisma.job.upsert({
      where: { source_externalId: { source: JobSourceProvider.MOCK, externalId } },
      update: {},
      create: {
        source: JobSourceProvider.MOCK,
        externalId,
        title: role,
        company: company.name,
        location: pick(LOCATIONS, i),
        remote: i % 2 === 0,
        description: `En ${company.name} buscamos un ${role} para unirse a nuestro equipo. Trabajarás con tecnologías modernas construyendo productos usados por millones de personas. Requisitos: experiencia sólida en desarrollo, trabajo en equipo y comunicación efectiva.`,
        salaryMin: 50000 + i * 2000,
        salaryMax: 90000 + i * 3000,
        currency: 'USD',
        atsType: company.ats,
        applyUrl: `https://example.com/apply/${externalId}`,
        postedAt: new Date(Date.now() - i * 86400000),
        isActive: true,
      },
    });
    jobs.push(job);
  }

  // --- Aplicaciones demo ---
  const statuses: ApplicationStatus[] = [
    ApplicationStatus.SAVED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
  ];
  for (let i = 0; i < 6; i++) {
    const job = jobs[i]!;
    await prisma.application.upsert({
      where: { userId_jobId: { userId: user.id, jobId: job.id } },
      update: {},
      create: {
        userId: user.id,
        jobId: job.id,
        status: pick(statuses, i),
        matchScore: 70 + i * 3,
        submittedAt: i > 0 ? new Date(Date.now() - i * 43200000) : null,
        events: {
          create: { eventType: 'created', payload: { source: 'seed' } },
        },
      },
    });
  }

  // --- Artículos de ayuda (bot de soporte) ---
  const articles = [
    {
      slug: 'como-funciona-nab',
      title: '¿Cómo funciona Nab?',
      content:
        'Nab agrega ofertas de empleo, genera CVs y cartas personalizadas con IA, y te permite aplicar con un toque. Sigue tus aplicaciones desde el dashboard.',
      category: 'general',
    },
    {
      slug: 'planes-y-creditos',
      title: 'Planes y créditos',
      content:
        'Cada plan incluye una cantidad de créditos mensuales. Cada aplicación consume 1 crédito. Planes: Basic (80), Pro (200), Ultra (600).',
      category: 'facturacion',
    },
    {
      slug: 'compatibilidad-ats',
      title: 'Compatibilidad con ATS',
      content:
        'Los CVs generados por Nab están optimizados para pasar los filtros de sistemas ATS, con palabras clave relevantes para cada vacante.',
      category: 'funcionalidad',
    },
  ];
  for (const a of articles) {
    await prisma.helpArticle.upsert({
      where: { slug: a.slug },
      update: { title: a.title, content: a.content, category: a.category },
      create: a,
    });
  }

  console.log(`✅ Listo: usuario demo (${DEMO_EMAIL}), ${jobs.length} vacantes, 6 aplicaciones, ${articles.length} artículos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
