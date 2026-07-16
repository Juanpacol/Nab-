import { describe, expect, it, vi } from 'vitest';
import { TechTestGenerationService } from './tech-test-generation.service.js';

/** Draft válido mínimo, reutilizado y mutado por cada test. */
function baseDraft(overrides: Record<string, any> = {}): any {
  return {
    title: 'Prueba de Backend',
    roleTitle: 'Backend Engineer',
    seniority: 'mid',
    durationMinutes: 60,
    instructions: 'Responde dentro del tiempo asignado.',
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: '¿Qué es la inversión de dependencias?',
        skillTags: ['diseño'],
        estimatedMinutes: 5,
        options: [
          { id: 'a', text: 'Correcto' },
          { id: 'b', text: 'Incorrecto' },
          { id: 'c', text: 'También incorrecto' },
        ],
        correctOptionId: 'a',
        explanation: 'Explicación.',
      },
      {
        id: 'q2',
        type: 'open_text',
        prompt: 'Describe tu experiencia con sistemas distribuidos.',
        skillTags: ['comunicación'],
        estimatedMinutes: 10,
        expectedPoints: ['Claridad'],
      },
      {
        id: 'q3',
        type: 'code',
        prompt: 'Escribe una función que invierta una lista enlazada.',
        skillTags: ['algoritmos'],
        estimatedMinutes: 15,
        language: 'typescript',
        expectedApproach: 'Recorrido iterativo.',
      },
    ],
    rubric: {
      criteria: [
        {
          id: 'c1',
          name: 'Fundamentos',
          description: 'Conocimiento técnico.',
          weight: 0.34,
          levels: [
            { score: 0, descriptor: 'No.' },
            { score: 3, descriptor: 'Parcial.' },
            { score: 5, descriptor: 'Completo.' },
          ],
          appliesTo: ['q1'],
          references: [{ kind: 'role_spec', quote: 'experiencia con Node.js y Postgres', note: 'spec' }],
        },
        {
          id: 'c2',
          name: 'Comunicación',
          description: 'Claridad.',
          weight: 0.33,
          levels: [
            { score: 0, descriptor: 'No.' },
            { score: 3, descriptor: 'Parcial.' },
            { score: 5, descriptor: 'Completo.' },
          ],
          appliesTo: ['q2'],
          references: [{ kind: 'standard', standardId: 'clean-code' }],
        },
        {
          id: 'c3',
          name: 'Algoritmos',
          description: 'Resolución de problemas.',
          weight: 0.33,
          levels: [
            { score: 0, descriptor: 'No.' },
            { score: 3, descriptor: 'Parcial.' },
            { score: 5, descriptor: 'Completo.' },
          ],
          appliesTo: ['q3'],
          references: [{ kind: 'standard', standardId: 'data-structures-fundamentals' }],
        },
      ],
      passThreshold: 60,
    },
    ...overrides,
  };
}

function fakePrisma(roleSpec: string, guides: { id: string; title: string; content: string }[] = []) {
  const updates: any[] = [];
  return {
    client: {
      techTest: {
        findUniqueOrThrow: vi.fn(async () => ({ roleSpec })),
        update: vi.fn(async ({ data }: any) => {
          updates.push(data);
          return { id: 'test-1', ...data };
        }),
      },
      $queryRawUnsafe: vi.fn(async () => guides),
    } as any,
    updates,
  };
}

/** completeStructured devuelve `draftResponse` en la 1a llamada (generación) y `mcqResponse` en la 2a (verificación MCQ). */
function fakeAi(draftResponse: any, mcqResponse?: any) {
  const completeStructured = vi
    .fn()
    .mockResolvedValueOnce(draftResponse)
    .mockResolvedValueOnce(mcqResponse ?? { answers: [] });
  return { completeStructured, generationModel: 'claude-sonnet-5', fastModel: 'claude-haiku-4-5' } as any;
}

describe('TechTestGenerationService.generate', () => {
  const roleSpec = 'Buscamos alguien con experiencia con Node.js y Postgres para nuestro equipo.';

  it('persiste READY con referencias verificadas cuando el draft es válido y el MCQ coincide', async () => {
    const prisma = fakePrisma(roleSpec);
    const ai = fakeAi(baseDraft(), { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    expect(prisma.updates).toHaveLength(1);
    const persisted = prisma.updates[0];
    expect(persisted.status).toBe('READY');
    expect(persisted.questionsJson).toHaveLength(3);
    const criteria = persisted.rubricJson.criteria;
    expect(criteria).toHaveLength(3);
    expect(criteria[0].references[0].verification.status).toBe('verified');
    expect(criteria[0].references[0].verification.method).toBe('substring');
    expect(criteria[1].references[0].verification.status).toBe('verified');
    expect(criteria[1].references[0].verification.method).toBe('catalog');
  });

  it('marca unverified una cita role_spec que NO es un substring real de la spec (nunca "verified" sin serlo)', async () => {
    const prisma = fakePrisma(roleSpec);
    const draft = baseDraft();
    draft.rubric.criteria[0].references[0].quote = 'una cita que no existe en la especificación';
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const criteria = prisma.updates[0].rubricJson.criteria;
    expect(criteria[0].references[0].verification.status).toBe('unverified');
  });

  it('marca unverified un standardId que no existe en el catálogo curado', async () => {
    const prisma = fakePrisma(roleSpec);
    const draft = baseDraft();
    draft.rubric.criteria[1].references[0] = { kind: 'standard', standardId: 'estandar-inventado' };
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const criteria = prisma.updates[0].rubricJson.criteria;
    expect(criteria[1].references[0].verification.status).toBe('unverified');
  });

  it('descarta un MCQ cuya clave no resiste la re-resolución en frío (código, no el LLM, decide)', async () => {
    const prisma = fakePrisma(roleSpec);
    // Haiku "re-resuelve" q1 y elige 'b' en vez de la clave del draft ('a') → discrepancia.
    const ai = fakeAi(baseDraft(), { answers: [{ questionId: 'q1', chosenOptionId: 'b' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const persisted = prisma.updates[0];
    const questionIds = persisted.questionsJson.map((q: any) => q.id);
    expect(questionIds).not.toContain('q1');
    expect(questionIds).toContain('q2');
    // El criterio c1 dependía solo de q1 (appliesTo: ['q1']) → sin preguntas
    // sobrevivientes, se elimina de la rúbrica persistida.
    const criteriaIds = persisted.rubricJson.criteria.map((c: any) => c.id);
    expect(criteriaIds).not.toContain('c1');
    expect(criteriaIds).toContain('c2');
  });

  it('descarta un MCQ si el verificador no devuelve respuesta para esa pregunta (fail-closed, no fail-open)', async () => {
    const prisma = fakePrisma(roleSpec);
    // El recheck no incluye a q1 en absoluto (respuesta incompleta/truncada del verificador).
    const ai = fakeAi(baseDraft(), { answers: [] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const persisted = prisma.updates[0];
    const questionIds = persisted.questionsJson.map((q: any) => q.id);
    expect(questionIds).not.toContain('q1');
  });

  it('lanza si TODAS las preguntas fallan la verificación (no persiste una prueba vacía)', async () => {
    const prisma = fakePrisma(roleSpec);
    const draft = baseDraft({
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: '¿?',
          skillTags: [],
          estimatedMinutes: 5,
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionId: 'a',
          explanation: 'x',
        },
      ],
      rubric: { criteria: [{ ...baseDraft().rubric.criteria[0], appliesTo: ['q1'] }], passThreshold: 60 },
    });
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'b' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await expect(service.generate('test-1')).rejects.toThrow(
      'Todas las preguntas generadas fallaron la verificación de claves',
    );
    expect(prisma.updates).toHaveLength(0);
  });

  it('propaga el error si la salida del draft es inválida (no cae a un fallback silencioso)', async () => {
    const prisma = fakePrisma(roleSpec);
    const ai = { completeStructured: vi.fn().mockRejectedValue(new Error('Salida de IA inválida')), generationModel: 'x', fastModel: 'y' };
    const service = new TechTestGenerationService(prisma.client, ai as any);

    await expect(service.generate('test-1')).rejects.toThrow('Salida de IA inválida');
    expect(prisma.updates).toHaveLength(0);
  });

  it('no llama al verificador de MCQ si la prueba no tiene preguntas de opción múltiple', async () => {
    const prisma = fakePrisma(roleSpec);
    const draft = baseDraft({
      questions: [
        {
          id: 'q1',
          type: 'open_text',
          prompt: 'Describe algo.',
          skillTags: [],
          estimatedMinutes: 5,
          expectedPoints: ['x'],
        },
        {
          id: 'q2',
          type: 'open_text',
          prompt: 'Describe algo más.',
          skillTags: [],
          estimatedMinutes: 5,
          expectedPoints: ['y'],
        },
      ],
      rubric: {
        criteria: [
          { ...baseDraft().rubric.criteria[0], appliesTo: ['q1'] },
          { ...baseDraft().rubric.criteria[1], appliesTo: ['q2'] },
        ],
        passThreshold: 60,
      },
    });
    const ai = { completeStructured: vi.fn().mockResolvedValueOnce(draft), generationModel: 'x', fastModel: 'y' };
    const service = new TechTestGenerationService(prisma.client, ai as any);

    await service.generate('test-1');

    expect(ai.completeStructured).toHaveBeenCalledTimes(1);
    expect(prisma.updates[0].status).toBe('READY');
  });
});

describe('TechTestGenerationService — referencias internal_guide (retrieval)', () => {
  const roleSpec = 'Buscamos alguien con experiencia con Node.js y Postgres para nuestro equipo.';
  const RETRIEVED_GUIDES = [{ id: 'guide-1', title: 'Principios SOLID', content: 'Contenido de la guía SOLID.' }];

  it('verifica un guideId citado que SÍ pertenece al set recuperado', async () => {
    const prisma = fakePrisma(roleSpec, RETRIEVED_GUIDES);
    const draft = baseDraft({
      rubric: {
        ...baseDraft().rubric,
        criteria: [
          {
            ...baseDraft().rubric.criteria[0],
            references: [{ kind: 'internal_guide', guideId: 'guide-1', excerpt: 'x' }],
          },
          baseDraft().rubric.criteria[1],
          baseDraft().rubric.criteria[2],
        ],
      },
    });
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const criteria = prisma.updates[0].rubricJson.criteria;
    expect(criteria[0].references[0].verification).toEqual({ status: 'verified', method: 'retrieval_set' });
  });

  it('marca unverified un guideId inventado que NO está en el set recuperado (nunca confía en el id del LLM)', async () => {
    const prisma = fakePrisma(roleSpec, RETRIEVED_GUIDES);
    const draft = baseDraft({
      rubric: {
        ...baseDraft().rubric,
        criteria: [
          {
            ...baseDraft().rubric.criteria[0],
            references: [{ kind: 'internal_guide', guideId: 'guide-inventado', excerpt: 'x' }],
          },
          baseDraft().rubric.criteria[1],
          baseDraft().rubric.criteria[2],
        ],
      },
    });
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const criteria = prisma.updates[0].rubricJson.criteria;
    expect(criteria[0].references[0].verification).toEqual({ status: 'unverified', method: 'retrieval_set' });
  });

  it('marca unverified cualquier guideId cuando NO se recuperó ninguna guía (retrieval vacío)', async () => {
    const prisma = fakePrisma(roleSpec, []);
    const draft = baseDraft({
      rubric: {
        ...baseDraft().rubric,
        criteria: [
          {
            ...baseDraft().rubric.criteria[0],
            references: [{ kind: 'internal_guide', guideId: 'guide-1', excerpt: 'x' }],
          },
          baseDraft().rubric.criteria[1],
          baseDraft().rubric.criteria[2],
        ],
      },
    });
    const ai = fakeAi(draft, { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    const service = new TechTestGenerationService(prisma.client, ai);

    await service.generate('test-1');

    const criteria = prisma.updates[0].rubricJson.criteria;
    expect(criteria[0].references[0].verification.status).toBe('unverified');
  });

  it('el prompt del sistema prohíbe internal_guide cuando no hay guías, y lo permite cuando sí las hay', async () => {
    const withoutGuides = fakePrisma(roleSpec, []);
    const aiA = fakeAi(baseDraft(), { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    await new TechTestGenerationService(withoutGuides.client, aiA).generate('test-1');
    const [, systemNoGuides] = aiA.completeStructured.mock.calls[0];
    expect(systemNoGuides).toContain('NO uses el tipo "internal_guide"');

    const withGuides = fakePrisma(roleSpec, RETRIEVED_GUIDES);
    const aiB = fakeAi(baseDraft(), { answers: [{ questionId: 'q1', chosenOptionId: 'a' }] });
    await new TechTestGenerationService(withGuides.client, aiB).generate('test-1');
    const [, systemWithGuides, userWithGuides] = aiB.completeStructured.mock.calls[0];
    expect(systemWithGuides).not.toContain('NO uses el tipo "internal_guide"');
    expect(userWithGuides).toContain('<guia id="guide-1">');
  });
});
