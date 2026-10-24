import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { setupWebProxy } from './web-proxy';
import type { Env } from './config/env';
import { buildOpenApiDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  setupWebProxy(app, config.get('WEB_UPSTREAM_URL', { infer: true }));
  setupApp(app, { trustProxy: config.get('TRUST_PROXY', { infer: true }) });

  // Swagger UI нужен только при разработке; в production документацию не публикуем.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
