/**
 * Schemas Zod espejo del modelo de datos. Se usan para validación
 * end-to-end: DTOs de la API, formularios del frontend y respuestas de IA.
 */
import { z } from 'zod';

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

// --- Chat ---
export const chatMessageSchema = z.object({
  sessionId: z.string().optional(),
  contextType: chatContextSchema.default('SUPPORT'),
  content: z.string().min(1).max(4000),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
