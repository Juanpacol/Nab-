import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de privacidad' };

export default function PrivacyPage() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p>Última actualización: enero de 2026.</p>

      <p>
        En Nab (&ldquo;nosotros&rdquo;) respetamos tu privacidad. Este documento explica qué datos
        recopilamos, para qué los usamos y qué control tienes sobre ellos.
      </p>

      <h2>Datos que recopilamos</h2>
      <ul>
        <li>Datos de cuenta: nombre, correo electrónico y contraseña (cifrada).</li>
        <li>
          Datos de perfil profesional: CV, experiencia, educación, habilidades y
          preferencias de búsqueda que tú nos proporcionas.
        </li>
        <li>
          Datos de uso: aplicaciones enviadas, vacantes guardadas, conversaciones con el
          chatbot y métricas de tu actividad en la plataforma.
        </li>
        <li>Datos de facturación: gestionados por Stripe; nunca almacenamos tu tarjeta.</li>
      </ul>

      <h2>Cómo usamos tus datos</h2>
      <ul>
        <li>Para generar CVs y cartas de presentación personalizados con IA.</li>
        <li>Para recomendarte vacantes relevantes (matching semántico).</li>
        <li>Para procesar tu suscripción y créditos.</li>
        <li>Para mejorar el producto y brindarte soporte.</li>
      </ul>

      <h2>Uso de inteligencia artificial</h2>
      <p>
        Usamos modelos de IA de terceros (Anthropic Claude) para generar contenido y
        responder en el chatbot. Tu información se envía a estos proveedores únicamente
        para procesar tu solicitud; no se usa para entrenar sus modelos.
      </p>

      <h2>Con quién compartimos datos</h2>
      <p>
        No vendemos tus datos. Los compartimos únicamente con proveedores necesarios para
        operar el servicio (procesamiento de pagos, IA, infraestructura en la nube), bajo
        acuerdos de confidencialidad.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder, corregir o eliminar tus datos personales en cualquier momento
        desde tu perfil, o escribiéndonos a{' '}
        <a href="mailto:privacidad@nab.app" className="text-primary hover:underline">
          privacidad@nab.app
        </a>
        . Eliminar tu cuenta borra tu perfil, CVs generados e historial de conversación.
      </p>

      <h2>Contacto</h2>
      <p>
        Para preguntas sobre esta política, escríbenos a{' '}
        <a href="mailto:privacidad@nab.app" className="text-primary hover:underline">
          privacidad@nab.app
        </a>
        .
      </p>
    </>
  );
}
