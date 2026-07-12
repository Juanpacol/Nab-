import type { Metadata } from 'next';
import { Card } from '@nab/ui';
import { ChatPanel } from '@/components/chat-panel';

export const metadata: Metadata = { title: 'Coach IA' };

const SUGGESTIONS = [
  'Prepárame para una entrevista técnica',
  'Analiza mi búsqueda: ¿por qué no me responden?',
  'Recomiéndame vacantes según mi perfil',
];

/**
 * Career Coach (Fase 5): chat con IA y tool-use (perfil, aplicaciones,
 * vacantes) en streaming, con historial de sesión.
 */
export default function CoachPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="mb-4">
        <h1 className="font-display text-3xl text-foreground">Coach IA</h1>
        <p className="mt-1 text-muted">Tu coach de carrera con acceso a tu perfil y aplicaciones.</p>
      </div>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <ChatPanel
          contextType="CAREER_COACH"
          greeting="¡Hola! Soy tu coach de carrera. Puedo revisar tu perfil, tus aplicaciones y buscar vacantes para darte consejos concretos. ¿Por dónde empezamos?"
          suggestions={SUGGESTIONS}
        />
      </Card>
    </div>
  );
}
