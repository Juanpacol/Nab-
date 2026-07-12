import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Términos de servicio' };

export default function TermsPage() {
  return (
    <>
      <h1>Términos de servicio</h1>
      <p>Última actualización: enero de 2026.</p>

      <p>
        Al usar Nab aceptas estos términos. Léelos con atención antes de crear una
        cuenta o suscribirte a un plan de pago.
      </p>

      <h2>El servicio</h2>
      <p>
        Nab es una plataforma que agrega ofertas de empleo, genera CVs y cartas de
        presentación personalizados con IA, y facilita el seguimiento de tus
        aplicaciones. La aplicación a vacantes es <strong>asistida</strong>: preparamos
        tus documentos y te llevamos al sitio de la empresa o registramos el envío; no
        completamos formularios de terceros de forma automática.
      </p>

      <h2>Cuentas y créditos</h2>
      <ul>
        <li>Cada plan incluye un número de créditos mensuales (aplicaciones/generaciones con IA).</li>
        <li>Los créditos no utilizados no acumulan de un ciclo a otro salvo que se indique lo contrario.</li>
        <li>Eres responsable de mantener segura tu contraseña.</li>
      </ul>

      <h2>Suscripciones y pagos</h2>
      <ul>
        <li>Los pagos se procesan mensualmente a través de Stripe.</li>
        <li>Puedes cancelar tu suscripción en cualquier momento desde el portal de facturación.</li>
        <li>Al cancelar, conservas el acceso hasta el final del período ya pagado.</li>
        <li>Ver nuestra política de reembolsos para más detalles.</li>
      </ul>

      <h2>Contenido generado con IA</h2>
      <p>
        Los CVs y cartas generados por IA se basan en la información de tu perfil. Eres
        responsable de revisar y verificar la exactitud del contenido antes de enviarlo
        a un empleador. Nab no garantiza la obtención de entrevistas o empleo.
      </p>

      <h2>Uso aceptable</h2>
      <p>
        No debes usar Nab para publicar información falsa, suplantar identidades, o
        automatizar abusivamente solicitudes hacia terceros. Podemos suspender cuentas
        que infrinjan estos términos.
      </p>

      <h2>Limitación de responsabilidad</h2>
      <p>
        Nab se ofrece &ldquo;tal cual&rdquo;. No garantizamos disponibilidad ininterrumpida ni
        resultados específicos de tu búsqueda de empleo.
      </p>

      <h2>Contacto</h2>
      <p>
        Preguntas sobre estos términos:{' '}
        <a href="mailto:legal@nab.app" className="text-primary hover:underline">
          legal@nab.app
        </a>
        .
      </p>
    </>
  );
}
