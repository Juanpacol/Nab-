// Debe ir antes que cualquier otro import: varios módulos leen process.env
// en su propio nivel superior al cargarse (instrument.ts para Sentry,
// AuthModule para JwtModule.register(), QueuesModule para la URL de Redis).
// `ConfigModule.forRoot()` (registrado dentro de AppModule) carga el .env
// DEMASIADO TARDE para esos casos: sus imports ya se resolvieron antes de
// que el array de `imports` de AppModule llegue a evaluarse. Precargar aquí
// con dotenv es lo único que garantiza que process.env esté completo desde
// el primer import.
import 'dotenv/config';
import './instrument.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { validateEnv } from './config/env.validation.js';

// Falla rápido con un mensaje claro si faltan secretos/config de producción,
// en vez de arrancar con defaults de desarrollo o en modo mock silencioso.
validateEnv(process.env);

async function bootstrap() {
  // rawBody: true expone `req.rawBody` (necesario para verificar la firma de
  // los webhooks de Stripe, que requieren el cuerpo sin parsear).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  // Sin esto, PrismaService.onModuleDestroy nunca se dispara en SIGTERM y un
  // deploy/restart puede matar el proceso con requests o conexiones a la DB
  // en vuelo (los workers ya cierran limpio, ver apps/workers/src/main.ts).
  app.enableShutdownHooks();

  // Logging estructurado (Pino)
  app.useLogger(app.get(Logger));

  // Seguridad HTTP
  app.use(helmet());

  // CORS para el frontend
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: origins, credentials: true });

  // Prefijo global de la API
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });

  // Documentación Swagger en /docs — solo fuera de producción. En prod expondría
  // toda la superficie de la API (rutas, DTOs, modelos) a cualquiera sin auth.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nab API')
      .setDescription('API de la plataforma de búsqueda de empleo con IA')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`🚀 API de Nab escuchando en http://localhost:${port} (docs en /docs)`);
}

void bootstrap();
