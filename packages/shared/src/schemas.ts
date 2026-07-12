/**
 * Schemas Zod espejo del modelo de datos. Se usan para validación
 * end-to-end: DTOs de la API, formularios del frontend y respuestas de IA.
 */
import { z } from 'zod';
import { PAID_PLANS, type PlanId } from './plans.js';

// --- Enums (deben coincidir con schema.prisma) ---
export const remotePreferenceSchema = z.enum(['ANY', 'REMOTE', 'HYBRID', 'ONSITE']);
export const applicationStatusSchema = z.enum([
  'SAVED',
  'APPLIED',
  'VIEWED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
]);
export const planSchema = z.enum(['FREE', 'BASIC', 'PRO', 'ULTRA']);
export const chatContextSchema = z.enum(['SUPPORT', 'CAREER_COACH']);

// --- Auth ---
export const registerSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  name: z.string().min(2, 'Ingresa tu nombre').optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateAccountSchema = z.object({
  name: z.string().min(2, 'Ingresa tu nombre').max(80).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/** Respuesta pública del usuario autenticado (sin datos sensibles). */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: string;
  creditsRemaining: number;
  emailVerified: boolean;
  onboarded: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// --- Perfil ---
export const experienceItemSchema = z.object({
  company: z.string(),
  role: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export const educationItemSchema = z.object({
  institution: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const profileSchema = z.object({
  headline: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(experienceItemSchema).default([]),
  education: z.array(educationItemSchema).default([]),
  locations: z.array(z.string()).default([]),
  desiredRoles: z.array(z.string()).default([]),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  remotePreference: remotePreferenceSchema.default('ANY'),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// --- Búsqueda de vacantes ---
export const jobSearchSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().int().optional(),
  semantic: z.boolean().default(false),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type JobSearchInput = z.infer<typeof jobSearchSchema>;

// --- Aplicación ---
export const createApplicationSchema = z.object({
  jobId: z.string(),
  resumeId: z.string().optional(),
  coverLetterId: z.string().optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: applicationStatusSchema,
  notes: z.string().optional(),
});

export const applicationNotesSchema = z.object({
  notes: z.string().max(2000),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

// --- IA: extracción estructurada de vacante (schema forzado en el LLM) ---
export const jobRequirementsSchema = z.object({
  requiredSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()).default([]),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'unknown']),
  yearsExperience: z.number().int().nonnegative().optional(),
  atsKeywords: z.array(z.string()),
  summary: z.string(),
});
export type JobRequirements = z.infer<typeof jobRequirementsSchema>;

// --- IA: parsing de CV subido ---
export const parsedResumeSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()),
  experience: z.array(experienceItemSchema),
  education: z.array(educationItemSchema),
});
export type ParsedResume = z.infer<typeof parsedResumeSchema>;

// --- IA: generación de CV personalizado (Fase 3) ---
export const generatedExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export const generatedResumeSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(generatedExperienceSchema),
  education: z.array(educationItemSchema),
});
export type GeneratedResume = z.infer<typeof generatedResumeSchema>;

export const coverLetterToneSchema = z.enum([
  'professional',
  'enthusiastic',
  'concise',
  'friendly',
]);
export type CoverLetterTone = z.infer<typeof coverLetterToneSchema>;

/** Peticiones de generación (el CV/carta se personaliza para una vacante). */
export const generateResumeSchema = z.object({ jobId: z.string() });
export type GenerateResumeInput = z.infer<typeof generateResumeSchema>;

export const generateCoverLetterSchema = z.object({
  jobId: z.string(),
  tone: coverLetterToneSchema.default('professional'),
});
export type GenerateCoverLetterInput = z.infer<typeof generateCoverLetterSchema>;

// --- Facturación (Fase 6) ---
export const checkoutSchema = z.object({
  planId: z.enum(PAID_PLANS as [PlanId, ...PlanId[]]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// --- Notificaciones push (Fase 7, app móvil) ---
export const pushTokenSchema = z.object({
  token: z.string().min(1),
});
export type PushTokenInput = z.infer<typeof pushTokenSchema>;

// --- Chat ---
export const chatMessageSchema = z.object({
  sessionId: z.string().optional(),
  contextType: chatContextSchema.default('SUPPORT'),
  content: z.string().min(1).max(4000),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
