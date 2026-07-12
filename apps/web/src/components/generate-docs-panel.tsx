'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card } from '@nab/ui';
import { COVER_LETTER_TONES, type CoverLetterTone } from '@nab/shared';
import {
  generateResumeAction,
  generateCoverLetterAction,
  type GenerateResumeState,
  type GenerateCoverLetterState,
} from '@/app/actions/ai';

/**
 * Panel de generación con IA (Fase 3) en el detalle de la vacante: CV
 * personalizado con score ATS + descarga a PDF (impresión del navegador) y
 * carta de presentación editable con tono seleccionable.
 */
export function GenerateDocsPanel({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [resume, setResume] = useState<GenerateResumeState | null>(null);
  const [letter, setLetter] = useState<GenerateCoverLetterState | null>(null);
  const [letterText, setLetterText] = useState('');
  const [tone, setTone] = useState<CoverLetterTone>('professional');
  const [resumePending, startResume] = useTransition();
  const [letterPending, startLetter] = useTransition();

  function onGenerateResume() {
    startResume(async () => setResume(await generateResumeAction(jobId)));
  }
  function onGenerateLetter() {
    startLetter(async () => {
      const res = await generateCoverLetterAction(jobId, tone);
      setLetter(res);
      if (res.coverLetter) setLetterText(res.coverLetter.content);
    });
  }

  const cv = resume?.resume?.contentJson;

  return (
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden; } #cv-print, #cv-print * { visibility: visible; } #cv-print { position: absolute; inset: 0; padding: 2rem; } }`}</style>

      {/* --- CV personalizado --- */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-foreground">CV personalizado con IA</h2>
            <p className="text-sm text-muted">Adaptado a esta vacante. Cuesta 1 crédito.</p>
          </div>
          <Button onClick={onGenerateResume} disabled={resumePending}>
            {resumePending ? 'Generando…' : cv ? 'Regenerar' : 'Generar CV'}
          </Button>
        </div>

        {resume?.error && <p className="mt-4 text-sm text-danger">{resume.error}</p>}

        {cv && resume?.ats && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant={resume.ats.score >= 70 ? 'primary' : undefined}>
                ATS {resume.ats.score}%
              </Badge>
              {typeof resume.creditsRemaining === 'number' && (
                <span className="text-xs text-muted">
                  {resume.creditsRemaining} créditos restantes
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto">
                Descargar PDF
              </Button>
            </div>
            {resume.ats.missing.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Keywords que faltan: {resume.ats.missing.join(', ')}
              </p>
            )}

            <div id="cv-print" className="mt-5 space-y-4 rounded-md border border-border bg-bg p-5">
              <div>
                <h3 className="font-display text-xl text-foreground">{cv.headline}</h3>
                <p className="mt-1 text-sm text-muted">{cv.summary}</p>
              </div>
              {cv.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {cv.skills.map((s) => (
                    <span key={s} className="rounded-sm bg-primary-soft px-2 py-0.5 text-xs text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {cv.experience.map((e, i) => (
                <div key={i}>
                  <p className="font-medium text-foreground">
                    {e.role} · {e.company}
                    {e.startDate ? ` (${e.startDate}${e.endDate ? `–${e.endDate}` : ''})` : ''}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                    {e.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {cv.education.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">Educación</p>
                  <ul className="mt-1 text-sm text-muted">
                    {cv.education.map((e, i) => (
                      <li key={i}>
                        {[e.degree, e.field].filter(Boolean).join(', ')} — {e.institution}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* --- Carta de presentación --- */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-foreground">Carta de presentación</h2>
            <p className="text-sm text-muted">Para {jobTitle}. Editable. Cuesta 1 crédito.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as CoverLetterTone)}
              className="h-9 rounded-sm border border-border bg-bg px-2 text-sm text-foreground"
            >
              {COVER_LETTER_TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <Button onClick={onGenerateLetter} disabled={letterPending}>
              {letterPending ? 'Generando…' : letter?.coverLetter ? 'Regenerar' : 'Generar carta'}
            </Button>
          </div>
        </div>

        {letter?.error && <p className="mt-4 text-sm text-danger">{letter.error}</p>}

        {letter?.coverLetter && (
          <div className="mt-4 space-y-3">
            <textarea
              value={letterText}
              onChange={(e) => setLetterText(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-border bg-bg p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(letterText)}
              >
                Copiar
              </Button>
              {typeof letter.creditsRemaining === 'number' && (
                <span className="text-xs text-muted">
                  {letter.creditsRemaining} créditos restantes
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
