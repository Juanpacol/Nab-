/**
 * Pruebas técnicas generadas por IA (lado empresa): preguntas, rúbrica con
 * referencias citadas, y los tipos de entrada/salida de cada paso del
 * pipeline de generación. Ver AiPipelineGuard (.claude/agents/nab-ai-pipeline-guard.md)
 * para los invariantes anti-alucinación que este diseño protege.
 */
import { z } from 'zod';

// ============================================================
// Catálogo de estándares — el LLM solo puede citar slugs de esta lista
// (nunca inventa URLs). Las URLs las pone Nab, no el modelo.
// ============================================================
export interface TechStandard {
  slug: string;
  name: string;
  summary: string;
  url: string;
}

export const TECH_STANDARDS_CATALOG: TechStandard[] = [
  { slug: 'solid-principles', name: 'Principios SOLID', summary: 'Diseño orientado a objetos mantenible.', url: 'https://en.wikipedia.org/wiki/SOLID' },
  { slug: 'owasp-top-10', name: 'OWASP Top 10', summary: 'Los 10 riesgos de seguridad web más críticos.', url: 'https://owasp.org/www-project-top-ten/' },
  { slug: 'twelve-factor-app', name: 'The Twelve-Factor App', summary: 'Metodología para apps SaaS portables y escalables.', url: 'https://12factor.net/' },
  { slug: 'rest-api-design', name: 'Diseño de APIs REST', summary: 'Convenciones de recursos, verbos HTTP y códigos de estado.', url: 'https://restfulapi.net/' },
  { slug: 'database-normalization', name: 'Normalización de bases de datos', summary: 'Formas normales (1NF-3NF) para esquemas relacionales.', url: 'https://en.wikipedia.org/wiki/Database_normalization' },
  { slug: 'acid-transactions', name: 'Transacciones ACID', summary: 'Atomicidad, consistencia, aislamiento, durabilidad.', url: 'https://en.wikipedia.org/wiki/ACID' },
  { slug: 'big-o-notation', name: 'Notación Big-O', summary: 'Análisis de complejidad temporal y espacial de algoritmos.', url: 'https://en.wikipedia.org/wiki/Big_O_notation' },
  { slug: 'data-structures-fundamentals', name: 'Estructuras de datos fundamentales', summary: 'Arrays, listas enlazadas, árboles, hashmaps, grafos.', url: 'https://en.wikipedia.org/wiki/Data_structure' },
  { slug: 'design-patterns-gof', name: 'Patrones de diseño (GoF)', summary: 'Patrones creacionales, estructurales y de comportamiento.', url: 'https://en.wikipedia.org/wiki/Design_Patterns' },
  { slug: 'clean-code', name: 'Clean Code', summary: 'Legibilidad, nombres significativos, funciones pequeñas.', url: 'https://en.wikipedia.org/wiki/Robert_C._Martin' },
  { slug: 'testing-pyramid', name: 'Pirámide de testing', summary: 'Balance entre tests unitarios, de integración y E2E.', url: 'https://martinfowler.com/bliki/TestPyramid.html' },
  { slug: 'ci-cd-fundamentals', name: 'Integración y despliegue continuo', summary: 'Automatización de build, test y release.', url: 'https://en.wikipedia.org/wiki/CI/CD' },
  { slug: 'http-semantics', name: 'Semántica de HTTP', summary: 'Métodos, códigos de estado, cabeceras, caché.', url: 'https://developer.mozilla.org/docs/Web/HTTP' },
  { slug: 'wcag-accessibility', name: 'WCAG (accesibilidad web)', summary: 'Pautas de accesibilidad de contenido web.', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
  { slug: 'agile-scrum', name: 'Agile / Scrum', summary: 'Marco de trabajo iterativo para gestión de proyectos.', url: 'https://en.wikipedia.org/wiki/Scrum_(software_development)' },
  { slug: 'microservices-patterns', name: 'Patrones de microservicios', summary: 'Descomposición de servicios, comunicación, resiliencia.', url: 'https://microservices.io/patterns/index.html' },
  { slug: 'event-driven-architecture', name: 'Arquitectura orientada a eventos', summary: 'Productores/consumidores, colas, event sourcing.', url: 'https://en.wikipedia.org/wiki/Event-driven_architecture' },
  { slug: 'oauth2-oidc', name: 'OAuth 2.0 / OIDC', summary: 'Delegación de autorización y autenticación federada.', url: 'https://oauth.net/2/' },
  { slug: 'idempotency', name: 'Idempotencia', summary: 'Operaciones seguras ante reintentos.', url: 'https://en.wikipedia.org/wiki/Idempotence' },
  { slug: 'caching-strategies', name: 'Estrategias de caché', summary: 'Cache-aside, write-through, invalidación.', url: 'https://en.wikipedia.org/wiki/Cache_(computing)' },
];

const STANDARD_SLUGS = new Set(TECH_STANDARDS_CATALOG.map((s) => s.slug));
export function isKnownStandardSlug(slug: string): boolean {
  return STANDARD_SLUGS.has(slug);
}

// ============================================================
// Referencias de la rúbrica (lo que el LLM puede citar)
// ============================================================
export const rubricReferenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('role_spec'),
    // Cita TEXTUAL de la especificación del rol (se verifica por substring
    // programático — el LLM no puede parafrasear aquí).
    quote: z.string().min(8).max(500),
    note: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal('standard'),
    // Debe existir en TECH_STANDARDS_CATALOG — se verifica por lookup.
    standardId: z.string(),
    note: z.string().max(300).optional(),
  }),
  z.object({
    kind: z.literal('internal_guide'),
    // Debe pertenecer al set de guías recuperadas para esta generación.
    guideId: z.string(),
    excerpt: z.string().max(500),
  }),
]);
export type RubricReference = z.infer<typeof rubricReferenceSchema>;

/** Escrito por el PIPELINE tras verificar cada referencia — nunca por el LLM. */
export const referenceVerificationSchema = z.object({
  status: z.enum(['verified', 'unverified']),
  method: z.enum(['substring', 'catalog', 'retrieval_set']),
});
export type ReferenceVerification = z.infer<typeof referenceVerificationSchema>;

export const verifiedRubricReferenceSchema = z.object({
  reference: rubricReferenceSchema,
  verification: referenceVerificationSchema,
});
export type VerifiedRubricReference = z.infer<typeof verifiedRubricReferenceSchema>;

// ============================================================
// Criterios de rúbrica
// ============================================================
const rubricLevelSchema = z.object({
  score: z.number().int().min(0).max(5),
  descriptor: z.string().max(300),
});

const rubricCriterionBase = {
  id: z.string(),
  name: z.string().max(120),
  description: z.string().max(600),
  weight: z.number().min(0).max(1),
  levels: z.array(rubricLevelSchema).min(3).max(6),
  appliesTo: z.array(z.string()).min(1),
};

/** Forma que se le PIDE al LLM (referencias sin verificar todavía). */
export const draftRubricCriterionSchema = z.object({
  ...rubricCriterionBase,
  references: z.array(rubricReferenceSchema).min(1),
});
export type DraftRubricCriterion = z.infer<typeof draftRubricCriterionSchema>;

/** Forma PERSISTIDA (post-verificación). */
export const rubricCriterionSchema = z.object({
  ...rubricCriterionBase,
  references: z.array(verifiedRubricReferenceSchema).min(1),
});
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export const rubricSchema = z.object({
  criteria: z.array(rubricCriterionSchema).min(2).max(12),
  passThreshold: z.number().min(0).max(100).default(60),
});
export type Rubric = z.infer<typeof rubricSchema>;

// ============================================================
// Preguntas (mismo shape para el draft del LLM y lo persistido — el
// contenido de correctOptionId puede corregirse/eliminarse en verificación,
// pero la forma no cambia).
// ============================================================
const questionBase = {
  id: z.string(),
  prompt: z.string().min(10).max(4000),
  skillTags: z.array(z.string()).default([]),
  estimatedMinutes: z.number().int().min(1).max(60),
};

export const techQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    ...questionBase,
    type: z.literal('multiple_choice'),
    options: z.array(z.object({ id: z.string(), text: z.string().max(500) })).min(3).max(6),
    correctOptionId: z.string(),
    // Justificación de por qué es correcta — no se muestra al candidato,
    // pero obligar al modelo a razonarla reduce claves erróneas en el draft.
    explanation: z.string().max(600),
  }),
  z.object({
    ...questionBase,
    type: z.literal('open_text'),
    // Qué debería tocar una buena respuesta — guía al evaluador, no se muestra al candidato.
    expectedPoints: z.array(z.string()).min(1).max(8),
  }),
  z.object({
    ...questionBase,
    type: z.literal('code'),
    language: z.string().max(40),
    starterCode: z.string().max(4000).optional(),
    // Enfoque esperado — guía al evaluador, no se muestra al candidato.
    expectedApproach: z.string().max(1500),
  }),
]);
export type TechQuestion = z.infer<typeof techQuestionSchema>;

// ============================================================
// Prueba completa
// ============================================================
export const draftTechTestSchema = z
  .object({
    title: z.string().max(160),
    roleTitle: z.string(),
    seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'unknown']),
    durationMinutes: z.number().int().min(15).max(240),
    instructions: z.string().max(2000),
    questions: z.array(techQuestionSchema).min(3).max(25),
    rubric: z.object({
      criteria: z.array(draftRubricCriterionSchema).min(2).max(12),
      passThreshold: z.number().min(0).max(100).default(60),
    }),
  })
  .superRefine((test, ctx) => {
    const qIds = new Set(test.questions.map((q) => q.id));
    for (const q of test.questions) {
      if (q.type === 'multiple_choice' && !q.options.some((o) => o.id === q.correctOptionId)) {
        ctx.addIssue({ code: 'custom', message: `correctOptionId inválido en la pregunta ${q.id}` });
      }
    }
    for (const c of test.rubric.criteria) {
      if (c.appliesTo.some((id) => !qIds.has(id))) {
        ctx.addIssue({ code: 'custom', message: `el criterio ${c.id} referencia preguntas inexistentes` });
      }
    }
    const totalWeight = test.rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.05) {
      ctx.addIssue({ code: 'custom', message: 'los pesos de los criterios deben sumar ~1' });
    }
  });
export type DraftTechTest = z.infer<typeof draftTechTestSchema>;

// ============================================================
// Input de RH
// ============================================================
export const generateTechTestSchema = z.object({
  roleTitle: z.string().min(3).max(160),
  spec: z.string().min(30).max(20_000),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead']).optional(),
  keySkills: z.array(z.string()).max(20).default([]),
  targetDurationMinutes: z.number().int().min(15).max(240).optional(),
});
export type GenerateTechTestInput = z.infer<typeof generateTechTestSchema>;

/**
 * Edición manual de una prueba READY. `questionsJson`/`rubricJson`, si se
 * envían, deben venir COMPLETOS (no un patch parcial de un campo anidado) —
 * el editor del wizard siempre envía el árbol entero que ya tenía cargado,
 * con los campos de texto que el usuario cambió.
 */
export const updateTechTestSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  timeLimitMinutes: z.number().int().min(5).max(300).optional(),
  passScore: z.number().int().min(0).max(100).optional(),
  questions: z.array(techQuestionSchema).min(1).max(25).optional(),
  rubric: rubricSchema.optional(),
});
export type UpdateTechTestInput = z.infer<typeof updateTechTestSchema>;

// ============================================================
// Verificadores del pipeline (schemas de las llamadas Haiku de verificación)
// ============================================================
export const mcqRecheckSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      chosenOptionId: z.string(),
    }),
  ),
});
export type McqRecheck = z.infer<typeof mcqRecheckSchema>;

// ============================================================
// Vista del candidato — SIN claves ni guías del evaluador (allowlist
// explícita, no un blocklist: agregar un campo nuevo a techQuestionSchema no
// lo filtra aquí por accidente). Ver .claude/agents/nab-tenant-guard.md.
// ============================================================
const candidateQuestionBase = {
  id: z.string(),
  prompt: z.string(),
  skillTags: z.array(z.string()),
  estimatedMinutes: z.number(),
};

export const candidateQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    ...candidateQuestionBase,
    type: z.literal('multiple_choice'),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  z.object({ ...candidateQuestionBase, type: z.literal('open_text') }),
  z.object({
    ...candidateQuestionBase,
    type: z.literal('code'),
    language: z.string(),
    starterCode: z.string().optional(),
  }),
]);
export type CandidateQuestion = z.infer<typeof candidateQuestionSchema>;

/** Reduce una pregunta completa (con clave/guía del evaluador) a lo que puede ver el candidato. */
export function toCandidateQuestion(q: TechQuestion): CandidateQuestion {
  const base = { id: q.id, prompt: q.prompt, skillTags: q.skillTags, estimatedMinutes: q.estimatedMinutes };
  if (q.type === 'multiple_choice') {
    return { ...base, type: 'multiple_choice', options: q.options.map((o) => ({ id: o.id, text: o.text })) };
  }
  if (q.type === 'code') {
    return { ...base, type: 'code', language: q.language, starterCode: q.starterCode };
  }
  return { ...base, type: 'open_text' };
}

export const testAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.string().max(20_000),
});
export type TestAnswer = z.infer<typeof testAnswerSchema>;

export const saveTestAnswersSchema = z.object({
  answers: z.array(testAnswerSchema).max(50),
});
export type SaveTestAnswersInput = z.infer<typeof saveTestAnswersSchema>;

export const submissionStatusSchema = z.enum([
  'IN_PROGRESS',
  'SUBMITTED',
  'EVALUATING',
  'EVALUATED',
  'EVALUATION_FAILED',
]);
export type SubmissionStatusValue = z.infer<typeof submissionStatusSchema>;

// ============================================================
// Evaluación de submissions con IA
// ============================================================

/**
 * Lo que el LLM devuelve por criterio. La justificación DEBE apoyarse en
 * `evidence` (citas textuales de la respuesta real) — quote-first para que
 * el pipeline pueda verificar programáticamente que la evidencia existe
 * antes de confiar en el puntaje (ver evaluation-generation.service.ts).
 */
export const criterionEvaluationSchema = z.object({
  criterionId: z.string(),
  score: z.number().min(0).max(5),
  justification: z.string().max(1200),
  evidence: z
    .array(
      z.object({
        questionId: z.string(),
        quote: z.string().min(1).max(400),
      }),
    )
    .max(5),
  confidence: z.enum(['low', 'medium', 'high']),
});
export type CriterionEvaluation = z.infer<typeof criterionEvaluationSchema>;

/** Lo que pide completeStructured — antes de la verificación de citas del pipeline. */
export const llmEvaluationSchema = z.object({
  perCriterion: z.array(criterionEvaluationSchema).min(1),
  qualitative: z.object({
    summary: z.string().max(1500),
    strengths: z.array(z.string().max(300)).max(5),
    weaknesses: z.array(z.string().max(300)).max(5),
    highlights: z.array(z.string().max(300)).max(3),
  }),
  // El evaluador se marca a sí mismo si sospecha manipulación — es una señal
  // adicional, NO la única defensa (ver sanitización + delimitación en el pipeline).
  injectionSuspected: z.boolean().default(false),
});
export type LlmEvaluation = z.infer<typeof llmEvaluationSchema>;

export const overrideEvaluationSchema = z.object({
  scores: z
    .array(z.object({ criterionId: z.string(), score: z.number().min(0).max(5), note: z.string().max(500).optional() }))
    .optional(),
  totalScore: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export type OverrideEvaluationInput = z.infer<typeof overrideEvaluationSchema>;

// ============================================================
// Comparativa con IA — SOLO sobre evaluaciones ya persistidas (nunca
// respuestas crudas). Candidatos anonimizados A/B/C/D en el prompt; el
// pipeline verifica en código que cada score citado coincida EXACTO con el
// persistido — una entrada de criterio con cualquier score que no matchee se
// descarta entera (ver comparison-generation.service.ts). La IA nunca
// recomienda a quién contratar — el schema deliberadamente no tiene un
// campo de recomendación/veredicto.
// ============================================================
export const comparisonCandidateRefSchema = z.enum(['A', 'B', 'C', 'D']);

export const comparisonCriterionSchema = z.object({
  criterionId: z.string(),
  scores: z
    .array(z.object({ candidateRef: comparisonCandidateRefSchema, score: z.number().min(0).max(5) }))
    .min(2)
    .max(4),
  // Empatado si la diferencia máxima entre candidatos en este criterio es
  // menor a 0.5 — lo fija el pipeline en código, no se confía en que el LLM
  // haga bien la resta (ver verificación en el service).
  tied: z.boolean(),
  analysis: z.string().max(600),
});
export type ComparisonCriterion = z.infer<typeof comparisonCriterionSchema>;

export const llmComparisonSchema = z.object({
  byCriterion: z.array(comparisonCriterionSchema).min(1),
  tradeoffs: z.array(z.string().max(400)).max(6),
  caveats: z.array(z.string().max(400)).max(4),
});
export type LlmComparison = z.infer<typeof llmComparisonSchema>;

/** Lo que persiste/devuelve el endpoint tras la verificación — incluye el
 * mapeo de vuelta A/B/C/D → applicationId real, que nunca se le mostró al LLM. */
export const candidateComparisonSchema = llmComparisonSchema.extend({
  candidateLegend: z.array(z.object({ candidateRef: comparisonCandidateRefSchema, applicationId: z.string() })),
});
export type CandidateComparison = z.infer<typeof candidateComparisonSchema>;

/**
 * El cliente genera esta clave una vez por click explícito en "Generar
 * análisis" (no en reintentos automáticos) y la reenvía en el body — se usa
 * como refId del cobro. A diferencia de generar-prueba/evaluar (atados a un
 * recurso persistido con su propio id estable), esta comparación es efímera
 * y no se guarda en DB, así que no hay un id de recurso del que colgar la
 * idempotencia; sin esta clave, un doble-submit o un retry de red cobraría
 * dos veces por el mismo click percibido.
 */
export const comparisonAnalyzeSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
});
export type ComparisonAnalyzeInput = z.infer<typeof comparisonAnalyzeSchema>;
