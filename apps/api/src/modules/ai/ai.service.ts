import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { parsedResumeSchema, type ParsedResume } from '@nab/shared';

/**
 * Cliente Claude centralizado. Si no hay ANTHROPIC_API_KEY configurada,
 * opera en "modo mock" devolviendo respuestas deterministas — así el
 * desarrollo y los tests funcionan sin claves ni costo.
 *
 * Modelos (del plan aprobado): generación = sonnet-5, tareas rápidas = haiku-4-5.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;
  readonly enabled: boolean;

  readonly fastModel = process.env.AI_MODEL_FAST ?? 'claude-haiku-4-5';
  readonly generationModel = process.env.AI_MODEL_GENERATION ?? 'claude-sonnet-5';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.enabled = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.enabled) {
      this.logger.warn('ANTHROPIC_API_KEY no configurada — IA en modo mock.');
    }
  }

  /**
   * Extrae experiencia, skills y educación del texto de un CV usando salida
   * estructurada (schema Zod forzado). El modelo rápido basta para esto.
   */
  async parseResume(resumeText: string): Promise<ParsedResume> {
    if (!this.client) return this.mockParseResume(resumeText);

    const message = await this.client.messages.create({
      model: this.fastModel,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content:
            'Extrae la información profesional del siguiente CV en español y devuélvela ' +
            'EXCLUSIVAMENTE como JSON válido con esta forma: ' +
            '{"headline": string, "summary": string, "skills": string[], ' +
            '"experience": [{"company": string, "role": string, "startDate": string, "endDate": string, "description": string}], ' +
            '"education": [{"institution": string, "degree": string, "field": string}]}. ' +
            'No inventes datos: usa solo lo que aparece en el texto.\n\nCV:\n' +
            resumeText.slice(0, 30_000),
        },
      ],
    });

    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return this.mockParseResume(resumeText);
    try {
      const parsed = parsedResumeSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
      return parsed.success ? parsed.data : this.mockParseResume(resumeText);
    } catch {
      return this.mockParseResume(resumeText);
    }
  }

  /** Respuesta mock determinista para desarrollo sin clave de IA. */
  private mockParseResume(resumeText: string): ParsedResume {
    const skills = ['TypeScript', 'React', 'Node.js']
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
      education: [
        { institution: 'Universidad Ejemplo', degree: 'Ingeniería', field: 'Sistemas' },
      ],
    };
  }
}
