import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import type { ChatContext } from '@nab/database';
import { toPgVector } from '@nab/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { embedQuery } from '../jobs/embed.js';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'soporte@nab.app';
const MAX_HISTORY = 10;

/** Herramientas del career coach (el modelo pide; ChatService ejecuta). */
const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_profile',
    description: 'Obtiene el perfil profesional del usuario (headline, resumen, skills, experiencia, roles deseados).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_applications',
    description: 'Lista las aplicaciones del usuario con su estado (para analizar su búsqueda).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_jobs',
    description: 'Busca vacantes activas por palabra clave (título, empresa o skill).',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Palabra clave a buscar' } },
      required: ['query'],
    },
  },
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Procesa un turno de chat: gestiona la sesión, persiste el mensaje del
   * usuario, genera la respuesta (RAG de soporte o tool-use del coach) y la
   * persiste. Devuelve el texto completo y el id de sesión; el controlador lo
   * emite en streaming (SSE) por trozos.
   */
  async respond(
    userId: string,
    contextType: ChatContext,
    content: string,
    sessionId?: string,
  ): Promise<{ sessionId: string; text: string }> {
    const session = await this.resolveSession(userId, contextType, sessionId, content);
    const history = await this.loadHistory(session.id);

    await this.prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'USER', content },
    });

    const text =
      contextType === 'SUPPORT'
        ? await this.runSupport(content, history)
        : await this.runCoach(userId, content, history);

    await this.prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: text },
    });

    return { sessionId: session.id, text };
  }

  // --- Soporte: RAG sobre HelpArticle ---

  private async runSupport(message: string, history: Anthropic.MessageParam[]): Promise<string> {
    const articles = await this.retrieveHelp(message);
    const context = articles.length
      ? articles.map((a) => `## ${a.title}\n${a.content}`).join('\n\n')
      : '(No hay artículos relevantes.)';
    const system =
      `Eres el asistente de soporte de Nab (plataforma de búsqueda de empleo con IA). ` +
      `Responde en español, breve y claro, USANDO SOLO la información de los artículos de ayuda ` +
      `de abajo. Si la respuesta no está ahí, dilo y sugiere escribir a ${SUPPORT_EMAIL}.\n\n` +
      `Artículos de ayuda:\n${context}`;

    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];
    const { text } = await this.ai.chatComplete(this.ai.fastModel, system, messages, undefined, 1024);
    return text || `No encontré eso en la ayuda. Escríbenos a ${SUPPORT_EMAIL}.`;
  }

  /** Recupera los artículos de ayuda más cercanos (coseno pgvector; fallback ILIKE). */
  private async retrieveHelp(query: string): Promise<Array<{ title: string; content: string }>> {
    try {
      const vec = toPgVector(await embedQuery(query));
      const rows = await this.prisma.$queryRawUnsafe<Array<{ title: string; content: string }>>(
        `SELECT title, content FROM "HelpArticle"
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector LIMIT 3`,
        vec,
      );
      if (rows.length) return rows;
    } catch (err) {
      this.logger.warn(`RAG semántico falló, uso texto: ${String(err)}`);
    }
    return this.prisma.helpArticle.findMany({
      where: { OR: [{ title: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }] },
      select: { title: true, content: true },
      take: 3,
    });
  }

  // --- Career coach: tool-use ---

  private async runCoach(
    userId: string,
    message: string,
    history: Anthropic.MessageParam[],
  ): Promise<string> {
    const system =
      `Eres un career coach experto dentro de Nab. Antes de aconsejar, usa las herramientas ` +
      `para consultar el perfil, las aplicaciones y las vacantes del usuario cuando sea útil. ` +
      `Responde en español con consejos concretos y accionables. No inventes datos del usuario: ` +
      `si no los tienes, pídelos o usa una herramienta.`;

    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];

    for (let i = 0; i < 5; i++) {
      const { text, toolUses } = await this.ai.chatComplete(
        this.ai.generationModel,
        system,
        messages,
        COACH_TOOLS,
      );
      if (toolUses.length === 0) return text || 'Cuéntame un poco más para poder ayudarte.';

      // Reconstituye el turno del asistente (texto opcional + tool_use) y ejecuta.
      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (text) assistantContent.push({ type: 'text', text });
      for (const t of toolUses) {
        assistantContent.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input });
      }
      messages.push({ role: 'assistant', content: assistantContent });

      const results: Anthropic.ContentBlockParam[] = [];
      for (const t of toolUses) {
        results.push({
          type: 'tool_result',
          tool_use_id: t.id,
          content: await this.execTool(userId, t.name, t.input),
        });
      }
      messages.push({ role: 'user', content: results });
    }
    return 'No pude completar la consulta con las herramientas disponibles.';
  }

  /** Ejecuta una herramienta del coach contra la base de datos del usuario. */
  private async execTool(userId: string, name: string, input: unknown): Promise<string> {
    try {
      if (name === 'get_profile') {
        const profile = await this.prisma.profile.findUnique({
          where: { userId },
          select: {
            headline: true,
            summary: true,
            skills: true,
            experienceJson: true,
            desiredRoles: true,
          },
        });
        return JSON.stringify(profile ?? { error: 'sin perfil' });
      }
      if (name === 'get_applications') {
        const apps = await this.prisma.application.findMany({
          where: { userId },
          select: { status: true, submittedAt: true, job: { select: { title: true, company: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 30,
        });
        return JSON.stringify(apps);
      }
      if (name === 'search_jobs') {
        const query = (input as { query?: string })?.query ?? '';
        const jobs = await this.prisma.job.findMany({
          where: {
            isActive: true,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { company: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          select: { title: true, company: true, location: true, remote: true },
          take: 5,
        });
        return JSON.stringify(jobs);
      }
      return JSON.stringify({ error: `herramienta desconocida: ${name}` });
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }

  // --- Sesiones e historial ---

  private async resolveSession(userId: string, contextType: ChatContext, sessionId: string | undefined, firstMessage: string) {
    if (sessionId) {
      const existing = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true },
      });
      if (existing) return existing;
    }
    return this.prisma.chatSession.create({
      data: { userId, contextType, title: firstMessage.slice(0, 48) },
      select: { id: true },
    });
  }

  private async loadHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY,
      select: { role: true, content: true },
    });
    return rows
      .reverse()
      .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }) as Anthropic.MessageParam);
  }

  /** Sesiones del usuario (para el historial de la UI). */
  listSessions(userId: string, contextType: ChatContext) {
    return this.prisma.chatSession.findMany({
      where: { userId, contextType },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
      take: 30,
    });
  }

  async getMessages(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return [];
    return this.prisma.chatMessage.findMany({
      where: { sessionId, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true },
    });
  }
}
