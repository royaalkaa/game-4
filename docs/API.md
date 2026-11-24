# Контракт API

Общий договор бэкенда и фронта. Меняется только вместе с обеими сторонами. Правила игры в `SPEC.md`.

## Общее

- Все пути с префиксом `/api`. JSON, время в ISO 8601 UTC (`2026-11-13T18:00:00Z`).
- Фото отдаются статикой по `/media/<key>.jpg`.
- Ошибка: HTTP-код + `{"error": {"code": "<machine_code>", "message": "<текст для человека по-русски>"}}`. Фронт показывает `message`, логику строит на `code`.
- Каждый ответ с состоянием батла содержит `server_time`, чтобы клиент считал таймер со сдвигом часов.
- Cookie: голосующий `pb_v_<battle_id>`, админ `pb_admin`. Обе `HttpOnly`, `SameSite=Lax`, `Secure` по настройке `COOKIE_SECURE`.
- Фронт в разработке ходит через прокси Vite на `http://127.0.0.1:8000` для `/api` и `/media`. В проде бэкенд сам отдаёт собранный фронт (папка из `FRONTEND_DIST`) с откатом на `index.html` для путей SPA.

## Типы

```ts
type BattleStatus = "draft" | "active" | "finished" | "stopped";
type BattleMode = "duel" | "swipe";
type SwipePhase = "collecting" | "voting";       // только у свайпов
type RoundState = "running" | "break";            // break: раунд закрыт, ждём ведущего
type MatchStatus = "pending" | "active" | "finished";
type DecidedBy = "votes" | "tie" | "lot" | "removal" | "bye";

interface Photo {
  id: number;
  url: string;              // "/media/<key>.jpg"
  caption: string | null;   // для не-админа null, пока матч с этим фото не закончен
  width: number;
  height: number;
}

interface Match {
  id: number;
  round: number;            // с 1
  slot: number;             // с 0, порядок в раунде
  status: MatchStatus;
  photo_a: Photo | null;
  photo_b: Photo | null;    // null у прохода без дуэли (bye)
  ends_at: string | null;
  winner_id: number | null;
  decided_by: DecidedBy | null;
  total_votes: number;
  votes_a: number | null;   // null, если счёт скрыт (правила ниже)
  votes_b: number | null;
  my_vote: number | null;   // photo_id, за который голосовал текущий зритель
}

interface Battle {
  id: number;
  title: string;
  theme: string;
  mode: BattleMode;
  phase: SwipePhase | null;         // null у дуэлей и у законченных свайпов
  status: BattleStatus;
  round_state: RoundState | null;   // null у draft, finished, stopped
  current_round: number | null;
  total_rounds: number | null;      // null у draft
  round_ends_at: string | null;
  frozen: boolean;                  // идёт заморозка счёта
  winner: Photo | null;
  joined: boolean;                  // у запроса есть валидная cookie голосующего
  my_photo: Photo | null;           // свайпы: фото, которое прислал этот гость
  participants: number;             // фото в игре, без снятых
  server_time: string;
}

interface Bracket { rounds: { round: number; matches: Match[] }[] }
```

**Когда виден счёт (`votes_a`, `votes_b`)**

- Админ видит всегда.
- Матч `finished`: видят все.
- Матч `active`: только зритель с `my_vote != null` и только если батл не `frozen`.
- Во всех остальных случаях `null`. `total_votes` виден всегда.

## Публичные эндпоинты

| Метод и путь | Тело | Ответ | Ошибки |
| --- | --- | --- | --- |
| `GET /api/battles/{id}` | | `Battle` | 404 `not_found` (в том числе draft) |
| `GET /api/battles/{id}/bracket` | | `Bracket` | 404 |
| `GET /api/battles/{id}/next-match` | | `{"match": Match \| null}`: активный матч текущего раунда, где зритель ещё не голосовал, по возрастанию `slot`; матчи-bye не выдаются | 401 `not_joined` |
| `POST /api/battles/{id}/join` | `{"code": "..."}` | `{"ok": true}` + cookie голосующего. Если cookie уже валидна, новый голосующий не создаётся | 400 `code_invalid`, 404, 409 `battle_closed` (не active) |
| `POST /api/matches/{id}/vote` | `{"photo_id": 1}` | `Match` с видимым счётом (если не frozen) | 401 `not_joined`, 400 `bad_photo`, 409 `already_voted`, 409 `match_closed` |

## Админ

Все `/api/admin/*`, кроме `login`, без cookie админа отвечают 401 `admin_required`.

| Метод и путь | Тело | Ответ | Ошибки |
| --- | --- | --- | --- |
| `POST /api/admin/login` | `{"password": "..."}` | `{"ok": true}` + cookie | 401 `bad_password`, 429 `too_many_attempts` (5 ошибок за 10 минут с IP) |
| `POST /api/admin/logout` | | `{"ok": true}` | |
| `GET /api/admin/me` | | `{"admin": true}` | 401 |
| `GET /api/admin/battles` | | `[{id, title, theme, status, photo_count, created_at}]`, новые сверху | |
| `POST /api/admin/battles` | `{title, theme, round_seconds, freeze_seconds, auto_advance, mode?}` (`mode` по умолчанию `"duel"`) | `AdminBattle` | 422 `validation` |
| `GET /api/admin/battles/{id}` | | `AdminBattle` | 404 |
| `POST /api/admin/battles/{id}/photos` | multipart: `file`, `caption` (необязательно) | `Photo` | 400 `bad_image`, 413 `too_large`, 409 `not_draft`, 409 `too_many_photos` |
| `DELETE /api/admin/battles/{id}/photos/{photo_id}` | | `{"ok": true}` | 409 `not_draft` |
| `POST /api/admin/battles/{id}/start` | | `AdminBattle` | 409 `not_draft`, 409 `not_enough_photos` |
| `POST /api/admin/battles/{id}/finish-round` | `{"round": N}`: номер раунда, который ведущий видел на экране | `AdminBattle`: раунд N закрыт сейчас | 409 `round_not_running` (N уже не идёт, например его сменил автостарт) |
| `POST /api/admin/battles/{id}/next-round` | | `AdminBattle` | 409 `round_not_finished` |
| `POST /api/admin/battles/{id}/stop` | | `AdminBattle` | 409 `not_active` |
| `POST /api/admin/battles/{id}/photos/{photo_id}/remove` | | `AdminBattle`: фото проигрывает свой активный матч с `decided_by = removal` | 409 `not_active`, 409 `not_in_active_match` |
| `GET /api/admin/battles/{id}/join` | | `{"url": "...", "valid_until": "..."}`: текущая ссылка входа | 409 `not_active` |
| `GET /api/admin/battles/{id}/qr.svg` | | `image/svg+xml`: QR той же ссылки, `Cache-Control: no-store` | 409 `not_active` |

```ts
interface AdminBattle extends Battle {
  round_seconds: number;     // 30..86400
  freeze_seconds: number;    // 0..round_seconds-1
  auto_advance: boolean;
  photos: Photo[];           // caption всегда заполнен как есть
  bracket: Bracket;          // счёт всегда виден; пустой у draft
  voters: number;            // сколько зрителей вошло
  swipers: number;           // свайпы: сколько гостей уже голосовало
  standings: Standing[];     // свайпы: живой счёт, только админу; пустой у дуэлей
}

interface Standing { photo: Photo; likes: number; dislikes: number; rank: number }
```

## Свайпы

Режим `swipe`: гости по QR присылают своё фото с именем, потом каждый свайпает чужие фото: вправо «да», влево «нет». Победитель тот, у кого больше «да»; при равенстве выше тот, у кого меньше «нет»; одинаковый счёт делит место.

Ход: `start` открывает приём фото (`phase = "collecting"`, фото не обязательны) → `start-voting` (нужно 2 фото) запускает одно голосование на `round_seconds` (`phase = "voting"`, `current_round = total_rounds = 1`) → по времени или `finish-round {"round": 1}` батл `finished`. `freeze_seconds` и `auto_advance` не используются.

| Метод и путь | Тело | Ответ | Ошибки |
| --- | --- | --- | --- |
| `POST /api/battles/{id}/my-photo` | multipart: `file`, `name` (1..80) | `Photo`; повторная загрузка заменяет фото гостя | 401 `not_joined`, 409 `collecting_closed`, 409 `too_many_photos` (200), 400 `bad_image`, 413 `too_large`, 404 у дуэлей |
| `DELETE /api/battles/{id}/my-photo` | | `{"ok": true}` | 409 `collecting_closed`, 404 |
| `GET /api/battles/{id}/deck` | | `{"photos": Photo[], "total": n}`: ещё не оценённые фото без своего, у каждого гостя свой порядок; вне голосования пусто | 401 `not_joined`, 404 у дуэлей |
| `POST /api/photos/{id}/swipe` | `{"liked": true}` | `{"ok": true}` | 401 `not_joined`, 403 `own_photo`, 409 `already_swiped`, 409 `voting_closed` |
| `GET /api/battles/{id}/standings` | | `{"entries": Standing[]}` | 409 `not_finished` (до конца счёт не отдаётся) |
| `POST /api/admin/battles/{id}/start-voting` | | `AdminBattle` | 409 `not_collecting`, 409 `not_enough_photos` |

Админ загружает и удаляет фото в черновике и во время приёма фото. `photos/{id}/remove` во время голосования снимает фото из колоды и итогов.

```ts
```

## Правила, которые реализует бэкенд

- `title` 1..80 символов, `theme` 0..120, `caption` 0..80.
- Фото: 2..16 на батл; JPEG, PNG, WebP по содержимому; до 10 МБ; до 8000 px по стороне. Сервер поворачивает по EXIF, уменьшает до 2048 px по длинной стороне, перекодирует в JPEG без метаданных, имя файла `uuid4().hex`.
- Сетка: размер = ближайшая степень двойки ≥ числа фото, `total_rounds = log2(размер)`. Порядок фото случайный (`secrets`). Проходы без дуэли раздаются так, чтобы в одном матче не было двух пустых мест. Матчи следующего раунда создаются при закрытии предыдущего: победители слотов `2k` и `2k+1` идут в слот `k`.
- Раунд закрывается по времени или кнопкой `finish-round`. Решение матча: больше голосов → `votes`; равно и больше нуля → побеждает фото, чей последний голос пришёл раньше, `tie`; 0:0 → случайно, `lot`. Bye решается сразу при старте раунда.
- После закрытия: если раунд последний, батл `finished` и `winner` заполнен. Иначе при `auto_advance` сразу стартует следующий раунд, без него `round_state = "break"` до `next-round`.
- `frozen = true`, когда раунд `running` и до `round_ends_at` осталось не больше `freeze_seconds`.
- Код входа: 8 символов из `secrets.token_urlsafe`, новый каждые 30 секунд, действует 60 секунд с момента выдачи. Хранится хешем. Ссылка: `{PUBLIC_BASE_URL}/join/{battle_id}?code=<код>`.
- Голос после `round_ends_at` отклоняется, даже если фоновая задача ещё не закрыла раунд.
- Лимитов по IP на публичных эндпоинтах нет: 300 телефонов в зале с одного адреса и опросом раз в 5 секунд дают 3600 запросов в минуту. Лимит по IP есть только у `admin/login`.
