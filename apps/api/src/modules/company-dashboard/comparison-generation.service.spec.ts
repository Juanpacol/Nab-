import { describe, expect, it, vi } from 'vitest';
import { ComparisonGenerationService } from './comparison-generation.service.js';

const CRITERIA = [
  { id: 'c1', name: 'Fundamentos', description: 'x', weight: 0.5, levels: [], appliesTo: [], references: [] },
  { id: 'c2', name: 'Comunicación', description: 'x', weight: 0.5, levels: [], appliesTo: [], references: [] },
] as any;

const CANDIDATES = [
  {
    candidateRef: 'A' as const,
    applicationId: 'app-a',
    perCriterionScores: [
      { criterionId: 'c1', score: 5 },
      { criterionId: 'c2', score: 3 },
    ],
    summary: 'Resumen A',
  },
  {
    candidateRef: 'B' as const,
    applicationId: 'app-b',
    perCriterionScores: [
      { criterionId: 'c1', score: 4.8 },
      { criterionId: 'c2', score: 2 },
    ],
    summary: 'Resumen B',
  },
];

function fakeAi(llmResponse: any) {
  return { completeStructured: vi.fn().mockResolvedValue(llmResponse), generationModel: 'claude-sonnet-5' } as any;
}

describe('ComparisonGenerationService.generate', () => {
  it('conserva una entrada de criterio cuando TODOS los scores citados coinciden exacto con lo persistido', async () => {
    const ai = fakeAi({
      byCriterion: [
        {
          criterionId: 'c1',
          scores: [
            { candidateRef: 'A', score: 5 },
            { candidateRef: 'B', score: 4.8 },
          ],
          tied: false,
          analysis: 'A y B están cerca en fundamentos.',
        },
      ],
      tradeoffs: ['A es más fuerte en fundamentos.'],
      caveats: [],
    });
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.byCriterion).toHaveLength(1);
    expect(result.byCriterion[0]?.tied).toBe(true); // 5 - 4.8 = 0.2 < 0.5 → tied recalculado en código
  });

  it('descarta la entrada ENTERA de un criterio si CUALQUIER score citado no coincide con lo persistido', async () => {
    const ai = fakeAi({
      byCriterion: [
        {
          criterionId: 'c1',
          scores: [
            { candidateRef: 'A', score: 5 },
            { candidateRef: 'B', score: 5 }, // el real es 4.8 — inventado/alucinado
          ],
          tied: true,
          analysis: 'Ambos perfectos.',
        },
      ],
      tradeoffs: [],
      caveats: [],
    });
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.byCriterion).toHaveLength(0);
  });

  it('descarta la entrada si falta un candidato o hay un candidateRef duplicado/desconocido', async () => {
    const ai = fakeAi({
      byCriterion: [
        {
          criterionId: 'c1',
          scores: [{ candidateRef: 'A', score: 5 }], // falta B
          tied: false,
          analysis: 'x',
        },
        {
          criterionId: 'c2',
          scores: [
            { candidateRef: 'A', score: 3 },
            { candidateRef: 'C', score: 2 }, // C no existe en esta comparación
          ],
          tied: false,
          analysis: 'x',
        },
      ],
      tradeoffs: [],
      caveats: [],
    });
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.byCriterion).toHaveLength(0);
  });

  it('descarta una entrada que referencia un criterio que no existe en la rúbrica', async () => {
    const ai = fakeAi({
      byCriterion: [
        {
          criterionId: 'c-inventado',
          scores: [
            { candidateRef: 'A', score: 5 },
            { candidateRef: 'B', score: 4.8 },
          ],
          tied: false,
          analysis: 'x',
        },
      ],
      tradeoffs: [],
      caveats: [],
    });
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.byCriterion).toHaveLength(0);
  });

  it('incluye el candidateLegend mapeando cada ref a su applicationId real (nunca visto por el LLM)', async () => {
    const ai = fakeAi({ byCriterion: [], tradeoffs: [], caveats: [] });
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.candidateLegend).toEqual([
      { candidateRef: 'A', applicationId: 'app-a' },
      { candidateRef: 'B', applicationId: 'app-b' },
    ]);
  });

  it('el mock determinista respeta los scores persistidos y produce un resultado válido', async () => {
    const ai = { completeStructured: vi.fn(async (_m: any, _s: any, _u: any, _schema: any, mock: () => any) => mock()) } as any;
    const service = new ComparisonGenerationService(ai);

    const result = await service.generate(CRITERIA, CANDIDATES);

    expect(result.byCriterion).toHaveLength(2);
    const c1 = result.byCriterion.find((c) => c.criterionId === 'c1');
    expect(c1?.scores.find((s) => s.candidateRef === 'A')?.score).toBe(5);
    expect(c1?.scores.find((s) => s.candidateRef === 'B')?.score).toBe(4.8);
  });
});
