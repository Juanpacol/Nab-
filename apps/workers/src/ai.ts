import Anthropic from '@anthropic-ai/sdk';
import { parsedResumeSchema, type ParsedResume } from '@nab/shared';
import { logger } from './logger.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;
const fastModel = process.env.AI_MODEL_FAST ?? 'claude-haiku-4-5';

const EXTRACTION_PROMPT = `Extrae la información profesional del siguiente CV en español y devuélvela EXCLUSIVAMENTE como JSON válido con esta forma:
{"headline": string, "summary": string, "skills": string[], "experience": [{"company": string, "role": string, "startDate": string, "endDate": string, "description": string}], "education": [{"institution": string, "degree": string, "field": string}]}
No inventes datos: usa solo lo que aparece en el texto. No incluyas texto fuera del JSON.

CV:
`;

/**
 * Extrae datos del CV con IA. Sin ANTHROPIC_API_KEY devuelve un mock
 * determinista (modo desarrollo/local, sin costo ni llamadas externas).
 */
export async function parseResume(resumeText: string): Promise<ParsedResume> {
  if (!client) {
    logger.info('IA en modo mock (sin ANTHROPIC_API_KEY)');
    return mockParse(resumeText);
  }

  try {
    const message = await client.messages.create({
      model: fastModel,
      max_tokens: 4096,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + resumeText.slice(0, 30_000) }],
    });
    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    const json = extractJson(text);
    const result = parsedResumeSchema.safeParse(json);
    return result.success ? result.data : mockParse(resumeText);
  } catch (err) {
    logger.error({ err: String(err) }, 'Fallo la extracción con IA; usando mock');
    return mockParse(resumeText);
  }
}

/** Aísla el primer objeto JSON de la respuesta del modelo. */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }
}

function mockParse(resumeText: string): ParsedResume {
  const skills = ['TypeScript', 'React', 'Node.js', 'Python', 'SQL']
    .filter((s) => resumeText.toLowerCase().includes(s.toLowerCase()))
    .concat('Comunicación');
  return {
    headline: 'Perfil extraído (modo demo)',
    summary:
      'Resumen generado en modo demo. Configura ANTHROPIC_API_KEY para extracción real con IA.',
    skills: [...new Set(skills)],
    experience: [
      {
        company: 'Empresa Ejemplo',
        role: 'Rol Ejemplo',
        startDate: '2022',
        endDate: 'Presente',
        description: 'Experiencia de ejemplo detectada en modo demo.',
      },
    ],
    education: [{ institution: 'Universidad Ejemplo', degree: 'Ingeniería', field: 'Sistemas' }],
  };
}
