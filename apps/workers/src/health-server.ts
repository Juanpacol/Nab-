import { createServer } from 'node:http';
import { logger } from './logger.js';

/**
 * Los workers no sirven HTTP por sí mismos (solo consumen colas de BullMQ),
 * pero algunas plataformas de hosting gratuito (Render free tier, sin
 * "background workers") solo aceptan "web services" que respondan en un
 * puerto — y los mantienen despiertos en base a tráfico HTTP entrante, no a
 * actividad de Redis. Este servidor mínimo existe solo para que un ping
 * externo (cron-job.org, UptimeRobot) evite que el proceso se duerma.
 */
export function startHealthServer() {
  const port = Number(process.env.PORT ?? 4100);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'nab-workers' }));
  });
  server.listen(port, () => {
    logger.info(`Health server de workers escuchando en :${port}`);
  });
  return server;
}
