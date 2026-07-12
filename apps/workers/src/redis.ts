import { URL } from 'node:url';
import type { ConnectionOptions } from 'bullmq';

/**
 * Opciones de conexión Redis para BullMQ. Pasamos un objeto de opciones
 * (no una instancia de ioredis) para que BullMQ gestione su propia conexión
 * y evitar conflictos entre versiones de ioredis.
 */
const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');

export const connection: ConnectionOptions = {
  host: url.hostname,
  port: Number(url.port || 6379),
  password: url.password || undefined,
  // Requerido por los workers de BullMQ.
  maxRetriesPerRequest: null,
};
