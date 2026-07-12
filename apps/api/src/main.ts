import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // rawBody: true expone `req.rawBody` (necesario para verificar la firma de
  // los webhooks de Stripe, que requieren el cuerpo sin parsear).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  // Logging estructurado (Pino)
  app.useLogger(app.get(Logger));

  // Seguridad HTTP
  app.use(helmet());

  // CORS para el frontend
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');
  app.enableCors({ origin: origins, credentials: true });

  // Prefijo global de la API
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });

  // Documentación Swagger en /docs
  const config = new DocumentBuilder()
    .setTitle('Nab API')
    .setDescription('API de la plataforma de búsqueda de empleo con IA')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`🚀 API de Nab escuchando en http://localhost:${port} (docs en /docs)`);
}

void bootstrap();
