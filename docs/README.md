# Карта документации

Документация разделена на **уровни**: от «что происходит сейчас» к «почему так решили».
Каждый документ отвечает на один вопрос; если ответ есть в другом документе — ставится ссылка, а не копия.

## Уровни

| Уровень | Вопрос | Документы | Как часто меняется |
|---|---|---|---|
| 0. Вход | Как работать с репозиторием? | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), [README.md](../README.md) | редко |
| 1. Состояние | Что сделано, что в работе, что дальше? Как к этому пришли? | [STATUS.md](STATUS.md), [stories/](stories/README.md) | **в каждом PR** (истории — только добавляются) |
| 2. Продукт | Что умеет продукт и как ведёт себя каждая функция? Что не решено? | [product/FEATURE_CATALOG.md](product/FEATURE_CATALOG.md), [REQUIREMENTS.md](REQUIREMENTS.md) | при ответах на `Q` и изменении объёма |
| 3. Дизайн | Как выглядит каждый экран? | [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md), [design/SCREENS.md](design/SCREENS.md) | после дизайн-сверки |
| 4. План | В каком порядке и кто делает? | [ROADMAP.md](ROADMAP.md) (фазы), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (задачи `T`) | при перепланировании |
| 5. Архитектура | Как устроена система? | [architecture/](architecture/ARCHITECTURE.md) | редко, через ADR |
| 6. Контракты | Какие API, события и данные? | [api/API_CONTRACT.md](api/API_CONTRACT.md) + [api/endpoints/](api/API_CONTRACT.md#2-эндпоинты-по-модулям), [api/REALTIME.md](api/REALTIME.md), [database/DATA_MODEL.md](database/DATA_MODEL.md) | вместе с кодом |
| 7. Функции | Как ведёт себя функция в обоих приложениях? | [features/](features/README.md) | вместе с кодом функции |
| 8. Процесс | Как работать, писать код, проверять? | [development/](#процесс-разработки), [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md), [CONTRIBUTING.md](../CONTRIBUTING.md) | редко |
| 9. Решения | Почему так? | [decisions/](decisions/README.md) (ADR) | только добавляются |
| — | Справка | [GLOSSARY.md](GLOSSARY.md), [api/API_INVENTORY.md](api/API_INVENTORY.md) (исходный Swagger) | почти никогда |

## Все документы

### Корень
| Документ | Назначение |
|---|---|
| [AGENTS.md](../AGENTS.md) | точка входа для ИИ-агентов: порядок чтения, источники истины, жёсткие правила, команды |
| [CLAUDE.md](../CLAUDE.md) | подключает AGENTS.md + особенности Claude Code, роль оркестратора |
| [README.md](../README.md) | обзор проекта для людей |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Git-процесс, PR, владельцы модулей, общие файлы |

### docs/
| Документ | Назначение |
|---|---|
| [STATUS.md](STATUS.md) | текущее состояние: фаза, доска задач, блокеры, оглавление историй |
| [stories/](stories/README.md) | истории — журнал действий: `ГГГГ-ММ-ДД_ЧЧММ_<slug>.md`; правила и шаблон |
| [product/FEATURE_CATALOG.md](product/FEATURE_CATALOG.md) | **каталог функций** «как в Instagram»: ID, поведение, приоритет, вне объёма |
| [REQUIREMENTS.md](REQUIREMENTS.md) | границы объёма, NFR, внешние зависимости, правила механик, **открытые вопросы Q1–Q34** |
| [ROADMAP.md](ROADMAP.md) | фазы, зависимости, критерии приёмки фаз |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | backend-first план: обязательное и опциональное, два потока, контрольные точки, карточки модулей, задачи с владельцами |
| [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) | чек-лист для PR |
| [GLOSSARY.md](GLOSSARY.md) | термины и система идентификаторов |

### Дизайн
| Документ | Назначение |
|---|---|
| [DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) | бренд, цвета (светлая/тёмная, измерены на instagram.com), типографика, размеры, движение, реализация токенов |
| [SCREENS.md](design/SCREENS.md) | маршруты как в Instagram, оболочка, экраны и состояния, процесс дизайн-сверки |

### Архитектура
| Документ | Назначение |
|---|---|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | общая схема, потоки, модули backend и зависимости, инфраструктура |
| [MONOREPO_STRUCTURE.md](architecture/MONOREPO_STRUCTURE.md) | дерево репозитория, npm workspaces, скрипты |
| [API_REQUEST_ARCHITECTURE.md](architecture/API_REQUEST_ARCHITECTURE.md) | прокси, RTK Query (baseApi, теги, курсоры, оптимистичные обновления), события → кэш, загрузка файлов |
| [AUTHENTICATION.md](architecture/AUTHENTICATION.md) | сессии, cookie, регистрация с кодом, соцвход, сессии устройств |
| [SECURITY.md](architecture/SECURITY.md) | авторизация и приватность, CSRF, OAuth, сокеты, rate limit, загрузки |
| [RENDERING_STRATEGY.md](architecture/RENDERING_STRATEGY.md) | Server/Client Components, структура App Router, окна поверх страниц |

### API и данные
| Документ | Назначение |
|---|---|
| [API_CONTRACT.md](api/API_CONTRACT.md) | **наш Swagger-проект**: соглашения, модели, индекс модулей, таблица соответствия исходному Swagger |
| [api/endpoints/](api/API_CONTRACT.md#2-эндпоинты-по-модулям) | эндпоинты по модулям (17 файлов) |
| [REALTIME.md](api/REALTIME.md) | события Socket.IO |
| [API_INVENTORY.md](api/API_INVENTORY.md) | опись исходного Swagger и проблемы P1–P25 (справка) |
| `api/original-swagger.json` | исходный Swagger без изменений (не редактировать) |
| `api/openapi.json` | появится в Phase 0: генерируется из NestJS (не редактировать) |
| [DATA_MODEL.md](database/DATA_MODEL.md) | сущности по модулям, связи, правила удаления |
| [DATABASE_DECISIONS.md](database/DATABASE_DECISIONS.md) | UUID и shortcode, участники чатов, ограничения, миграции вдвоём |

### Процесс разработки
| Документ | Назначение |
|---|---|
| [AGENT_PLAYBOOKS.md](development/AGENT_PLAYBOOKS.md) | пошаговые сценарии работы, Definition of Ready / Done, передача дел |
| [AI_AGENTS.md](development/AI_AGENTS.md) | субагенты Claude Code: роли, модели (Opus/Sonnet/Haiku), конвейер задачи |
| [CODING_CONVENTIONS.md](development/CODING_CONVENTIONS.md) | как писать код: шаблоны модулей, RTK Query, дизайн-токены, тесты |
| [CHANGE_PROCESS.md](development/CHANGE_PROCESS.md) | изменение API-контракта и `schema.prisma` |
| [TESTING.md](development/TESTING.md) | стратегия тестирования |
| [LOCAL_SETUP.md](development/LOCAL_SETUP.md) | запуск на своей машине |

## Что читать под задачу

| Задача | Обязательно | По необходимости |
|---|---|---|
| Реализовать задачу `Tx.y` | STATUS → IMPLEMENTATION_PLAN (строка задачи) → функции в FEATURE_CATALOG → спецификация → `api/endpoints/<module>.md` → DATA_MODEL → CODING_CONVENTIONS | SECURITY, RENDERING_STRATEGY, REALTIME |
| Frontend-экран | SCREENS (экран), DESIGN_SYSTEM (размеры и токены), RENDERING_STRATEGY, API_REQUEST_ARCHITECTURE, спецификация | CODING_CONVENTIONS §3 |
| Изменить endpoint | `api/endpoints/<module>.md`, API_CONTRACT §1, CHANGE_PROCESS, спецификация | API_REQUEST_ARCHITECTURE §6.3 (теги) |
| Событие реального времени | REALTIME, API_REQUEST_ARCHITECTURE §6.6, ADR 0013 | SECURITY «Реальное время» |
| Изменить схему БД | DATA_MODEL, DATABASE_DECISIONS, CHANGE_PROCESS | — |
| Исправить ошибку | STATUS (известные проблемы), последняя история, спецификация, CODING_CONVENTIONS | TESTING |
| Безопасность, приватность, сессии | SECURITY, AUTHENTICATION, privacy-and-safety | ADR 0003, 0004, 0014 |
| Ответ на вопрос `Q` | REQUIREMENTS §5, все документы со ссылкой на `Qn` | AGENT_PLAYBOOKS «Закрыть открытый вопрос» |
| Новая технология / инфраструктура | ARCHITECTURE §6, decisions/README | — |
| Ревью PR | QUALITY_CHECKLIST, спецификация, SCREENS (для UI) | CONTRIBUTING |

## Соглашения в документах

| Обозначение | Смысл |
|---|---|
| ✅ | принято / согласовано; в каталоге и дизайне — **измерено на instagram.com** |
| 📝 | черновик или неподтверждённое значение; можно уточнить без отдельного согласования, если смысл не меняется |
| ❓ `Qn` | открытый вопрос из [REQUIREMENTS.md §5](REQUIREMENTS.md#5-открытые-вопросы) |
| ⚠️ | ещё не работает / требует внимания |
| `F-…-NN` | функция из [FEATURE_CATALOG.md](product/FEATURE_CATALOG.md) |
| P0 / P1 / P2 | приоритет функции (порядок, не исключение) |
| `#n` | операция исходного Swagger ([API_INVENTORY.md](api/API_INVENTORY.md)) |
| `Pn` | проблема исходного Swagger |
| `Tx.y` | задача из [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| `NFR-…` | нефункциональное требование |

Правила ведения:

1. Каждый документ начинается со строки статуса (`> Статус: …`).
2. Одна тема — один документ-источник; в остальных — ссылка.
3. Изменение поведения или решения → обновить все документы, которые на него ссылаются (поиск по ID: `Q10`, `F-DM-05`, `T2.3`, `ADR 0004`).
4. Ссылки только относительные; после правок — проверка ссылок (скрипт появится в T0.6).
5. Исторические документы (ADR, истории в `stories/`) не переписываются — только дополняются.
