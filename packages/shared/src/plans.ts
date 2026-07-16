/**
 * Definición de planes y créditos. Fuente única de verdad para pricing,
 * usada por web (página de precios), api (facturación) y workers.
 */

export type PlanId = 'FREE' | 'BASIC' | 'PRO' | 'ULTRA';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Precio mensual en USD. */
  priceMonthly: number;
  /** Créditos (aplicaciones) incluidos por ciclo. */
  credits: number;
  /** Clave de entorno del price de Stripe (vacío en FREE). */
  stripePriceEnv?: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Gratis',
    priceMonthly: 0,
    credits: 5,
    features: [
      '5 aplicaciones para probar',
      'Búsqueda de vacantes',
      'Seguimiento básico',
    ],
  },
  BASIC: {
    id: 'BASIC',
    name: 'Basic',
    priceMonthly: 19.99,
    credits: 80,
    stripePriceEnv: 'STRIPE_PRICE_BASIC',
    features: [
      '80 aplicaciones al mes',
      'CV y cartas personalizados con IA',
      'Seguimiento de aplicaciones',
      'Bot de soporte',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceMonthly: 39.99,
    credits: 200,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    highlighted: true,
    features: [
      '200 aplicaciones al mes',
      'Todo lo de Basic',
      'Career coach con IA',
      'Matching inteligente "Para ti"',
      'Prioridad en soporte',
    ],
  },
  ULTRA: {
    id: 'ULTRA',
    name: 'Ultra',
    priceMonthly: 79.99,
    credits: 600,
    stripePriceEnv: 'STRIPE_PRICE_ULTRA',
    features: [
      '600 aplicaciones al mes',
      'Todo lo de Pro',
      'Análisis avanzado de búsqueda',
      'Soporte dedicado',
    ],
  },
};

export const PAID_PLANS: PlanId[] = ['BASIC', 'PRO', 'ULTRA'];

/** Costo en créditos por acción. */
export const CREDIT_COSTS = {
  APPLICATION: 1,
  RESUME_GENERATION: 1,
  COVER_LETTER_GENERATION: 1,
  TEST_GENERATION: 5,
  EVALUATION: 2,
  COMPARISON: 1,
} as const;
