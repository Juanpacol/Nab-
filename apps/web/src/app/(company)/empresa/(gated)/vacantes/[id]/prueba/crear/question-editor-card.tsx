'use client';

import { Input, Textarea } from '@nab/ui';
import type { TechQuestion } from '@nab/shared';

const TYPE_LABEL: Record<TechQuestion['type'], string> = {
  multiple_choice: 'Opción múltiple',
  open_text: 'Respuesta abierta',
  code: 'Código',
};

interface QuestionEditorCardProps {
  question: TechQuestion;
  index: number;
  onChange: (question: TechQuestion) => void;
}

/** Edición de texto (prompt, opciones, clave correcta, código inicial) — no permite agregar/quitar preguntas en v1. */
export function QuestionEditorCard({ question, index, onChange }: QuestionEditorCardProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          Pregunta {index + 1} · {TYPE_LABEL[question.type]}
        </span>
        <span className="text-xs text-muted">{question.estimatedMinutes} min</span>
      </div>

      <Textarea
        value={question.prompt}
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        rows={3}
      />

      {question.type === 'multiple_choice' && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Marca la opción correcta:</p>
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOptionId === opt.id}
                onChange={() => onChange({ ...question, correctOptionId: opt.id })}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <Input
                value={opt.text}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: question.options.map((o) =>
                      o.id === opt.id ? { ...o, text: e.target.value } : o,
                    ),
                  })
                }
                className="h-9"
              />
            </label>
          ))}
        </div>
      )}

      {question.type === 'open_text' && (
        <div>
          <p className="mb-1 text-xs text-muted">Puntos esperados en la respuesta (guía del evaluador):</p>
          <ul className="list-inside list-disc text-sm text-muted">
            {question.expectedPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {question.type === 'code' && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Código inicial (opcional)</label>
            <Textarea
              value={question.starterCode ?? ''}
              onChange={(e) => onChange({ ...question, starterCode: e.target.value })}
              rows={4}
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted">Enfoque esperado (guía del evaluador): {question.expectedApproach}</p>
        </div>
      )}
    </div>
  );
}
