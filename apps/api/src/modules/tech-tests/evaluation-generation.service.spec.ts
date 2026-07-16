import { describe, expect, it, vi } from 'vitest';
import { EvaluationGenerationService } from './evaluation-generation.service.js';

const QUESTIONS = [
  {
    id: 'q1',
    type: 'multiple_choice',
    prompt: '¿Cuál es correcta?',
    skillTags: [],
    estimatedMinutes: 5,
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
    correctOptionId: 'a',
    explanation: 'x',
  },
  {
    id: 'q2',
    type: 'open_text',
    prompt: 'Explica tu enfoque.',
    skillTags: [],
    estimatedMinutes: 10,
    expectedPoints: ['Claridad'],
  },
];

const RUBRIC = {
  criteria: [
    {
      id: 'c1',
      name: 'Fundamentos',
      description: 'Conocimiento técnico.',
      weight: 0.5,
      levels: [
        { score: 0, descriptor: 'No.' },
        { score: 5, descriptor: 'Sí.' },
      ],
      appliesTo: ['q1'], // MCQ-only → se resuelve en código
      references: [{ kind: 'standard', standardId: 'clean-code' }],
    },
    {
      id: 'c2',
      name: 'Comunicación',
      description: 'Claridad.',
      weight: 0.5,
      levels: [
        { score: 0, descriptor: 'No.' },
        { score: 5, descriptor: 'Sí.' },
      ],
      appliesTo: ['q2'],
      references: [{ kind: 'standard', standardId: 'clean-code' }],
    },
  ],
  passThreshold: 60,
};

function fakePrisma(answersJson: any) {
  const updates: { evaluations: any[]; submissionUpdates: any[] } = { evaluations: [], submissionUpdates: [] };
  return {
    client: {
      testSubmission: {
        findUniqueOrThrow: vi.fn(async () => ({
          answersJson,
          techTest: { questionsJson: QUESTIONS, rubricJson: RUBRIC },
        })),
        update: vi.fn(async ({ data }: any) => {
          updates.submissionUpdates.push(data);
          return data;
        }),
      },
      candidateEvaluation: {
        create: vi.fn(async ({ data }: any) => {
          updates.evaluations.push(data);
          return { id: 'eval-1', ...data };
        }),
      },
    } as any,
    updates,
  };
}

function fakeAi(llmResponse: any) {
  return {
    completeStructured: vi.fn().mockResolvedValue(llmResponse),
    generationModel: 'claude-sonnet-5',
    fastModel: 'claude-haiku-4-5',
  } as any;
}

describe('EvaluationGenerationService.evaluate', () => {
  const correctAnswers = [
    { questionId: 'q1', answer: 'a' },
    { questionId: 'q2', answer: 'Mi enfoque es usar inversión de dependencias para reducir acoplamiento.' },
  ];

  it('califica el MCQ en código (no llama al LLM para ese criterio) y persiste EVALUATED', async () => {
    const prisma = fakePrisma(correctAnswers);
    const llmResponse = {
      perCriterion: [
        {
          criterionId: 'c2',
          score: 4,
          justification: 'Buena explicación.',
          evidence: [{ questionId: 'q2', quote: 'inversión de dependencias' }],
          confidence: 'high',
        },
      ],
      qualitative: { summary: 'Buen desempeño.', strengths: ['Claridad'], weaknesses: [], highlights: [] },
      injectionSuspected: false,
    };
    const ai = fakeAi(llmResponse);
    const service = new EvaluationGenerationService(prisma.client, ai);

    await service.evaluate('sub-1');

    // El prompt del LLM solo debió incluir el criterio c2 (no-MCQ) — c1 es MCQ-only.
    const [, systemPrompt] = ai.completeStructured.mock.calls[0];
    expect(systemPrompt).toContain('c2');
    expect(systemPrompt).not.toContain('Criterio "c1"');

    expect(prisma.updates.submissionUpdates[0]).toEqual({ status: 'EVALUATED' });
    const persisted = prisma.updates.evaluations[0];
    expect(persisted.passed).toBe(true);
    // c1 (MCQ correcto) = 5/5, c2 (LLM) = 4/5, pesos iguales → (5*0.5+4*0.5)/5*100 = 90.
    expect(persisted.aiTotalScore).toBe(90);
    const c1Result = persisted.aiScoresJson.find((c: any) => c.criterionId === 'c1');
    expect(c1Result.score).toBe(5);
    expect(c1Result.confidence).toBe('high');
    // El resumen cualitativo completo debe persistirse, no solo `summary`
    // (antes se descartaban strengths/weaknesses/highlights tras generarse).
    expect(persisted.aiSummary).toBe('Buen desempeño.');
    expect(persisted.aiStrengths).toEqual(['Claridad']);
    expect(persisted.aiWeaknesses).toEqual([]);
    expect(persisted.aiHighlights).toEqual([]);
  });

  it('descarta una cita de evidencia que NO es substring real de la respuesta del candidato', async () => {
    const prisma = fakePrisma(correctAnswers);
    const llmResponse = {
      perCriterion: [
        {
          criterionId: 'c2',
          score: 4,
          justification: 'x',
          evidence: [{ questionId: 'q2', quote: 'texto que el candidato JAMÁS escribió' }],
          confidence: 'high',
        },
      ],
      qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
      injectionSuspected: false,
    };
    const ai = fakeAi(llmResponse);
    const service = new EvaluationGenerationService(prisma.client, ai);

    await service.evaluate('sub-1');

    const c2Result = prisma.updates.evaluations[0].aiScoresJson.find((c: any) => c.criterionId === 'c2');
    expect(c2Result.evidence).toEqual([]);
    // Score alto (4) sin evidencia verificada → confianza baja para que RH lo revise.
    expect(c2Result.confidence).toBe('low');
  });

  it('MCQ incorrecto da score 0 para el criterio ligado a esa pregunta', async () => {
    const prisma = fakePrisma([
      { questionId: 'q1', answer: 'b' }, // incorrecta (correcta es 'a')
      { questionId: 'q2', answer: 'Respuesta.' },
    ]);
    const ai = fakeAi({
      perCriterion: [{ criterionId: 'c2', score: 3, justification: 'x', evidence: [], confidence: 'medium' }],
      qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
      injectionSuspected: false,
    });
    const service = new EvaluationGenerationService(prisma.client, ai);

    await service.evaluate('sub-1');

    const c1Result = prisma.updates.evaluations[0].aiScoresJson.find((c: any) => c.criterionId === 'c1');
    expect(c1Result.score).toBe(0);
  });

  it('propaga el error si la salida de la IA es inválida (no cae a un fallback silencioso)', async () => {
    const prisma = fakePrisma(correctAnswers);
    const ai = {
      completeStructured: vi.fn().mockRejectedValue(new Error('Salida de IA inválida')),
      generationModel: 'x',
      fastModel: 'y',
    };
    const service = new EvaluationGenerationService(prisma.client, ai as any);

    await expect(service.evaluate('sub-1')).rejects.toThrow('Salida de IA inválida');
    expect(prisma.updates.evaluations).toHaveLength(0);
  });

  it('el verdict (passed) se calcula en código contra el passThreshold de la rúbrica', async () => {
    const prisma = fakePrisma([
      { questionId: 'q1', answer: 'b' }, // incorrecta → c1 = 0
      { questionId: 'q2', answer: 'x' },
    ]);
    const ai = fakeAi({
      perCriterion: [{ criterionId: 'c2', score: 1, justification: 'x', evidence: [], confidence: 'low' }],
      qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
      injectionSuspected: false,
    });
    const service = new EvaluationGenerationService(prisma.client, ai);

    await service.evaluate('sub-1');

    // (0*0.5 + 1*0.5)/5*100 = 10 < passThreshold(60) → no aprueba.
    expect(prisma.updates.evaluations[0].aiTotalScore).toBe(10);
    expect(prisma.updates.evaluations[0].passed).toBe(false);
  });

  describe('injectionSuspected — el backstop real contra inyección de prompt', () => {
    it('bloquea el veredicto automático (finalScore/passed = null) cuando el evaluador sospecha manipulación', async () => {
      const prisma = fakePrisma(correctAnswers);
      const ai = fakeAi({
        perCriterion: [
          {
            criterionId: 'c2',
            score: 5,
            justification: 'x',
            // Cita real (pasa el substring-check) pero el modelo igual marcó sospecha —
            // demuestra que la verificación de citas NO es el backstop, injectionSuspected sí.
            evidence: [{ questionId: 'q2', quote: 'inversión de dependencias' }],
            confidence: 'high',
          },
        ],
        qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
        injectionSuspected: true,
      });
      const service = new EvaluationGenerationService(prisma.client, ai);

      await service.evaluate('sub-1');

      const persisted = prisma.updates.evaluations[0];
      expect(persisted.injectionSuspected).toBe(true);
      // aiTotalScore se conserva para auditoría — pero el campo EFECTIVO queda bloqueado.
      expect(persisted.aiTotalScore).toBe(100);
      expect(persisted.finalScore).toBeNull();
      expect(persisted.passed).toBeNull();
    });

    it('fuerza confidence=low en TODOS los criterios, no solo el que perdió evidencia', async () => {
      const prisma = fakePrisma(correctAnswers);
      const ai = fakeAi({
        perCriterion: [
          {
            criterionId: 'c2',
            score: 5,
            justification: 'x',
            evidence: [{ questionId: 'q2', quote: 'inversión de dependencias' }],
            confidence: 'high',
          },
        ],
        qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
        injectionSuspected: true,
      });
      const service = new EvaluationGenerationService(prisma.client, ai);

      await service.evaluate('sub-1');

      const c1Result = prisma.updates.evaluations[0].aiScoresJson.find((c: any) => c.criterionId === 'c1');
      const c2Result = prisma.updates.evaluations[0].aiScoresJson.find((c: any) => c.criterionId === 'c2');
      // c1 es MCQ-only (siempre 'high' normalmente) — injectionSuspected lo baja igual.
      expect(c1Result.confidence).toBe('low');
      expect(c2Result.confidence).toBe('low');
    });

    it('sin sospecha de inyección, el veredicto se fija normalmente (no queda bloqueado por defecto)', async () => {
      const prisma = fakePrisma(correctAnswers);
      const ai = fakeAi({
        perCriterion: [
          { criterionId: 'c2', score: 4, justification: 'x', evidence: [{ questionId: 'q2', quote: 'inversión de dependencias' }], confidence: 'high' },
        ],
        qualitative: { summary: 's', strengths: [], weaknesses: [], highlights: [] },
        injectionSuspected: false,
      });
      const service = new EvaluationGenerationService(prisma.client, ai);

      await service.evaluate('sub-1');

      const persisted = prisma.updates.evaluations[0];
      expect(persisted.injectionSuspected).toBe(false);
      expect(persisted.finalScore).not.toBeNull();
      expect(persisted.passed).not.toBeNull();
    });
  });
});
