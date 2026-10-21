# Карта документации

Документация разделена на **уровни**: от «что происходит сейчас» к «почему так решили».
Каждый документ отвечает на один вопрос; если ответ есть в другом документе — ставится ссылка, а не копия.

## Уровни

| Уровень | Вопрос | Документы | Как часто меняется |
|---|---|---|---|
| 0. Вход | Как работать с репозиторием? | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), [README.md](../README.md) | редко |
| 1. Состояние | Что сделано, что в работе, что дальше? Как к этому пришли? | [STATUS.md](STATUS.md), [stories/](stories/README.md) | **в каждом PR** (истории — только добавляются) |
| 2. Продукт | Что строим, что исключено, что не решено? | [REQUIREMENTS.md](REQUIREMENTS.md) | при ответах на вопросы `Q` |
| 3. План | В каком порядке и кто делает? | [ROADMAP.md](ROADMAP.md) (фазы), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (задачи `T`) | при перепланировании |
| 4. Архитектура | Как устроена система? | [architecture/](architecture/ARCHITECTURE.md) | редко, через ADR |
| 5. Контракты | Какие API и данные? | [api/API_CONTRACT.md](api/API_CONTRACT.md), [database/DATA_MODEL.md](database/DATA_MODEL.md) | вместе с кодом |
| 6. Функции | Как ведёт себя каждая функция? | [features/](features/README.md) | вместе с кодом функции |
| 7. Процесс | Как работать, писать код, проверять? | [development/](#процесс-разработки), [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md), [CONTRIBUTING.md](../CONTRIBUTING.md) | редко |
| 8. Решения | Почему так? | [decisions/](decisions/README.md) (ADR) | только добавляются |
| — | Справка | [GLOSSARY.md](GLOSSARY.md), [api/API_INVENTORY.md](api/API_INVENTORY.md) (исходный Swagger) | почти никогда |

## Все документы

### Корень
| Документ | Назначение |
|---|---|
| [AGENTS.md](../AGENTS.md) | точка входа для ИИ-агентов: порядок чтения, источники истины, жёсткие правила, команды |
| [CLAUDE.md](../CLAUDE.md) | подключает AGENTS.md + особенности Claude Code |
| [README.md](../README.md) | обзор проекта для людей |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Git-процесс, PR, владельцы модулей, общие файлы |

### docs/
| Документ | Назначение |
|---|---|
| [STATUS.md](STATUS.md) | текущее состояние: фаза, доска задач, блокеры, оглавление историй |
| [stories/](stories/README.md) | истории — журнал действий: файл `ГГГГ-ММ-ДД_ЧЧММ_<slug>.md` на каждое значимое действие; правила и шаблон |
| [REQUIREMENTS.md](REQUIREMENTS.md) | требования FR/NFR, механики, **открытые вопросы Q1–Q29**, исключённое |
| [ROADMAP.md](ROADMAP.md) | фазы, зависимости, критерии приёмки фаз |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | задачи T0.1…, владельцы, зависимости, «готово, когда» |
| [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) | чек-лист для PR |
| [GLOSSARY.md](GLOSSARY.md) | термины и система идентификаторов |

### Архитектура
| Документ | Назначение |
|---|---|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | общая схема, модули backend и их зависимости, будущая инфраструктура |
| [MONOREPO_STRUCTURE.md](architecture/MONOREPO_STRUCTURE.md) | дерево репозитория, npm workspaces, скрипты |
| [API_REQUEST_ARCHITECTURE.md](architecture/API_REQUEST_ARCHITECTURE.md) | прокси, API-клиент, TanStack Query, инвалидация, ошибки |
| [AUTHENTICATION.md](architecture/AUTHENTICATION.md) | сессии, cookie, сроки, сценарии входа/выхода/паролей |
| [SECURITY.md](architecture/SECURITY.md) | авторизация, CSRF, CORS, валидация, rate limit, загрузки |
| [RENDERING_STRATEGY.md](architecture/RENDERING_STRATEGY.md) | Server/Client Components, маршруты, кэширование |

### API и данные
| Документ | Назначение |
|---|---|
| [API_CONTRACT.md](api/API_CONTRACT.md) | **наш** контракт `/api/v1` + таблица соответствия исходному Swagger |
| [API_INVENTORY.md](api/API_INVENTORY.md) | опись исходного Swagger и его проблемы P1–P25 (только справка) |
| `api/original-swagger.json` | исходный Swagger без изменений (не редактировать) |
| `api/openapi.json` | появится в Phase 0: генерируется из NestJS (не редактировать) |
| [DATA_MODEL.md](database/DATA_MODEL.md) | сущности, связи, правила удаления |
| [DATABASE_DECISIONS.md](database/DATABASE_DECISIONS.md) | UUID, ограничения, миграции вдвоём |

### Процесс разработки
| Документ | Назначение |
|---|---|
| [AGENT_PLAYBOOKS.md](development/AGENT_PLAYBOOKS.md) | пошаговые сценарии работы, Definition of Ready / Done, передача дел |
| [AI_AGENTS.md](development/AI_AGENTS.md) | субагенты Claude Code: роли, модели (Opus/Sonnet/Haiku), конвейер задачи |
| [CODING_CONVENTIONS.md](development/CODING_CONVENTIONS.md) | как писать код: шаблоны модулей, имена, ошибки, тесты |
| [CHANGE_PROCESS.md](development/CHANGE_PROCESS.md) | изменение API-контракта и `schema.prisma` |
| [TESTING.md](development/TESTING.md) | стратегия тестирования |
| [LOCAL_SETUP.md](development/LOCAL_SETUP.md) | запуск на своей машине |

## Что читать под задачу

| Задача | Обязательно | По необходимости |
|---|---|---|
| Реализовать задачу `Tx.y` | STATUS → IMPLEMENTATION_PLAN (строка задачи) → спецификация функции → раздел API_CONTRACT → DATA_MODEL → CODING_CONVENTIONS | SECURITY, RENDERING_STRATEGY |
| Изменить endpoint | API_CONTRACT, CHANGE_PROCESS, спецификация функции | API_REQUEST_ARCHITECTURE (инвалидация) |
| Изменить схему БД | DATA_MODEL, DATABASE_DECISIONS, CHANGE_PROCESS | — |
| Исправить ошибку | STATUS (известные проблемы), спецификация функции, CODING_CONVENTIONS | TESTING |
| Frontend-страница | RENDERING_STRATEGY, API_REQUEST_ARCHITECTURE, спецификация функции | CODING_CONVENTIONS (frontend) |
| Безопасность, сессии | AUTHENTICATION, SECURITY | ADR 0003, 0004 |
| Ответ на вопрос `Q` | REQUIREMENTS §5, все документы со ссылкой на этот `Q` (поиск по `Qn`) | AGENT_PLAYBOOKS «Закрыть открытый вопрос» |
| Новая технология / инфраструктура | ARCHITECTURE §6, decisions/README | — |
| Ревью PR | QUALITY_CHECKLIST, спецификация функции | CONTRIBUTING |

## Соглашения в документах

| Обозначение | Смысл |
|---|---|
| ✅ | принято / согласовано |
| 📝 | черновик или предложенное значение; можно уточнить без отдельного согласования, если смысл не меняется |
| ❓ `Qn` | открытый вопрос из [REQUIREMENTS.md §5](REQUIREMENTS.md#5-открытые-вопросы) |
| ⚠️ | ещё не работает / требует внимания |
| `#n` | номер операции исходного Swagger ([API_INVENTORY.md](api/API_INVENTORY.md)) |
| `Pn` | проблема исходного Swagger |
| `Tx.y` | задача из [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| `FR-…`, `NFR-…` | требования из [REQUIREMENTS.md](REQUIREMENTS.md) |

Правила ведения:

1. Каждый документ начинается со строки статуса (`> Статус: …`).
2. Одна тема — один документ-источник; в остальных — ссылка.
3. Изменение поведения или решения → обновить все документы, которые на него ссылаются (поиск по ID: `Q10`, `T2.3`, `ADR 0004`).
4. Ссылки только относительные; после правок — проверка ссылок (скрипт появится в T0.6).
5. Исторические документы (ADR, истории в `stories/`) не переписываются — только дополняются.
