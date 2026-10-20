# API Inventory — исходный Swagger

Этот документ — **точная опись** исходного контракта. Здесь только то, что написано в Swagger,
без догадок. Новый контракт нашего backend описан в [API_CONTRACT.md](API_CONTRACT.md).

## Источник

| Поле | Значение |
|---|---|
| URL | `https://instagram-api.softclub.tj/swagger/v1/swagger.json` |
| Копия в репозитории | [original-swagger.json](original-swagger.json) — сохранена без изменений |
| Дата получения | 2026-10-20 |
| SHA-256 копии | `b559735cba0773a8942bf9cb65adc7de753df4e7f8ff278ed9d01415059fe4ae` |
| Версия OpenAPI | 3.0.1, `info.title` = "Web Api", `info.version` = "v1.0" |
| Происхождение | Судя по именам схем (`Domain.Dtos…`, ``Response`1``), backend на ASP.NET |
| Сверка | Копия, присланная в чат, совпадает с файлом по URL: 57 операций, 15 схем |

`original-swagger.json` **не редактируется**. Таблицы ниже сгенерированы из него скриптом,
чтобы точно сохранить пути, методы, имена и регистр параметров.

## Общие факты (подтверждено документом)

- **57 операций** в 8 тегах: Account 5, Chat 6, FollowingRelationShip 4, Location 5, Post 12, Story 8, User 10, UserProfile 7.
- **Безопасность:** глобально задана схема `Bearer` (`apiKey` в заголовке `Authorization`, описание — «JWT Authorization header»). Исключений для отдельных операций нет — формально даже `register` и `login` требуют токен.
- **JSON-тела** принимаются как `application/json`, `text/json`, `application/*+json` (особенность ASP.NET).
- **Ответы:** у всех операций описан только `200`. Схема ответа есть лишь у 8 операций (#3, #4, #5, #36–#40).
- **Ошибки (4xx/5xx) не описаны** ни у одной операции.
- **Идентификаторы:** пользователи — `string` (формат не указан), остальные сущности — `integer(int32)`.

## Операции

Номер `#` используется как ссылка в [API_CONTRACT.md](API_CONTRACT.md) (таблица соответствия).
«required» стоит только там, где Swagger явно помечает параметр обязательным.

### Account (5)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 1 | POST | `/Account/register` | — | application/json, text/json, application/*+json: `RegisterDto.RegisterDto` | не описан |
| 2 | POST | `/Account/login` | — | application/json, text/json, application/*+json: `LoginDto.LoginDto` | не описан |
| 3 | DELETE | `/Account/ForgotPassword` | `Email` (query, string, required) | — | `` Response`1[System.String] `` |
| 4 | DELETE | `/Account/ResetPassword` | `Token` (query, string, required)<br>`Email` (query, string, required)<br>`Password` (query, string(password), required)<br>`ConfirmPassword` (query, string(password), required) | — | `` Response`1[System.String] `` |
| 5 | PUT | `/Account/ChangePassword` | `OldPassword` (query, string, required)<br>`Password` (query, string(password), required)<br>`ConfirmPassword` (query, string(password), required) | — | `` Response`1[System.String] `` |

### Chat (6)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 6 | GET | `/Chat/get-chats` | — | — | не описан |
| 7 | GET | `/Chat/get-chat-by-id` | `chatId` (query, integer(int32)) | — | не описан |
| 8 | POST | `/Chat/create-chat` | `receiverUserId` (query, string) | — | не описан |
| 9 | PUT | `/Chat/send-message` | — | multipart/form-data: `ChatId` (integer(int32), required), `MessageText` (string), `File` (string(binary)) | не описан |
| 10 | DELETE | `/Chat/delete-message` | `massageId` (query, integer(int32)) | — | не описан |
| 11 | DELETE | `/Chat/delete-chat` | `chatId` (query, integer(int32)) | — | не описан |

### FollowingRelationShip (4)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 12 | GET | `/FollowingRelationShip/get-subscribers` | `UserId` (query, string, required) | — | не описан |
| 13 | GET | `/FollowingRelationShip/get-subscriptions` | `UserId` (query, string, required) | — | не описан |
| 14 | POST | `/FollowingRelationShip/add-following-relation-ship` | `followingUserId` (query, string) | — | не описан |
| 15 | DELETE | `/FollowingRelationShip/delete-following-relation-ship` | `followingUserId` (query, string) | — | не описан |

### Location (5)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 16 | GET | `/Location/get-Locations` | `City` (query, string)<br>`State` (query, string)<br>`ZipCode` (query, string)<br>`Country` (query, string)<br>`PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 17 | GET | `/Location/get-Location-by-id` | `id` (query, integer(int32)) | — | не описан |
| 18 | POST | `/Location/add-Location` | — | application/json, text/json, application/*+json: `LocationDto.AddLocationDto` | не описан |
| 19 | PUT | `/Location/update-Location` | — | application/json, text/json, application/*+json: `LocationDto.UpdateLocationDto` | не описан |
| 20 | DELETE | `/Location/delete-Location` | `id` (query, integer(int32)) | — | не описан |

### Post (12)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 21 | GET | `/Post/get-posts` | `UserId` (query, string)<br>`Title` (query, string)<br>`Content` (query, string)<br>`PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 22 | GET | `/Post/get-reels` | `PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 23 | GET | `/Post/get-post-by-id` | `id` (query, integer(int32)) | — | не описан |
| 24 | GET | `/Post/get-my-posts` | — | — | не описан |
| 25 | GET | `/Post/get-following-post` | `UserId` (query, string)<br>`PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 26 | POST | `/Post/add-post` | — | multipart/form-data: `Title` (string), `Content` (string), `Images` (string(binary)[], required) | не описан |
| 27 | DELETE | `/Post/delete-post` | `id` (query, integer(int32)) | — | не описан |
| 28 | POST | `/Post/like-post` | `postId` (query, integer(int32)) | — | не описан |
| 29 | POST | `/Post/view-post` | `postId` (query, integer(int32)) | — | не описан |
| 30 | POST | `/Post/add-comment` | — | application/json, text/json, application/*+json: `PostCommentDto.AddPostCommentDto` | не описан |
| 31 | DELETE | `/Post/delete-comment` | `commentId` (query, integer(int32)) | — | не описан |
| 32 | POST | `/Post/add-post-favorite` | — | application/json, text/json, application/*+json: `PostFavoriteDto.AddPostFavoriteDto` | не описан |

### Story (8)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 33 | GET | `/Story/get-stories` | — | — | не описан |
| 34 | GET | `/Story/get-user-stories/{userId}` | `userId` (path, string, required) | — | не описан |
| 35 | GET | `/Story/get-my-stories` | — | — | не описан |
| 36 | POST | `/Story/LikeStory` | `storyId` (query, integer(int32)) | — | `` Response`1[System.String] `` |
| 37 | GET | `/Story/GetStoryById` | `id` (query, integer(int32)) | — | `` Response`1[Domain.Dtos.StoryDtos.GetStoryDto] `` |
| 38 | POST | `/Story/AddStories` | `PostId` (query, integer(int32)) | multipart/form-data: `Image` (string(binary)) | `` Response`1[System.String] `` |
| 39 | DELETE | `/Story/DeleteStory` | `id` (query, integer(int32)) | — | `` Response`1[System.Boolean] `` |
| 40 | POST | `/Story/add-story-view` | `StoryId` (query, integer(int32), required) | — | `` Response`1[Domain.Dtos.StoryViewDtos.GetStoryViewDto] `` |

### User (10)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 41 | GET | `/User/get-users` | `UserName` (query, string)<br>`Email` (query, string)<br>`PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 42 | POST | `/User/add-search-history` | `Text` (query, string, required) | — | не описан |
| 43 | GET | `/User/get-search-histories` | — | — | не описан |
| 44 | DELETE | `/User/delete-search-history` | `id` (query, integer(int32), required) | — | не описан |
| 45 | DELETE | `/User/delete-search-histories` | — | — | не описан |
| 46 | POST | `/User/add-user-search-history` | `UserSearchId` (query, string, required) | — | не описан |
| 47 | GET | `/User/get-user-search-histories` | — | — | не описан |
| 48 | DELETE | `/User/delete-user-search-history` | `id` (query, integer(int32), required) | — | не описан |
| 49 | DELETE | `/User/delete-user-search-histories` | — | — | не описан |
| 50 | DELETE | `/User/delete-user` | `userId` (query, string) | — | не описан |

### UserProfile (7)

| # | Метод | Путь | Параметры | Тело запроса | Ответ 200 |
|---|---|---|---|---|---|
| 51 | GET | `/UserProfile/get-user-profile-by-id` | `id` (query, string) | — | не описан |
| 52 | GET | `/UserProfile/get-is-follow-user-profile-by-id` | `followingUserId` (query, string) | — | не описан |
| 53 | GET | `/UserProfile/get-my-profile` | — | — | не описан |
| 54 | PUT | `/UserProfile/update-user-profile` | — | application/json, text/json, application/*+json: `UserProfileDto.UpdateUserProfileDto` | не описан |
| 55 | GET | `/UserProfile/get-post-favorites` | `PageNumber` (query, integer(int32))<br>`PageSize` (query, integer(int32)) | — | не описан |
| 56 | PUT | `/UserProfile/update-user-image-profile` | — | multipart/form-data: `imageFile` (string(binary)) | не описан |
| 57 | DELETE | `/UserProfile/delete-user-image-profile` | — | — | не описан |

## Схемы (components.schemas)

- `LocationDto.AddLocationDto` — `city`: string (required) minLength=1, `state`: string (required) minLength=1, `zipCode`: string (required) minLength=1, `country`: string (required) minLength=1
- `LocationDto.UpdateLocationDto` — `locationId`: integer(int32) (required), `city`: string (required) minLength=1, `state`: string (required) minLength=1, `zipCode`: string (required) minLength=1, `country`: string (required) minLength=1
- `LoginDto.LoginDto` — `userName`: string (required) minLength=1, `password`: string (required) minLength=1
- `PostCommentDto.AddPostCommentDto` — `comment`: string (required) minLength=1, `postId`: integer(int32) (required)
- `PostFavoriteDto.AddPostFavoriteDto` — `postId`: integer(int32) (required)
- `RegisterDto.RegisterDto` — `userName`: string (required) minLength=1, `fullName`: string (required) minLength=1, `email`: string (required) minLength=1, `password`: string(password) (required) minLength=1, `confirmPassword`: string(password) (required) minLength=1
- `StoryDtos.GetStoryDto` — `id`: integer(int32), `fileName`: string (nullable), `postId`: integer(int32) (nullable), `createAt`: string(date-time), `userId`: string (nullable), `userAvatar`: string (nullable), `viewerDto`: ViewerDtos.ViewerDto
- `StoryViewDtos.GetStoryViewDto` — `id`: integer(int32), `viewUserId`: string (nullable), `storyId`: integer(int32)
- `UserProfileDto.UpdateUserProfileDto` — `about`: string (nullable), `gender`: Gender
- `ViewerDtos.ViewerDto` — `userName`: string (nullable), `name`: string (nullable), `viewCount`: integer(int32) (nullable), `viewLike`: integer(int32) (nullable)
- `Gender`: enum integer [0, 1] — значения без подписей
- `` Response`1[Domain.Dtos.StoryDtos.GetStoryDto] `` — `data`: StoryDtos.GetStoryDto, `errors`: string[] (nullable), `statusCode`: integer(int32)
- `` Response`1[Domain.Dtos.StoryViewDtos.GetStoryViewDto] `` — `data`: StoryViewDtos.GetStoryViewDto, `errors`: string[] (nullable), `statusCode`: integer(int32)
- `` Response`1[System.Boolean] `` — `data`: boolean, `errors`: string[] (nullable), `statusCode`: integer(int32)
- `` Response`1[System.String] `` — `data`: string (nullable), `errors`: string[] (nullable), `statusCode`: integer(int32)

## Выявленные проблемы и пробелы

Это **наблюдения**, а не факты о поведении исходного backend: поведение, которое не описано,
мы не знаем. Номера P1…P25 используются в остальных документах.

### Неполнота документа
- **P1.** У 49 из 57 операций нет схемы ответа. Неизвестны форматы постов, пользователей, профилей, чатов, сообщений, комментариев, подписок, локаций и истории поиска.
- **P2.** Не описаны ошибки (400/401/403/404/409/413/429/500).
- **P13.** Пагинация неоднородна: `PageNumber`/`PageSize` есть у #16, #21, #22, #25, #41, #55; у остальных списков (#6, #12, #13, #24, #33–#35, #43, #47) её нет. Формат постраничного ответа неизвестен.
- **P19.** Обёртка ``Response`1`` (`data`, `errors`, `statusCode`) используется только в 8 операциях; `statusCode` дублирует HTTP-статус.
- **P23.** Типы `text/json` и `application/*+json` — артефакт ASP.NET, для нового API не нужны.

### Безопасность
- **P3.** Bearer JWT в заголовке требует хранить токен в JavaScript — противоречит нашему требованию HttpOnly-сессий. Нет операции выхода (logout).
- **P4.** Пароли и токен сброса передаются в query string (#4 `Token`, `Password`, `ConfirmPassword`; #5 `OldPassword`, `Password`, `ConfirmPassword`) — попадают в логи серверов, прокси и историю браузера.
- **P7.** Идентификатор текущего пользователя передаётся параметром вместо сессии: #25 `UserId`; у #50 `userId` неясно, чей аккаунт удаляется.
- **P8.** Не описаны права доступа: кто может удалять пользователя (#50), создавать/менять/удалять локации (#18–#20), удалять комментарий (#31 — только автор или ещё автор поста?), удалять сообщение (#10). Ролей (например, admin) в документе нет.
- **P9.** Поиск пользователей по `Email` (#41) позволяет узнавать чужие адреса и проверять, зарегистрирован ли email.
- **P20.** Для загрузок (#9 `File`, #26 `Images`, #38 `Image`, #56 `imageFile`) не указаны допустимые типы и размеры файлов.

### Методы, имена и стиль
- **P5.** Неверные HTTP-методы: `DELETE` для запроса и выполнения сброса пароля (#3, #4); `PUT` для отправки сообщения (#9); `PUT` для частичного изменения профиля (#54).
- **P10.** Смешанный стиль: kebab-case (`get-posts`) и PascalCase (`LikeStory`, `GetStoryById`, `AddStories`), `get-Locations`; параметры `UserId` и `userId`, `StoryId` и `storyId`; идентификаторы передаются в query вместо пути.
- **P11.** Опечатка: параметр `massageId` (#10) вместо `messageId`.
- **P21.** `confirmPassword` отправляется на сервер (#1, #4, #5); совпадение паролей — проверка формы, серверу достаточно одного пароля.

### Неясное поведение
- **P6.** Нет операций отмены: снять лайк поста, убрать из избранного, снять лайк сторис. Возможно, #28/#32/#36 работают как переключатель — документ этого не говорит.
- **P14.** Reels: есть #22 `get-reels`, но #26 принимает только `Images`. Как пост становится reel и поддерживается ли видео — не определено.
- **P15.** Stories: срок жизни не указан; у #38 и `PostId`, и `Image` необязательны — неясно, какое сочетание допустимо. `GetStoryDto` возвращает `fileName`, а не URL; `viewerDto` содержит счётчики `viewCount` и `viewLike`.
- **P16.** `Gender` — enum `0/1` без подписей.
- **P17.** Локации не связаны ни с постами, ни с пользователями; назначение справочника неясно.
- **P18.** Формат строковых id пользователей не указан (вероятно, GUID).
- **P22.** Сброс пароля (#3) требует отправки письма — способ доставки не описан.
- **P24.** `delete-chat` (#11): удаляется чат для обоих участников или только скрывается для себя — неизвестно. Что делает `create-chat` (#8), если чат уже существует, — неизвестно.
- **P25.** Как раздаются медиафайлы (URL, права доступа к вложениям чата) — не описано.

### Отсутствующие операции
- **P12.** Нет: выхода из аккаунта; получения списка комментариев поста (возможно, они входят в ответ #23 — неизвестно); списка сообщений чата с пагинацией (возможно, входит в #7); отметки «прочитано»; редактирования поста, комментария, сообщения; изменения `userName`/`fullName`; просмотра списка зрителей сторис; уведомлений.

Как каждая проблема решается в новом контракте — см. [API_CONTRACT.md](API_CONTRACT.md#4-исправленные-проблемы-исходного-контракта).
