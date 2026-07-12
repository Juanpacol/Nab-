/**
 * Score ATS: cobertura de las keywords de la vacante en el texto del CV.
 * Métrica simple y transparente (0–100) reutilizada por api (al generar) y web
 * (para mostrar el badge). Normaliza acentos y mayúsculas para comparar.
 */

const DIACRITICS = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

/**
 * Devuelve el porcentaje de keywords ATS presentes en el texto del CV y el
 * detalle de cuáles faltan (útil para sugerir mejoras al usuario).
 */
export function atsScore(
  resumeText: string,
  atsKeywords: string[],
): { score: number; matched: string[]; missing: string[] } {
  const unique = [...new Set(atsKeywords.map((k) => k.trim()).filter(Boolean))];
  if (unique.length === 0) return { score: 0, matched: [], missing: [] };

  const haystack = normalize(resumeText);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of unique) {
    if (haystack.includes(normalize(kw))) matched.push(kw);
    else missing.push(kw);
  }
  return {
    score: Math.round((matched.length / unique.length) * 100),
    matched,
    missing,
  };
}
