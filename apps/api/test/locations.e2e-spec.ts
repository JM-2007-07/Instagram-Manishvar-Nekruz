import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp, createUser, loginAs, resetDb, withOrigin } from './helpers';

interface Loc {
  id: string;
  name: string;
  slug: string;
  city: string;
}

describe('Locations: справочник мест', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    userCookie = await loginAs(app, await createUser(app));
    adminCookie = await loginAs(app, await createUser(app, { role: 'ADMIN' }));
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const get = (path: string, c: string | null = userCookie) => {
    const req = request(server()).get(`/api/v1${path}`);
    return c ? req.set('Cookie', c) : req;
  };
  const send = (
    method: 'post' | 'patch' | 'delete',
    path: string,
    c: string | null = adminCookie,
  ) => {
    const req = request(server())[method](`/api/v1${path}`).set(withOrigin());
    return c ? req.set('Cookie', c) : req;
  };
  const valid = { name: 'Eiffel Tower', city: 'Paris', country: 'France' };
  const seed = (name: string, city: string) =>
    prisma.location.create({
      data: { name, city, country: 'X', slug: `${name}-${city}`.toLowerCase().replace(/ /g, '-') },
    });

  it('поиск: без регистра, по части названия и города', async () => {
    await seed('Eiffel Tower', 'Paris');
    await seed('Louvre', 'Paris');
    await seed('Big Ben', 'London');

    const byName = await get('/locations?q=EIFFEL').expect(200);
    expect(byName.body.items.map((l: Loc) => l.name)).toEqual(['Eiffel Tower']);
    const byCity = await get('/locations?q=pari').expect(200);
    expect(byCity.body.items).toHaveLength(2);
    const none = await get('/locations?q=zzz').expect(200);
    expect(none.body).toEqual({ items: [], nextCursor: null });
  });

  it('поиск: пагинация по курсору', async () => {
    for (const n of ['A', 'B', 'C']) await seed(`Place ${n}`, 'Town');
    const p1 = await get('/locations?limit=2').expect(200);
    expect(p1.body.items.map((l: Loc) => l.name)).toEqual(['Place A', 'Place B']);
    expect(p1.body.nextCursor).toEqual(expect.any(String));
    const p2 = await get(`/locations?limit=2&cursor=${p1.body.nextCursor}`).expect(200);
    expect(p2.body.items.map((l: Loc) => l.name)).toEqual(['Place C']);
    expect(p2.body.nextCursor).toBeNull();
    await get('/locations?cursor=%25%25bad').expect(400);
  });

  it('поиск и карточка требуют сессию', async () => {
    const loc = await seed('Eiffel Tower', 'Paris');
    await get('/locations', null).expect(401);
    await get(`/locations/${loc.id}`, null).expect(401);
  });

  it('карточка: найдено и 404', async () => {
    const loc = await seed('Eiffel Tower', 'Paris');
    const res = await get(`/locations/${loc.id}`).expect(200);
    expect(res.body).toMatchObject({ id: loc.id, name: 'Eiffel Tower', postCount: 0 });
    await get('/locations/00000000-0000-4000-8000-000000000000').expect(404);
    await get('/locations/not-a-uuid').expect(400);
  });

  it('создание: ADMIN -> 201 со slug, повтор -> 409', async () => {
    const res = await send('post', '/locations').send(valid).expect(201);
    expect(res.body).toMatchObject({ ...valid, slug: 'eiffel-tower-paris' });
    await send('post', '/locations').send(valid).expect(409);
  });

  it('создание: USER -> 403, без сессии -> 401, без Origin -> 403', async () => {
    await send('post', '/locations', userCookie).send(valid).expect(403);
    await send('post', '/locations', null).send(valid).expect(401);
    await request(server())
      .post('/api/v1/locations')
      .set('Cookie', adminCookie)
      .send(valid)
      .expect(403);
    expect(await prisma.location.count()).toBe(0);
  });

  it('создание: валидация -> 400', async () => {
    await send('post', '/locations').send({ name: 'X' }).expect(400);
    await send('post', '/locations')
      .send({ ...valid, name: '' })
      .expect(400);
    await send('post', '/locations')
      .send({ ...valid, latitude: 91 })
      .expect(400);
    await send('post', '/locations')
      .send({ ...valid, longitude: -181 })
      .expect(400);
    await send('post', '/locations')
      .send({ ...valid, extra: 1 })
      .expect(400);
  });

  it('изменение: ADMIN меняет, USER -> 403, нет места -> 404', async () => {
    const loc = await seed('Eiffel Tower', 'Paris');
    const res = await send('patch', `/locations/${loc.id}`).send({ state: 'IDF' }).expect(200);
    expect(res.body).toMatchObject({ id: loc.id, state: 'IDF' });
    await send('patch', `/locations/${loc.id}`, userCookie).send({ state: 'x' }).expect(403);
    await send('patch', `/locations/${loc.id}`).send({ latitude: 100 }).expect(400);
    await send('patch', '/locations/00000000-0000-4000-8000-000000000000')
      .send({ state: 'x' })
      .expect(404);
  });

  it('удаление: USER -> 403, ADMIN -> 204, повтор -> 404', async () => {
    const loc = await seed('Eiffel Tower', 'Paris');
    await send('delete', `/locations/${loc.id}`, userCookie).expect(403);
    await send('delete', `/locations/${loc.id}`).expect(204);
    expect(await prisma.location.count()).toBe(0);
    await send('delete', `/locations/${loc.id}`).expect(404);
  });
});
