'use client';

import type { CandidateQuestion } from '@nab/shared';
import { Textarea } from '@nab/ui';

interface QuestionRendererProps {
  question: CandidateQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
      <p className="text-base leading-relaxed text-foreground">{question.prompt}</p>

      {question.type === 'multiple_choice' && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-sm border border-border p-3 transition-colors hover:bg-surface-2"
            >
              <input
                type="radio"
                name={question.id}
                checked={value === opt.id}
                onChange={() => onChange(opt.id)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="text-sm text-foreground">{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'open_text' && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          placeholder="Escribe tu respuesta…"
        />
      )}

      {question.type === 'code' && (
        <div className="space-y-2">
          {question.starterCode && (
            <pre className="overflow-x-auto rounded-sm bg-bg p-3 font-mono text-xs text-muted">
              {question.starterCode}
            </pre>
          )}
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Escribe tu solución…"
          />
        </div>
      )}
    </div>
  );
}
