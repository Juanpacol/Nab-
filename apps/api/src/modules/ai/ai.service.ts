import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  atsScore,
  jobRequirementsSchema,
  generatedResumeSchema,
  parsedResumeSchema,
  type JobRequirements,
  type GeneratedResume,
  type CoverLetterTone,
  type ParsedResume,
} from '@nab/shared';
import { z } from 'zod';

/** Datos mínimos del perfil que alimentan la generación. */
export interface ProfileContext {
  headline?: string | null;
  summary?: string | null;
  skills: string[];
  experienceJson?: unknown;
  educationJson?: unknown;
}

/** Datos mínimos de la vacante que alimentan la generación. */
export interface JobContext {
  title: string;
  company: string;
  location?: string | null;
  description: string;
}

/**
 * Cliente Claude centralizado (Fase 3). Si no hay ANTHROPIC_API_KEY configurada,
 * opera en "modo mock" devolviendo respuestas deterministas — así el desarrollo
 * y los tests funcionan sin claves ni costo.
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
    // Sin timeout explícito, el SDK usa su default (~10 min) y las llamadas
    // corren síncronamente dentro del request HTTP del usuario — un cuelgue
    // de Anthropic colgaría el request entero.
    this.client = apiKey ? new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 }) : null;
    if (!this.enabled) {
      this.logger.warn('ANTHROPIC_API_KEY no configurada — IA en modo mock.');
    }
  }

  // --- Núcleo: llamada a Claude con logging de costo y aislamiento de JSON ---

  /** Llama a Claude y devuelve el texto. `null` si opera en modo mock. */
  private async complete(
    model: string,
    system: string,
    user: string,
    maxTokens = 4096,
    userId?: string,
    temperature?: number,
  ): Promise<string | null> {
    if (!this.client) return null;
    const message = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      // claude-sonnet-5 rechaza temperature no-default (400) — solo se pasa
      // cuando el caller lo pide explícitamente (verificadores con Haiku).
      ...(temperature !== undefined ? { temperature } : {}),
    });
    const usage = message.usage;
    this.logger.log(
      `IA ${model} in=${usage.input_tokens} out=${usage.output_tokens}` +
        (userId ? ` user=${userId}` : ''),
    );
    return message.content.find((b) => b.type === 'text')?.text ?? '';
  }

  /**
   * Llama a Claude pidiendo JSON, lo valida con un schema Zod y, ante cualquier
   * fallo (o modo mock), delega en `fallback`. Patrón anti-alucinación de forma.
   */
  private async completeJson<S extends z.ZodTypeAny>(
    model: string,
    system: string,
    user: string,
    schema: S,
    fallback: () => z.infer<S>,
    userId?: string,
  ): Promise<z.infer<S>> {
    try {
      const text = await this.complete(model, system, user, 4096, userId);
      if (text === null) return fallback();
      const parsed = schema.safeParse(extractJson(text));
      return parsed.success ? (parsed.data as z.infer<S>) : fallback();
    } catch (err) {
      this.logger.error(`Fallo IA (${model}); usando fallback: ${String(err)}`);
      return fallback();
    }
  }

  /**
   * Como `completeJson`, pero para pipelines donde una salida inválida del
   * modelo REAL debe ser un fallo VISIBLE, no un fallback silencioso a datos
   * mock — la generación/evaluación de pruebas técnicas marca el registro
   * como FAILED y reembolsa el crédito en vez de servir una prueba a medias
   * o inventada (ver .claude/agents/nab-ai-pipeline-guard.md). En modo mock
   * (sin ANTHROPIC_API_KEY) sí usa `mock()`, igual que el resto del servicio
   * — solo el caso "hay cliente real pero devolvió basura" lanza.
   */
  async completeStructured<S extends z.ZodTypeAny>(
    model: string,
    system: string,
    user: string,
    schema: S,
    mock: () => z.infer<S>,
    opts?: { maxTokens?: number; userId?: string; temperature?: number },
  ): Promise<z.infer<S>> {
    if (!this.client) return mock();
    const text = await this.complete(model, system, user, opts?.maxTokens ?? 8192, opts?.userId, opts?.temperature);
    const parsed = schema.safeParse(extractJson(text ?? ''));
    if (!parsed.success) {
      throw new Error(`Salida de IA inválida para ${model}: ${parsed.error.message}`);
    }
    return parsed.data as z.infer<S>;
  }

  // --- Extracción estructurada de la vacante (Haiku, cacheable por job) ---

  async extractJobRequirements(job: JobContext): Promise<JobRequirements> {
    const system =
      'Eres un analista técnico de reclutamiento. Extrae requisitos de una ' +
      'vacante y responde EXCLUSIVAMENTE con JSON válido, sin texto adicional.';
    const user =
      `Analiza esta vacante y devuelve JSON con esta forma exacta:\n` +
      `{"requiredSkills": string[], "niceToHaveSkills": string[], ` +
      `"seniority": "junior"|"mid"|"senior"|"lead"|"unknown", ` +
      `"yearsExperience": number, "atsKeywords": string[], "summary": string}\n` +
      `"atsKeywords" son las palabras clave que un ATS buscaría (tecnologías, ` +
      `metodologías, roles). No inventes: usa solo lo que aparece.\n\n` +
      `Puesto: ${job.title} en ${job.company}\n${job.description.slice(0, 8000)}`;

    return this.completeJson(this.fastModel, system, user, jobRequirementsSchema, () =>
      mockRequirements(job),
    );
  }

  // --- Generación de CV personalizado (Sonnet) + verificación anti-alucinación ---

  async generateResume(
    profile: ProfileContext,
    job: JobContext,
    requirements: JobRequirements,
    userId?: string,
  ): Promise<{ resume: GeneratedResume; ats: ReturnType<typeof atsScore> }> {
    const system =
      'Eres un redactor experto de CVs orientados a ATS. Personalizas el CV del ' +
      'candidato para una vacante concreta SIN inventar experiencia: reordenas, ' +
      'reformulas y destacas lo que ya tiene. Responde SOLO con JSON válido.';
    const user =
      `Perfil del candidato (única fuente de verdad, no inventes nada fuera de aquí):\n` +
      `${JSON.stringify(profile)}\n\n` +
      `Vacante objetivo: ${job.title} en ${job.company}\n` +
      `Requisitos/keywords: ${JSON.stringify(requirements)}\n\n` +
      `Genera un CV personalizado en JSON con esta forma:\n` +
      `{"headline": string, "summary": string, "skills": string[], ` +
      `"experience": [{"company": string, "role": string, "startDate": string, ` +
      `"endDate": string, "bullets": string[]}], ` +
      `"education": [{"institution": string, "degree": string, "field": string}]}\n` +
      `Incorpora de forma natural las keywords que el candidato realmente cumpla.`;

    let resume = await this.completeJson(
      this.generationModel,
      system,
      user,
      generatedResumeSchema,
      () => mockResume(profile, requirements),
      userId,
    );

    // Verificación anti-alucinación: elimina afirmaciones no respaldadas por el perfil.
    resume = await this.verifyResume(profile, resume, userId);

    const ats = atsScore(resumeText(resume), requirements.atsKeywords);
    return { resume, ats };
  }

  /**
   * Segundo paso: Claude (Haiku) marca los bullets que NO están respaldados por
   * el perfil real; se eliminan. En modo mock no altera nada.
   */
  private async verifyResume(
    profile: ProfileContext,
    resume: GeneratedResume,
    userId?: string,
  ): Promise<GeneratedResume> {
    const allBullets = resume.experience.flatMap((e) => e.bullets);
    if (allBullets.length === 0) return resume;

    const schema = z.object({ unsupported: z.array(z.string()).default([]) });
    const system =
      'Eres un verificador de veracidad de CVs. Recibes el perfil real y un CV ' +
      'generado. Devuelve SOLO JSON {"unsupported": string[]} con los bullets del ' +
      'CV cuya afirmación NO se puede sostener con el perfil (experiencia inventada).';
    const user =
      `Perfil real:\n${JSON.stringify(profile)}\n\n` +
      `Bullets del CV generado:\n${JSON.stringify(allBullets)}\n\n` +
      `Lista textualmente los bullets no respaldados.`;

    const { unsupported } = await this.completeJson(
      this.fastModel,
      system,
      user,
      schema,
      () => ({ unsupported: [] }),
      userId,
    );

    if (unsupported.length === 0) return resume;
    const banned = new Set(unsupported);
    return {
      ...resume,
      experience: resume.experience.map((e) => ({
        ...e,
        bullets: e.bullets.filter((b) => !banned.has(b)),
      })),
    };
  }

  // --- Carta de presentación (Sonnet), con tono seleccionable ---

  async generateCoverLetter(
    profile: ProfileContext,
    job: JobContext,
    tone: CoverLetterTone,
    userId?: string,
  ): Promise<string> {
    const toneHint: Record<CoverLetterTone, string> = {
      professional: 'profesional y sobrio',
      enthusiastic: 'entusiasta y motivado',
      concise: 'muy conciso y directo',
      friendly: 'cercano y humano',
    };
    const system =
      `Eres un redactor de cartas de presentación en español, con tono ` +
      `${toneHint[tone]}. Escribe SOLO la carta (sin encabezados de dirección ni ` +
      `marcadores). No inventes logros que no estén en el perfil.`;
    const user =
      `Perfil:\n${JSON.stringify(profile)}\n\n` +
      `Vacante: ${job.title} en ${job.company}\n${job.description.slice(0, 4000)}\n\n` +
      `Redacta una carta de 3–4 párrafos que conecte el perfil con la vacante.`;

    const text = await this.complete(this.generationModel, system, user, 2048, userId);
    return text ?? mockCoverLetter(profile, job, tone);
  }

  // --- Chat (Fase 5): primitiva de bajo nivel con soporte de tool-use ---

  /**
   * Una llamada de chat a Claude. Devuelve el texto y los tool_use pedidos (el
   * ejecutor de herramientas vive en ChatService). En modo mock responde de
   * forma determinista y sin herramientas, para que el bucle termine enseguida.
   */
  async chatComplete(
    model: string,
    system: string,
    messages: Anthropic.MessageParam[],
    tools?: Anthropic.Tool[],
    maxTokens = 2048,
  ): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: unknown }> }> {
    if (!this.client) return { text: mockChatReply(messages), toolUses: [] };

    const message = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      ...(tools && tools.length ? { tools } : {}),
    });
    this.logger.log(
      `IA chat ${model} in=${message.usage.input_tokens} out=${message.usage.output_tokens}`,
    );

    let text = '';
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolUses.push({ id: block.id, name: block.name, input: block.input });
      }
    }
    return { text, toolUses };
  }

  // --- Fase 1: parsing de CV subido (se mantiene) ---

  async parseResume(resumeText: string): Promise<ParsedResume> {
    const system =
      'Extrae la información profesional del CV y devuélvela EXCLUSIVAMENTE como ' +
      'JSON válido. No inventes datos: usa solo lo que aparece en el texto.';
    const user =
      'Forma exacta: {"headline": string, "summary": string, "skills": string[], ' +
      '"experience": [{"company": string, "role": string, "startDate": string, "endDate": string, "description": string}], ' +
      '"education": [{"institution": string, "degree": string, "field": string}]}\n\nCV:\n' +
      resumeText.slice(0, 30_000);

    return this.completeJson(this.fastModel, system, user, parsedResumeSchema, () =>
      mockParseResume(resumeText),
    );
  }
}

// --- Helpers de módulo (puros) ---

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

/** Texto plano del CV generado, para calcular el score ATS. */
function resumeText(resume: GeneratedResume): string {
  return [
    resume.headline,
    resume.summary,
    resume.skills.join(' '),
    ...resume.experience.map((e) => `${e.role} ${e.company} ${e.bullets.join(' ')}`),
    ...resume.education.map((e) => `${e.degree ?? ''} ${e.field ?? ''} ${e.institution}`),
  ].join(' ');
}

// --- Mocks deterministas (modo desarrollo sin clave de IA) ---

function mockRequirements(job: JobContext): JobRequirements {
  const skills = ['TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS', 'Go']
    .filter((s) => job.description.toLowerCase().includes(s.toLowerCase()));
  const base = skills.length ? skills : ['Comunicación', 'Trabajo en equipo'];
  return {
    requiredSkills: base.slice(0, 4),
    niceToHaveSkills: base.slice(4),
    seniority: /senior|sr\.?/i.test(job.title) ? 'senior' : 'mid',
    atsKeywords: [...new Set([...base, job.title.split(' ')[0] ?? ''])].filter(Boolean),
    summary: `Rol de ${job.title} en ${job.company} (extracción demo).`,
  };
}

function mockResume(profile: ProfileContext, requirements: JobRequirements): GeneratedResume {
  const exp = Array.isArray(profile.experienceJson) ? profile.experienceJson : [];
  const edu = Array.isArray(profile.educationJson) ? profile.educationJson : [];
  return {
    headline: profile.headline ?? 'Profesional',
    summary:
      profile.summary ??
      `Perfil orientado a ${requirements.requiredSkills.join(', ')} (generado en modo demo).`,
    skills: profile.skills.length ? profile.skills : requirements.requiredSkills,
    experience: (exp as Array<Record<string, unknown>>).map((e) => ({
      company: String(e.company ?? 'Empresa'),
      role: String(e.role ?? 'Rol'),
      startDate: e.startDate ? String(e.startDate) : undefined,
      endDate: e.endDate ? String(e.endDate) : undefined,
      bullets: [String(e.description ?? 'Experiencia relevante.')],
    })),
    education: (edu as Array<Record<string, unknown>>).map((e) => ({
      institution: String(e.institution ?? 'Institución'),
      degree: e.degree ? String(e.degree) : undefined,
      field: e.field ? String(e.field) : undefined,
    })),
  };
}

function mockCoverLetter(
  profile: ProfileContext,
  job: JobContext,
  tone: CoverLetterTone,
): string {
  return (
    `Estimado equipo de ${job.company}:\n\n` +
    `Me dirijo a ustedes con gran interés en la posición de ${job.title}. ` +
    `${profile.summary ?? 'Cuento con experiencia relevante para el rol.'}\n\n` +
    `Mis habilidades en ${profile.skills.slice(0, 4).join(', ')} encajan con lo que buscan.\n\n` +
    `Quedo a su disposición.\n\n(Carta generada en modo demo, tono ${tone}.)`
  );
}

/** Respuesta de chat mock: usa el último mensaje del usuario para contextualizar. */
function mockChatReply(messages: Anthropic.MessageParam[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  let text = '';
  if (typeof lastUser?.content === 'string') text = lastUser.content;
  else if (Array.isArray(lastUser?.content)) {
    const b = lastUser.content.find((c) => c.type === 'text');
    if (b && b.type === 'text') text = b.text;
  }
  return (
    `(Respuesta demo — configura ANTHROPIC_API_KEY para respuestas reales con IA.) ` +
    `Sobre "${text.slice(0, 80)}": te recomiendo concretar tu objetivo, apoyarte en tu ` +
    `perfil y practicar con ejemplos. ¿Quieres que profundicemos en algún punto?`
  );
}

function mockParseResume(resumeText: string): ParsedResume {
  const skills = ['TypeScript', 'React', 'Node.js']
    .filter((s) => resumeText.toLowerCase().includes(s.toLowerCase()))
    .concat('Comunicación');
  return {
    headline: 'Perfil extraído (modo demo)',
    summary: 'Resumen demo. Configura ANTHROPIC_API_KEY para extracción real con IA.',
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
