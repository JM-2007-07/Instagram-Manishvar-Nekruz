import { Body, Controller, Get, INestApplication, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsInt, IsString, Min } from 'class-validator';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { setupApp } from '@/app.setup';
import type { Env } from '@/config/env';
import { Prisma } from '@/generated/prisma/client';

class TestDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  age!: number;
}

// Контроллер существует только в этом e2e-файле: проверяет общие pipe/guard/filter без реальных модулей.
@Controller('test-foundation')
class TestFoundationController {
  @Post('validate')
  validate(@Body() dto: TestDto) {
    return { ok: true, name: dto.name };
  }

  @Get('ping')
  ping() {
    return { pong: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }

  @Get('duplicate')
  duplicate(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
  }

  @Get('missing')
  missing(): never {
    throw new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
  }
}

describe('HTTP foundation (pipe, guard, filter)', () => {
  let app: INestApplication;
  let origin: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestFoundationController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    origin = app.get(ConfigService<Env, true>).get('WEB_ORIGIN', { infer: true });
    // Ожидаемые 500 не засоряют вывод тестов стеком в логе.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('ошибки в формате контракта', () => {
    it('неизвестный маршрут: 404 с requestId, совпадающим с X-Request-Id', async () => {
      const res = await request(server()).get('/api/v1/no-such-route').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
      expect(typeof res.body.message).toBe('string');
      expect(res.body.requestId).toBeTruthy();
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });

    it('внутренняя ошибка: 500 INTERNAL_ERROR без stack и текста исключения', async () => {
      const res = await request(server()).get('/api/v1/test-foundation/boom').expect(500);
      expect(res.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
      expect(res.body.requestId).toBeTruthy();
      expect(JSON.stringify(res.body)).not.toMatch(/stack|secret internal detail/);
    });

    it('Prisma P2002 превращается в 409 CONFLICT', async () => {
      const res = await request(server()).get('/api/v1/test-foundation/duplicate').expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    });

    it('Prisma P2025 превращается в 404 NOT_FOUND', async () => {
      const res = await request(server()).get('/api/v1/test-foundation/missing').expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });

  describe('валидация', () => {
    const post = (body: object) =>
      request(server()).post('/api/v1/test-foundation/validate').set('Origin', origin).send(body);

    it('корректное тело проходит', async () => {
      const res = await post({ name: 'ann', age: 3 }).expect(201);
      expect(res.body).toEqual({ ok: true, name: 'ann' });
    });

    it('невалидный DTO: 400 VALIDATION_ERROR с details[{field,message}]', async () => {
      const res = await post({ name: 5, age: 0 }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      const fields = res.body.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'age']));
      for (const d of res.body.details) {
        expect(typeof d.message).toBe('string');
      }
    });

    it('лишнее поле: 400 VALIDATION_ERROR', async () => {
      const res = await post({ name: 'ann', age: 3, isAdmin: true }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain('isAdmin');
    });

    it('битый JSON в теле: 400 BAD_REQUEST с requestId без деталей парсера', async () => {
      const res = await request(server())
        .post('/api/v1/test-foundation/validate')
        .set('Origin', origin)
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
      expect(res.body.requestId).toBeTruthy();
      expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|Unexpected/);
    });
  });

  describe('защита от CSRF (OriginGuard)', () => {
    const body = { name: 'ann', age: 3 };

    it('POST без Origin: 403 CSRF_REJECTED', async () => {
      const res = await request(server())
        .post('/api/v1/test-foundation/validate')
        .send(body)
        .expect(403);
      expect(res.body).toMatchObject({ statusCode: 403, code: 'CSRF_REJECTED' });
    });

    it('POST с чужим Origin: 403 CSRF_REJECTED', async () => {
      const res = await request(server())
        .post('/api/v1/test-foundation/validate')
        .set('Origin', 'https://evil.example')
        .send(body)
        .expect(403);
      expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('POST с Origin = WEB_ORIGIN проходит', async () => {
      await request(server())
        .post('/api/v1/test-foundation/validate')
        .set('Origin', origin)
        .send(body)
        .expect(201);
    });

    it.each([
      ['cross-site', 403],
      ['same-site', 403],
      ['same-origin', 201],
    ])('POST с верным Origin и Sec-Fetch-Site: %s -> %i', async (site, status) => {
      const res = await request(server())
        .post('/api/v1/test-foundation/validate')
        .set('Origin', origin)
        .set('Sec-Fetch-Site', site)
        .send(body)
        .expect(status);
      if (status === 403) expect(res.body.code).toBe('CSRF_REJECTED');
    });

    it('GET без Origin проходит', async () => {
      await request(server()).get('/api/v1/test-foundation/ping').expect(200);
    });
  });
});
