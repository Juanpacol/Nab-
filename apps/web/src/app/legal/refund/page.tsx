import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de reembolsos' };

export default function RefundPage() {
  return (
    <>
      <h1>Política de reembolsos</h1>
      <p>Última actualización: enero de 2026.</p>

      <p>
        Queremos que confíes en Nab. Esta es nuestra política de reembolsos para
        suscripciones pagas.
      </p>

      <h2>Cancelación</h2>
      <p>
        Puedes cancelar tu suscripción en cualquier momento desde{' '}
        <strong>Facturación → Gestionar suscripción</strong>. La cancelación detiene la
        renovación automática; conservas el acceso a tu plan hasta el final del período
        ya pagado. No se generan cargos adicionales.
      </p>

      <h2>Reembolsos</h2>
      <ul>
        <li>
          <strong>Primeros 7 días:</strong> si no estás satisfecho con tu primera
          suscripción paga, escríbenos dentro de los 7 días posteriores al cobro y te
          reembolsamos el 100%.
        </li>
        <li>
          <strong>Después de 7 días:</strong> no ofrecemos reembolsos prorrateados por
          el tiempo restante del ciclo, pero puedes cancelar para que no se renueve.
        </li>
        <li>
          <strong>Cobros duplicados o errores técnicos:</strong> los reembolsamos
          siempre, sin importar cuánto tiempo haya pasado.
        </li>
      </ul>

      <h2>Créditos ya utilizados</h2>
      <p>
        Los créditos consumidos (aplicaciones enviadas, CVs o cartas generados) no son
        reembolsables individualmente, ya que representan trabajo de IA ya realizado.
      </p>

      <h2>Cómo solicitar un reembolso</h2>
      <p>
        Escríbenos a{' '}
        <a href="mailto:soporte@nab.app" className="text-primary hover:underline">
          soporte@nab.app
        </a>{' '}
        con el correo de tu cuenta y el motivo. Respondemos en menos de 48 horas
        hábiles.
      </p>
    </>
  );
}
