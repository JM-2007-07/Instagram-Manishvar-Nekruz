// ДЕМО-ДАННЫЕ ДЛЯ ПОКАЗА (только локально). Работает через REST API, как обычный клиент:
// уведомления, счётчики и права создаёт бизнес-логика сервера, а не прямые записи в БД.
// Нужны запущенный API и пользователи из prisma/seed.ts (alice, bob, carol).
// Запуск: npm run demo-data -w api   (API_URL и WEB_ORIGIN — как в apps/api/.env, по умолчанию localhost)
// Повторный запуск ничего не дублирует: части, которые уже есть (публикации, чаты), пропускаются.
import sharp from 'sharp';

const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api/v1';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const PASSWORD = 'Demo-password-123'; // публичный тестовый пароль из prisma/seed.ts

type Session = { userName: string; id: string; cookie: string };

async function call<T>(
  s: Session | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(API + path, {
    method,
    headers: {
      Origin: ORIGIN, // защита от CSRF пропускает только запросы с адресом сайта
      ...(s ? { Cookie: s.cookie } : {}),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function login(userName: string): Promise<Session> {
  const res = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: userName, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${userName} → ${res.status} ${await res.text()}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const me = (await res.json()) as { id: string };
  return { userName, id: me.id, cookie };
}

// ---------- картинки: рисуем сами (SVG → JPEG), чужих фото нет ----------

type Scene = { sky: [string, string]; sun: string; hills: [string, string]; extra?: string };

const SCENES: Scene[] = [
  { sky: ['#ffb36b', '#e1306c'], sun: '#fff4c2', hills: ['#9b3a8c', '#5b1f6b'] }, // закат
  { sky: ['#7ad7f0', '#2f80ed'], sun: '#ffffff', hills: ['#1b5e9e', '#0d3b66'] }, // море
  { sky: ['#c6f6b6', '#38b48b'], sun: '#fffbe0', hills: ['#2a8f64', '#145c3e'] }, // лес
  { sky: ['#1d2b64', '#f8cdda'], sun: '#fdf6e3', hills: ['#3b3561', '#1f1a3d'] }, // вечер
  { sky: ['#fbd786', '#f7797d'], sun: '#fffaf0', hills: ['#c06c84', '#6c5b7b'] }, // персик
  { sky: ['#a1c4fd', '#c2e9fb'], sun: '#ffffff', hills: ['#8fb3d9', '#5a7fa8'] }, // горы
  { sky: ['#0f2027', '#2c5364'], sun: '#e0f7fa', hills: ['#203a43', '#0b1a20'], extra: 'stars' }, // ночь
  { sky: ['#f6d365', '#fda085'], sun: '#fff8e1', hills: ['#e17055', '#b33939'] }, // пустыня
];

function sceneSvg(scene: Scene, seed: number, w = 1080, h = 1440): string {
  const r = (n: number) => ((Math.sin(seed * 999 + n * 77) + 1) / 2) * 0.999; // детерминированный «случай»
  const sunX = 200 + r(1) * 680;
  const sunY = 300 + r(2) * 300;
  const stars =
    scene.extra === 'stars'
      ? Array.from({ length: 60 }, (_, i) => {
          const x = r(i + 10) * w;
          const y = r(i + 90) * h * 0.55;
          return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + r(i + 200) * 2.5).toFixed(1)}" fill="#fff" opacity="${(0.4 + r(i) * 0.6).toFixed(2)}"/>`;
        }).join('')
      : '';
  const y1 = 900 + r(3) * 120;
  const y2 = 1080 + r(4) * 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[0]}"/><stop offset="1" stop-color="${scene.sky[1]}"/></linearGradient>
  <radialGradient id="g"><stop offset="0" stop-color="${scene.sun}" stop-opacity=".9"/><stop offset="1" stop-color="${scene.sun}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#s)"/>${stars}
  <circle cx="${sunX}" cy="${sunY}" r="260" fill="url(#g)"/><circle cx="${sunX}" cy="${sunY}" r="110" fill="${scene.sun}"/>
  <path d="M0 ${y1} Q ${w * 0.25} ${y1 - 220} ${w * 0.5} ${y1 - 40} T ${w} ${y1 - 120} V ${h} H 0 Z" fill="${scene.hills[0]}" opacity=".85"/>
  <path d="M0 ${y2} Q ${w * 0.35} ${y2 - 200} ${w * 0.65} ${y2 - 20} T ${w} ${y2 - 80} V ${h} H 0 Z" fill="${scene.hills[1]}"/>
</svg>`;
}

function avatarSvg(colors: [string, string], letter: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#a)"/>
  <circle cx="200" cy="160" r="72" fill="#fff" opacity=".92"/>
  <path d="M70 400 Q 200 230 330 400 Z" fill="#fff" opacity=".92"/>
  <text x="340" y="80" font-family="Arial" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text>
</svg>`;
}

// Фото со свободной лицензией: публикации — Lorem Picsum (снимки Unsplash, Unsplash License),
// аватары — randomuser.me (портреты, сделанные для заглушек). Нет сети — рисуем картинку сами.
async function photoOr(url: string, w: number, h: number, fallbackSvg: string): Promise<Buffer> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(String(res.status));
    const raw = Buffer.from(await res.arrayBuffer());
    return await sharp(raw).resize(w, h, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
  } catch (error) {
    console.warn(`  фото недоступно (${url}): ${String(error)} — рисую картинку`);
    return sharp(Buffer.from(fallbackSvg)).jpeg({ quality: 88 }).toBuffer();
  }
}

async function upload(
  s: Session,
  jpeg: Buffer,
  purpose: 'POST' | 'AVATAR' | 'MESSAGE',
  name: string,
) {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), name);
  return call<{ id: string }>(s, 'POST', '/media', form);
}

// Номера снимков Lorem Picsum (пейзажи, море, лес, город).
const PHOTO_IDS = [10, 15, 28, 29, 37, 42, 49, 57, 76, 84, 96, 110, 122, 128, 142, 155, 164, 177];

async function createPost(s: Session, sceneIndex: number, seed: number, caption: string) {
  const photoId = PHOTO_IDS[seed % PHOTO_IDS.length]!;
  const jpeg = await photoOr(
    `https://picsum.photos/id/${photoId}/1080/1440`,
    1080,
    1440,
    sceneSvg(SCENES[sceneIndex % SCENES.length]!, seed),
  );
  const media = await upload(s, jpeg, 'POST', `p${seed}.jpg`);
  return call<{ id: string }>(s, 'POST', '/posts', {
    type: 'POST',
    items: [{ mediaId: media.id, altText: caption.slice(0, 100) }],
    caption,
  });
}

async function send(s: Session, chatId: string, text: string) {
  return call<{ id: string }>(s, 'POST', `/chats/${chatId}/messages`, {
    type: 'TEXT',
    text,
    clientId: crypto.randomUUID(), // ключ от повторной отправки (как у веб-клиента)
  });
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- сценарий ----------

async function main(): Promise<void> {
  const alice = await login('alice');
  const bob = await login('bob');
  const carol = await login('carol');

  // --reset: удалить публикации и подборки демо-пользователей и создать их заново (чаты не трогаем).
  if (process.argv.includes('--reset')) await resetContent([alice, bob, carol]);

  const bobProfile = await call<{ postCount: number }>(alice, 'GET', '/users/by-username/bob');
  if (bobProfile.postCount === 0) await seedContent(alice, bob, carol);
  else console.log('Публикации уже есть — пропускаю профили, подписки и публикации.');

  const chats = await call<{ items: unknown[] }>(alice, 'GET', '/chats?folder=PRIMARY&limit=1');
  if (chats.items.length === 0) await seedChats(alice, bob, carol);
  else console.log('Чаты уже есть — пропускаю.');

  console.log('Готово.');
}

async function resetContent(sessions: Session[]): Promise<void> {
  console.log('Сброс публикаций и подборок…');
  for (const s of sessions) {
    const posts = await call<{ items: { id: string }[] }>(
      s,
      'GET',
      `/users/${s.id}/posts?limit=50`,
    );
    for (const post of posts.items) await call(s, 'DELETE', `/posts/${post.id}`);
    const collections = await call<{ id: string }[] | { items: { id: string }[] }>(
      s,
      'GET',
      '/me/collections',
    );
    const list = Array.isArray(collections) ? collections : collections.items;
    for (const c of list) await call(s, 'DELETE', `/me/collections/${c.id}`);
  }
}

async function seedContent(alice: Session, bob: Session, carol: Session): Promise<void> {
  console.log('Профили…');
  const portraits: Record<string, string> = { alice: 'women/44', bob: 'men/32', carol: 'women/68' };
  const profiles: [Session, [string, string], string, string][] = [
    [alice, ['#feda75', '#d62976'], 'A', 'Фотографирую закаты и горы 🌄\nМосква → везде'],
    [bob, ['#4f5bd5', '#38b6ff'], 'B', 'Море, сёрф и кофе ☕️'],
    [carol, ['#1cd14f', '#0f9b8e'], 'C', 'Походы, леса и палатки 🌲'],
  ];
  for (const [s, colors, letter, bio] of profiles) {
    const jpeg = await photoOr(
      `https://randomuser.me/api/portraits/${portraits[s.userName]}.jpg`,
      400,
      400,
      avatarSvg(colors, letter),
    );
    const avatar = await upload(s, jpeg, 'AVATAR', `${s.userName}.jpg`);
    await call(s, 'PUT', '/me/avatar', { mediaId: avatar.id });
    await call(s, 'PATCH', '/me', { bio });
  }

  console.log('Подписки…');
  const pairs: [Session, Session][] = [
    [alice, bob],
    [bob, alice],
    [alice, carol],
    [carol, alice],
    [bob, carol],
    [carol, bob],
  ];
  for (const [from, to] of pairs) {
    await call(from, 'PUT', `/users/${to.id}/follow`).catch(() => undefined); // уже подписан — не ошибка
  }

  console.log('Публикации…');
  const alicePosts: string[] = [];
  const aliceCaptions = [
    'Закат на набережной 🧡',
    'Утро в горах. Воздух — как лёд ❄️',
    'Ночное небо за городом ✨',
    'Персиковый вечер 🍑',
    'Снова к морю 🌊',
    'Пустыня, которая звучит тишиной',
  ];
  for (let i = 0; i < aliceCaptions.length; i++) {
    alicePosts.push(
      (await createPost(alice, [0, 5, 6, 4, 1, 7][i]!, 100 + i, aliceCaptions[i]!)).id,
    );
  }
  const bobPosts: string[] = [];
  const bobCaptions = [
    'Волна дня 🏄',
    'Кофе с видом на залив',
    'Шторм прошёл',
    'Синий час',
    'Маяк',
  ];
  for (let i = 0; i < bobCaptions.length; i++) {
    bobPosts.push((await createPost(bob, [1, 3, 5, 1, 6][i]!, 200 + i, bobCaptions[i]!)).id);
  }
  const carolPosts: string[] = [];
  const carolCaptions = [
    'Лагерь у озера',
    'Тропа сквозь туман',
    'Рассвет в палатке',
    'Зелень после дождя',
    'Вершина!',
  ];
  for (let i = 0; i < carolCaptions.length; i++) {
    carolPosts.push((await createPost(carol, [2, 5, 0, 2, 4][i]!, 300 + i, carolCaptions[i]!)).id);
  }

  console.log('Лайки и комментарии…');
  for (const id of alicePosts) {
    await call(bob, 'PUT', `/posts/${id}/like`);
    await call(carol, 'PUT', `/posts/${id}/like`);
  }
  for (const id of [...bobPosts.slice(0, 3), ...carolPosts.slice(0, 3)])
    await call(alice, 'PUT', `/posts/${id}/like`);
  await call(bob, 'POST', `/posts/${alicePosts[0]}/comments`, { text: 'Вау, какие цвета 😍' });
  await call(carol, 'POST', `/posts/${alicePosts[0]}/comments`, { text: 'Где это? Хочу туда!' });
  await call(carol, 'POST', `/posts/${alicePosts[1]}/comments`, { text: 'Горы — моя любовь ⛰️' });
  await call(bob, 'POST', `/posts/${alicePosts[2]}/comments`, {
    text: 'Это реально твоё фото? Огонь 🔥',
  });

  console.log('Сохранённое…');
  for (const id of [bobPosts[0], bobPosts[3], carolPosts[0], carolPosts[1], carolPosts[4]]) {
    await call(alice, 'PUT', `/posts/${id}/save`);
  }
  await call(alice, 'POST', '/me/collections', {
    name: 'Путешествия',
    postIds: [carolPosts[0], carolPosts[4]],
  });
  await call(alice, 'POST', '/me/collections', {
    name: 'Море',
    postIds: [bobPosts[0], bobPosts[3]],
  });
}

async function seedChats(alice: Session, bob: Session, carol: Session): Promise<void> {
  console.log('Чаты…');
  const withBob = await call<{ id: string }>(alice, 'POST', '/chats', { userIds: [bob.id] });
  const bobLines: [Session, string][] = [
    [alice, 'Привет! Ты уже вернулся с моря?'],
    [bob, 'Привет 👋 Да, вчера прилетел'],
    [bob, 'Волны были просто огромные'],
    [alice, 'Видела твой пост, очень красиво 🌊'],
    [alice, 'Скинешь ещё фото?'],
    [bob, 'Конечно, вечером соберу альбом'],
    [alice, 'Супер, жду!'],
  ];
  let lastBobChat = '';
  for (const [s, text] of bobLines) {
    lastBobChat = (await send(s, withBob.id, text)).id;
    await pause(150);
  }
  await call(bob, 'POST', `/chats/${withBob.id}/read`, { messageId: lastBobChat }); // «Просмотрено»
  await call(alice, 'POST', `/chats/${withBob.id}/read`, { messageId: lastBobChat });

  const withCarol = await call<{ id: string }>(alice, 'POST', '/chats', { userIds: [carol.id] });
  const carolLines: [Session, string][] = [
    [carol, 'Алиса, идём в поход в субботу?'],
    [alice, 'Давай! Куда?'],
    [carol, 'К озеру, там отличное место для лагеря 🏕️'],
    [carol, 'Я возьму палатку'],
  ];
  for (const [s, text] of carolLines) {
    await send(s, withCarol.id, text);
    await pause(150);
  }
  // последние сообщения carol alice не читала — в списке будет точка непрочитанного

  const group = await call<{ id: string }>(alice, 'POST', '/chats', {
    userIds: [bob.id, carol.id],
    title: 'Выходные 🌲',
  });
  const groupLines: [Session, string][] = [
    [alice, 'Кто с нами на выходных?'],
    [bob, 'Я в деле'],
    [carol, 'И я! Беру котелок'],
    [bob, 'Тогда я — гитару 🎸'],
    [alice, 'Отлично, встречаемся в 9 у вокзала'],
  ];
  let lastGroup = '';
  for (const [s, text] of groupLines) {
    lastGroup = (await send(s, group.id, text)).id;
    await pause(150);
  }
  await call(alice, 'POST', `/chats/${group.id}/read`, { messageId: lastGroup });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
