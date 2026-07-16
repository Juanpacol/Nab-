/**
 * Seed de datos demo para desarrollo.
 * Crea: extensión pgvector, un usuario demo con perfil, ~20 vacantes,
 * algunas aplicaciones de ejemplo, artículos de ayuda para el bot de soporte,
 * guías de entrevista (RAG de la rúbrica de pruebas técnicas), y una empresa
 * demo del lado B2B con una vacante + prueba técnica + candidatos evaluados.
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

  // --- Guías de entrevista (RAG de la rúbrica de pruebas técnicas, PR B9) ---
  // Editorial inicial — el sistema de generación ya funciona sin esto vía
  // role_spec + standard; estas guías habilitan citas "internal_guide"
  // adicionales cuando el retrieval semántico encuentra una relevante.
  const guides = [
    {
      slug: 'principios-solid',
      title: 'Principios SOLID',
      category: 'diseño',
      content:
        'SOLID es un acrónimo de cinco principios de diseño orientado a objetos que reducen el acoplamiento y facilitan el mantenimiento: (S) Responsabilidad única — una clase debe tener una sola razón para cambiar. (O) Abierto/cerrado — el código debe estar abierto a extensión pero cerrado a modificación. (L) Sustitución de Liskov — los subtipos deben poder reemplazar a su tipo base sin alterar la corrección del programa. (I) Segregación de interfaces — es mejor tener varias interfaces específicas que una general. (D) Inversión de dependencias — depende de abstracciones, no de implementaciones concretas. Un candidato sólido reconoce estos principios en código real y explica el trade-off de aplicarlos (más indirección) frente a no aplicarlos (más rigidez).',
    },
    {
      slug: 'diseno-apis-rest',
      title: 'Diseño de APIs REST',
      category: 'backend',
      content:
        'Una API REST bien diseñada usa sustantivos en las rutas (no verbos: /users, no /getUsers), los métodos HTTP expresan la acción (GET, POST, PATCH, DELETE), y los códigos de estado son semánticamente correctos (200 éxito, 201 creado, 400 error del cliente, 401/403 auth, 404 no encontrado, 409 conflicto, 500 error del servidor). El versionado (vía path /v1/ o header) evita romper clientes existentes. La paginación (cursor o offset) es obligatoria en listados grandes. Los errores deben tener un formato consistente y accionable, no solo un mensaje genérico. Idempotencia importa: un PUT/DELETE repetido debe producir el mismo resultado. Un buen candidato distingue cuándo anidar recursos (/users/:id/posts) y cuándo no, y sabe justificar sus decisiones de diseño con los consumidores de la API en mente.',
    },
    {
      slug: 'piramide-de-testing',
      title: 'Pirámide de testing',
      category: 'calidad',
      content:
        'La pirámide de testing sugiere una base grande de tests unitarios (rápidos, aislados, prueban una unidad de lógica), una capa media de tests de integración (verifican que varios componentes trabajan juntos: DB real, colas, APIs internas) y una cima pequeña de tests end-to-end (simulan al usuario real, son lentos y frágiles). Invertir la pirámide (muchos E2E, pocos unitarios) produce suites lentas y difíciles de depurar. Un candidato competente sabe qué tipo de test escribir para cada situación, entiende mocks vs. fakes vs. stubs, y valora tests que fallan por la razón correcta (no tests frágiles que se rompen con cualquier refactor). También reconoce cuándo NO vale la pena testear algo (código trivial, configuración).',
    },
    {
      slug: 'complejidad-algoritmica',
      title: 'Complejidad algorítmica (Big O)',
      category: 'algoritmos',
      content:
        'La notación Big O describe cómo crece el tiempo/espacio de un algoritmo según el tamaño de la entrada, en el peor caso. Órdenes comunes de mejor a peor: O(1) constante, O(log n) logarítmico (búsqueda binaria), O(n) lineal, O(n log n) (sorts eficientes), O(n²) cuadrático (bucles anidados), O(2^n) exponencial. Un candidato competente identifica la complejidad de su propia solución, reconoce cuándo una estructura de datos (hash map vs. array vs. árbol) cambia la complejidad de una operación, y entiende el trade-off espacio-tiempo (ej. memoización). Más importante que memorizar la notación es saber razonar sobre por qué una solución escala mal con datos reales y proponer una alternativa.',
    },
    {
      slug: 'indices-de-bases-de-datos',
      title: 'Índices de bases de datos',
      category: 'backend',
      content:
        'Un índice acelera las consultas (WHERE, JOIN, ORDER BY) a costa de espacio en disco y de ralentizar escrituras (cada INSERT/UPDATE debe actualizar también el índice). Un índice B-tree (el default en la mayoría de motores) es eficiente para igualdad y rangos; un índice sobre múltiples columnas solo es útil si la consulta usa las columnas en el mismo orden del índice (o un prefijo). Indexar una columna de baja cardinalidad (ej. un booleano) rara vez ayuda. Un candidato competente sabe leer un plan de ejecución (EXPLAIN) para diagnosticar un full table scan, entiende cuándo un índice compuesto reemplaza a varios índices simples, y no indexa "por si acaso" — cada índice tiene costo real de mantenimiento.',
    },
    {
      slug: 'owasp-top-10',
      title: 'OWASP Top 10 — seguridad web básica',
      category: 'seguridad',
      content:
        'El OWASP Top 10 resume los riesgos de seguridad más comunes en aplicaciones web. Los más relevantes para una entrevista técnica: inyección (SQL/NoSQL — mitigado con queries parametrizadas, nunca concatenación de strings), fallas de control de acceso (verificar SIEMPRE del lado del servidor que el usuario autenticado puede acceder al recurso pedido, nunca confiar en un id del cliente), fallas criptográficas (nunca guardar contraseñas en texto plano, usar bcrypt/argon2), XSS (sanitizar/escapar output antes de renderizar HTML dinámico), y configuración de seguridad incorrecta (headers faltantes, CORS demasiado permisivo, secretos en el código). Un candidato competente no necesita memorizar la lista completa, pero sí debe reconocer estos patrones en código real y proponer la mitigación correcta sin exagerar (seguridad también tiene costo de complejidad).',
    },
    {
      slug: 'code-review-efectivo',
      title: 'Code review efectivo',
      category: 'colaboración',
      content:
        'Un buen code review se enfoca en corrección, legibilidad, y mantenibilidad — no en preferencias de estilo que ya debería resolver un linter automático. Comentarios efectivos son específicos y accionables ("esta query N+1 puede tumbar la DB con datos reales" en vez de "esto está mal"), separan bloqueantes de sugerencias opcionales, y explican el porqué, no solo el qué. El autor del PR debe responder a cada comentario, no solo resolverlo en silencio. Un candidato competente sabe dar feedback constructivo sin ser condescendiente, y también sabe RECIBIR feedback sin ponerse a la defensiva — la habilidad de colaborar bien en equipo es tan evaluable como la habilidad técnica pura.',
    },
    {
      slug: 'patrones-de-diseno-basicos',
      title: 'Patrones de diseño básicos (GoF)',
      category: 'diseño',
      content:
        'Los patrones de diseño son soluciones reutilizables a problemas recurrentes de diseño de software. Los más relevantes en la práctica diaria: Factory (centraliza la creación de objetos complejos), Singleton (una única instancia global — usar con cuidado, dificulta testing), Observer (notifica a varios suscriptores cuando cambia un estado — base de los sistemas de eventos), Strategy (encapsula algoritmos intercambiables detrás de una interfaz común), y Decorator (añade comportamiento a un objeto sin modificar su clase). Un candidato competente no busca aplicar patrones por aplicarlos — reconoce cuándo un patrón resuelve un problema real de su código y cuándo solo añade complejidad innecesaria ("patrón por el patrón" es una señal de alerta, no de fortaleza).',
    },
    {
      slug: 'ci-cd-basico',
      title: 'CI/CD y despliegue continuo',
      category: 'devops',
      content:
        'Integración continua (CI) significa que cada cambio se integra a la rama principal frecuentemente, corriendo automáticamente tests y linters antes de fusionar — detecta problemas temprano, cuando son baratos de arreglar. Despliegue continuo (CD) automatiza el paso de código verificado a producción, típicamente con etapas (staging → producción) y la posibilidad de rollback rápido si algo falla. Un pipeline sólido incluye: build reproducible, suite de tests que corre en minutos (no horas), y checks de seguridad/calidad automatizados. Un candidato competente entiende la diferencia entre CI y CD, sabe por qué un pipeline lento mata la productividad del equipo, y reconoce el valor de feature flags para desacoplar el despliegue del release.',
    },
    {
      slug: 'microservicios-vs-monolito',
      title: 'Microservicios vs. monolito',
      category: 'arquitectura',
      content:
        'Un monolito es más simple de desarrollar, testear y desplegar al inicio de un proyecto — todo el código vive en un solo lugar, sin la complejidad de comunicación entre servicios. Microservicios permiten escalar equipos y componentes de forma independiente, pero introducen complejidad real: latencia de red entre servicios, consistencia eventual de datos, necesidad de observabilidad distribuida (tracing, logs centralizados), y más superficie operacional. La recomendación común de la industria es empezar con un monolito bien modularizado y extraer servicios solo cuando hay una razón concreta (escalar un componente específico, equipos que necesitan desplegar independiente). Un candidato competente no asume que "microservicios = mejor" — sabe articular el costo real de esa complejidad y cuándo se justifica.',
    },
    {
      slug: 'manejo-de-errores-y-logging',
      title: 'Manejo de errores y logging',
      category: 'backend',
      content:
        'Un buen manejo de errores distingue errores esperables (input inválido de usuario, recurso no encontrado — se manejan con respuestas claras) de errores inesperados (bugs, fallas de infraestructura — se registran y alertan). Nunca silenciar un catch vacío: como mínimo, registrar el error con contexto suficiente para diagnosticarlo después. Los logs estructurados (JSON con campos consistentes) son más útiles que strings libres porque permiten buscar y agregar. Información sensible (contraseñas, tokens, datos personales) nunca debe aparecer en logs. Un candidato competente diseña el manejo de errores pensando en quien va a depurar el problema a las 3am con solo los logs disponibles — no solo en que el "happy path" funcione en la demo.',
    },
    {
      slug: 'git-workflow',
      title: 'Control de versiones con Git — flujo de trabajo',
      category: 'colaboración',
      content:
        'Un buen flujo de Git usa ramas de feature cortas (idealmente menos de unos días de vida) para minimizar conflictos de merge, mensajes de commit que explican el PORQUÉ del cambio (no solo qué archivo se tocó), y commits atómicos (un cambio lógico por commit, fácil de revertir si algo sale mal). Rebase interactivo sirve para limpiar el historial antes de un PR, pero nunca se debe hacer rebase sobre una rama compartida que otros ya tienen clonada. Un candidato competente sabe resolver un conflicto de merge entendiendo AMBOS cambios (no solo aceptando "el mío" o "el suyo" a ciegas), y entiende la diferencia práctica entre merge y rebase, y cuándo usar cada uno según el contexto del equipo.',
    },
    {
      slug: 'escalabilidad-y-caching',
      title: 'Escalabilidad y caching',
      category: 'backend',
      content:
        'Cachear datos reduce la carga sobre la fuente de verdad (base de datos, API externa) pero introduce el problema clásico de invalidación: decidir cuándo un dato cacheado ya no es válido. Estrategias comunes: TTL (expira después de N segundos, simple pero puede servir datos obsoletos), invalidación activa (borrar la caché cuando el dato subyacente cambia, más preciso pero más complejo), y cache-aside (la aplicación consulta la caché primero, y si falla va a la fuente y la rellena). Escalar horizontalmente (más instancias) requiere que la aplicación sea stateless — el estado de sesión debe vivir en un store compartido (Redis), no en memoria de un solo proceso. Un candidato competente sabe identificar el cuello de botella real antes de proponer cachear algo — cachear sin medir primero es una optimización prematura.',
    },
    {
      slug: 'accesibilidad-web',
      title: 'Accesibilidad web (a11y)',
      category: 'frontend',
      content:
        'La accesibilidad web asegura que personas con discapacidades visuales, motoras o cognitivas puedan usar un producto. Prácticas base: HTML semántico (usar <button> para botones, no un <div> con onClick — los lectores de pantalla entienden el semántico gratis), texto alternativo en imágenes, contraste de color suficiente (mínimo 4.5:1 para texto normal según WCAG AA), navegación completa por teclado (sin trampas de foco), y labels asociados a cada input de formulario. Un candidato competente en frontend reconoce estos problemas en código real, no solo los recita de memoria — por ejemplo, identifica que un modal sin manejo de foco es un problema real de accesibilidad, no un detalle cosmético.',
    },
    {
      slug: 'comunicacion-tecnica',
      title: 'Comunicación técnica y documentación',
      category: 'colaboración',
      content:
        'Documentar una decisión técnica importante (por qué se eligió X sobre Y, qué trade-offs se consideraron) ahorra tiempo futuro a todo el equipo, incluido el propio autor seis meses después. Un buen README explica cómo correr el proyecto localmente en menos de 5 minutos, no la arquitectura completa. Comunicar un bloqueo o retraso temprano (en vez de callarlo hasta el último día) es una señal de madurez profesional tan importante como la habilidad técnica. Un candidato competente explica conceptos técnicos complejos en términos que una persona no técnica pueda seguir, sin condescendencia ni jerga innecesaria — esta habilidad es especialmente evaluable en preguntas abiertas de una prueba técnica.',
    },
  ];
  for (const g of guides) {
    await prisma.interviewGuide.upsert({
      where: { slug: g.slug },
      update: { title: g.title, content: g.content, category: g.category },
      create: g,
    });
  }

  // --- Empresa demo (lado B2B) ---
  const DEMO_RH_EMAIL = 'rh-demo@nab.app';
  const rhUser = await prisma.user.upsert({
    where: { email: DEMO_RH_EMAIL },
    update: {},
    create: {
      email: DEMO_RH_EMAIL,
      name: 'RH Demo',
      plan: Plan.PRO,
      creditsRemaining: 100,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.creditLedger.upsert({
    where: { id: `seed-grant-${rhUser.id}` },
    update: {},
    create: { id: `seed-grant-${rhUser.id}`, userId: rhUser.id, delta: 100, reason: 'SUBSCRIPTION_GRANT', refId: 'seed' },
  });

  const company = await prisma.company.upsert({
    where: { slug: 'nab-demo-co' },
    update: {},
    create: { name: 'Nab Demo Co', slug: 'nab-demo-co', description: 'Empresa demo para explorar el portal de RH.' },
  });
  await prisma.companyMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: rhUser.id } },
    update: {},
    create: { companyId: company.id, userId: rhUser.id, role: 'OWNER' },
  });

  const roleSpecDemo =
    'Buscamos un Ingeniero Backend con experiencia sólida en Node.js y PostgreSQL, capaz de diseñar APIs REST mantenibles y trabajar en equipo con comunicación clara.';
  const demoJob = await prisma.job.upsert({
    where: { source_externalId: { source: JobSourceProvider.COMPANY, externalId: 'demo-company-job-1' } },
    update: {},
    create: {
      source: JobSourceProvider.COMPANY,
      externalId: 'demo-company-job-1',
      title: 'Ingeniero Backend (Demo)',
      company: company.name,
      companyId: company.id,
      location: 'Remoto',
      remote: true,
      description: roleSpecDemo,
      applyUrl: null,
      postedAt: new Date(),
      isActive: true,
    },
  });

  const demoQuestions = [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: '¿Qué principio favorece el bajo acoplamiento entre módulos?',
      skillTags: ['diseño'],
      estimatedMinutes: 5,
      options: [
        { id: 'a', text: 'Inversión de dependencias' },
        { id: 'b', text: 'Variables globales compartidas' },
        { id: 'c', text: 'Copiar y pegar código entre módulos' },
      ],
      correctOptionId: 'a',
      explanation: 'La inversión de dependencias reduce el acoplamiento directo entre módulos.',
    },
    {
      id: 'q2',
      type: 'open_text',
      prompt: 'Describe cómo diseñarías el endpoint REST para listar aplicantes de una vacante, con paginación.',
      skillTags: ['backend', 'api'],
      estimatedMinutes: 10,
      expectedPoints: ['Paginación cursor u offset', 'Códigos de estado correctos', 'Filtros opcionales'],
    },
    {
      id: 'q3',
      type: 'code',
      prompt: 'Escribe una función que valide si una cadena de paréntesis está balanceada.',
      skillTags: ['algoritmos'],
      estimatedMinutes: 15,
      language: 'typescript',
      starterCode: 'function isBalanced(s: string): boolean {\n  // tu código aquí\n}',
      expectedApproach: 'Usar una pila (stack): apilar al abrir, desapilar al cerrar, verificar que quede vacía.',
    },
  ];
  const demoRubric = {
    criteria: [
      {
        id: 'c1',
        name: 'Fundamentos técnicos',
        description: 'Conocimiento de principios de diseño de software.',
        weight: 0.34,
        levels: [
          { score: 0, descriptor: 'No demuestra comprensión.' },
          { score: 3, descriptor: 'Comprensión parcial.' },
          { score: 5, descriptor: 'Dominio claro con ejemplos.' },
        ],
        appliesTo: ['q1'],
        references: [
          {
            reference: { kind: 'standard', standardId: 'solid-principles' },
            verification: { status: 'verified', method: 'catalog' },
          },
        ],
      },
      {
        id: 'c2',
        name: 'Diseño de APIs',
        description: 'Capacidad de diseñar APIs REST mantenibles.',
        weight: 0.33,
        levels: [
          { score: 0, descriptor: 'No aplica principios REST.' },
          { score: 3, descriptor: 'Diseño funcional pero incompleto.' },
          { score: 5, descriptor: 'Diseño robusto con paginación y códigos correctos.' },
        ],
        appliesTo: ['q2'],
        references: [
          {
            reference: { kind: 'role_spec', quote: 'diseñar APIs REST mantenibles', note: 'spec' },
            verification: { status: 'verified', method: 'substring' },
          },
        ],
      },
      {
        id: 'c3',
        name: 'Resolución de problemas',
        description: 'Capacidad algorítmica y limpieza del código.',
        weight: 0.33,
        levels: [
          { score: 0, descriptor: 'No resuelve el problema.' },
          { score: 3, descriptor: 'Solución parcial o ineficiente.' },
          { score: 5, descriptor: 'Solución correcta y eficiente.' },
        ],
        appliesTo: ['q3'],
        references: [
          {
            reference: { kind: 'standard', standardId: 'clean-code' },
            verification: { status: 'verified', method: 'catalog' },
          },
        ],
      },
    ],
    passThreshold: 60,
  };

  const demoTest = await prisma.techTest.upsert({
    where: { id: 'demo-tech-test-1' },
    update: {},
    create: {
      id: 'demo-tech-test-1',
      companyId: company.id,
      createdByUserId: rhUser.id,
      title: 'Prueba Backend (Demo)',
      roleSpec: roleSpecDemo,
      status: 'READY',
      questionsJson: demoQuestions,
      rubricJson: demoRubric,
      model: 'claude-sonnet-5',
      timeLimitMinutes: 45,
      passScore: 60,
    },
  });
  await prisma.job.update({ where: { id: demoJob.id }, data: { techTestId: demoTest.id } });

  // Dos candidatos demo evaluados — uno aprueba, uno no — para que
  // dashboard/candidatos/comparativa tengan datos reales desde el primer login.
  const DEMO_CANDIDATES = [
    { email: 'candidato-demo-1@nab.app', name: 'Ana Demo', finalScore: 82, passed: true },
    { email: 'candidato-demo-2@nab.app', name: 'Luis Demo', finalScore: 45, passed: false },
  ];
  for (const [i, c] of DEMO_CANDIDATES.entries()) {
    const candidateUser = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, name: c.name, plan: Plan.FREE, creditsRemaining: 5, emailVerifiedAt: new Date() },
    });
    const application = await prisma.application.upsert({
      where: { userId_jobId: { userId: candidateUser.id, jobId: demoJob.id } },
      update: {},
      create: {
        userId: candidateUser.id,
        jobId: demoJob.id,
        status: 'APPLIED',
        method: 'MANUAL',
        submittedAt: new Date(Date.now() - (i + 1) * 86400000),
      },
    });
    const submission = await prisma.testSubmission.upsert({
      where: { applicationId: application.id },
      update: {},
      create: {
        id: `demo-submission-${i + 1}`,
        techTestId: demoTest.id,
        applicationId: application.id,
        userId: candidateUser.id,
        jobId: demoJob.id,
        status: 'EVALUATED',
        answersJson: [
          { questionId: 'q1', answer: 'a' },
          { questionId: 'q2', answer: 'Usaría paginación por cursor y devolvería 200 con metadata de siguiente página.' },
          {
            questionId: 'q3',
            answer:
              'function isBalanced(s) { const stack = []; for (const ch of s) { if (ch === "(") stack.push(ch); else if (ch === ")") { if (!stack.pop()) return false; } } return stack.length === 0; }',
          },
        ],
        startedAt: new Date(Date.now() - (i + 1) * 86400000),
        submittedAt: new Date(Date.now() - (i + 1) * 86400000 + 1800000),
        timeSpentSeconds: 1800,
        evaluationAttempt: 1,
      },
    });
    await prisma.candidateEvaluation.upsert({
      where: { submissionId: submission.id },
      update: {},
      create: {
        submissionId: submission.id,
        aiScoresJson: [
          { criterionId: 'c1', score: c.passed ? 5 : 3, justification: 'Evaluación demo.', evidence: [], confidence: 'high' },
          { criterionId: 'c2', score: c.passed ? 4 : 2, justification: 'Evaluación demo.', evidence: [], confidence: 'medium' },
          { criterionId: 'c3', score: c.passed ? 4 : 2, justification: 'Evaluación demo.', evidence: [], confidence: 'medium' },
        ],
        aiSummary: c.passed
          ? 'Candidato con fundamentos sólidos y buena comunicación técnica.'
          : 'Candidato con brechas en diseño de APIs y resolución de problemas.',
        aiStrengths: c.passed ? ['Buen manejo de principios de diseño', 'Respuestas claras'] : ['Completó la prueba a tiempo'],
        aiWeaknesses: c.passed ? [] : ['Diseño de API incompleto', 'Solución algorítmica ineficiente'],
        aiHighlights: c.passed ? ['Justificó bien el uso de paginación por cursor'] : [],
        aiTotalScore: c.finalScore,
        aiModel: 'claude-sonnet-5',
        evaluatedAt: new Date(),
        injectionSuspected: false,
        finalScore: c.finalScore,
        passed: c.passed,
      },
    });
  }

  console.log(
    `✅ Listo: usuario demo (${DEMO_EMAIL}), ${jobs.length} vacantes, 6 aplicaciones, ${articles.length} artículos, ${guides.length} guías de entrevista, empresa demo (${DEMO_RH_EMAIL}) con 1 vacante + prueba + ${DEMO_CANDIDATES.length} candidatos evaluados.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
