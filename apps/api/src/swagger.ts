import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

// Один способ собрать документ для Swagger UI (main.ts) и для экспорта в docs/api/openapi.json (openapi.ts).
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Photogram API')
    .setDescription('REST API /api/v1. Authentication: HttpOnly session cookie.')
    .setVersion('1.0')
    .addCookieAuth('sid')
    .build();
  return SwaggerModule.createDocument(app, config);
}
