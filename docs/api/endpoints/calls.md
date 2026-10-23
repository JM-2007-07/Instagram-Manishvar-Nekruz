# Эндпоинты: `calls`

> Модуль `calls` · функции F-CAL-* · [ADR 0015](../../decisions/0015-webrtc-calls.md) · спецификация [features/calls.md](../../features/calls.md) ·
> сигнализация — [REALTIME.md](../REALTIME.md#звонки).

| Метод и путь | Доступ | Запрос | Ответ | Ошибки | F |
|---|---|---|---|---|---|
| `GET /calls/ice-servers` | User | — | `{ iceServers: { urls, username?, credential? }[] }` — STUN и временные учётные данные TURN | — | F-CAL-01 |
| `POST /chats/{chatId}/calls` | Member | `{ type: "AUDIO" \| "VIDEO" }` | `201 Call` (`RINGING`) + событие `call:incoming` участникам | 404, 409 `CALL_BUSY` (собеседник в другом звонке или вам звонят; свои брошенные звонки — `ONGOING` и свои `RINGING` — сначала завершаются) | F-CAL-01, 02 |
| `POST /calls/{callId}/accept` | приглашённый | — | `Call` (`ONGOING`) | 404, 409 | F-CAL-01 |
| `POST /calls/{callId}/decline` | приглашённый | — | `204` | 404 | F-CAL-01 |
| `POST /calls/{callId}/end` | участник | — | `Call` (`ENDED`) + сообщение-событие в чате | 404 | F-CAL-03 |
| `GET /calls/{callId}` | участник | — | `Call` | 404 | F-CAL-03 |

Правила:
- Без ответа 30 с 📝 → `MISSED`; сообщение «Пропущенный аудиозвонок / видеозвонок».
- Обмен SDP и ICE-кандидатами — только через Socket.IO; backend не хранит SDP.
- Групповой звонок (P2) — тот же поток, участники из группового чата, сетка peer-to-peer до 4 📝.
