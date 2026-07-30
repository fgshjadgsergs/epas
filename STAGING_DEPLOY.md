# Развёртывание staging-стенда

Staging — публичный демонстрационный стенд: работает на **production-сборке**,
но показывает **демонстрационные цены**. Боевой прайс заказчик пока не
предоставил, поэтому `APP_ENV=production` сейчас означает «калькуляторы
недоступны» — до появления LIVE-прайсов используется только staging.

Домены в примерах: `https://staging.kids-print.ru` и
`https://api-staging.kids-print.ru`. Замените на фактические.

## 0. Изоляция staging

Staging обязан быть отделён от боевого контура:

| Ресурс | Требование |
|---|---|
| База данных | отдельный `DATABASE_URL`; подключать staging к production-БД запрещено |
| S3 | отдельный bucket либо отдельный префикс (`S3_BUCKET=kidsprint-staging`) |
| Домены | `staging.<domain>` и `api-staging.<domain>` |
| Cookie | своя `kp_cart_sid` на домене staging (разные хосты не пересекаются) |
| Логи | отдельный каталог/поток, помечены `APP_ENV=staging` |

При старте backend пишет в лог `DEMO PRICING ENABLED (APP_ENV=staging)` —
если этой строки нет, демо-цены не включены и калькуляторы будут пустыми.

## 1. Переменные окружения

### Backend (`.env`)

```env
NODE_ENV=production          # staging всегда на production-сборке
APP_ENV=staging              # development | staging | production
ALLOW_DEMO_PRICING=true      # демо-цены; при APP_ENV=production запрещено

PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<staging_db>?schema=public

JWT_ACCESS_SECRET=<случайная строка ≥32 символов>
JWT_REFRESH_SECRET=<другая случайная строка ≥32 символов>

S3_ENDPOINT=<endpoint>
S3_BUCKET=<staging-bucket>
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>

CORS_ORIGIN=https://staging.kids-print.ru   # точный origin, wildcard запрещён
TRUST_PROXY=true                            # за nginx
```

Секреты в репозиторий не коммитятся. Генерация: `openssl rand -base64 48`.

**Fail-fast.** Приложение не стартует, если:
- `APP_ENV=production` и `ALLOW_DEMO_PRICING=true` — демо-цены на боевом стенде;
- `APP_ENV=staging` и `NODE_ENV≠production` — публичный стенд на dev-сборке;
- в production JWT-секреты короче 32 символов или совпадают с примерами из
  `.env.example`, S3-креды остались дефолтными от MinIO, `CORS_ORIGIN` пуст
  либо равен `*`.

### Frontend

Обе переменные — публичные и **зашиваются на этапе `next build`**, а не
читаются в рантайме: после их изменения фронт нужно пересобрать.

При запуске через npm — `frontend/.env.production`:

```env
NEXT_PUBLIC_API_URL=https://api-staging.kids-print.ru/api/v1
NEXT_PUBLIC_DEMO_PRICING=true   # только fallback до ответа backend
```

При запуске через Docker этот файл в образ не копируется — значения
передаются build-аргами из корневого `.env`:

```env
FRONTEND_API_URL=https://api-staging.kids-print.ru/api/v1
FRONTEND_DEMO_PRICING=true
```

Пометка «демонстрационный прайс» управляется полем `pricingMode` из ответа
API; переменная нужна лишь на экранах, где расчёт ещё не выполнен.

## 2. Зависимости и сборка

```bash
# backend (корень)
npm ci
npx prisma generate
npm run build

# frontend
cd frontend
npm ci
npm run build
```

## 3. Миграции

```bash
npx prisma migrate deploy      # применяет неприменённые миграции
npx prisma migrate status      # ожидается «Database schema is up to date!»
```

`migrate dev` и `migrate reset` на стенде не запускать.

## 4. Каталог

```bash
npm run seed                          # без Docker
docker compose exec backend node dist/prisma/seed.js   # в Docker
```

Идемпотентно (upsert по slug), демо-цены не создаёт.

Пароль администратора задаётся `SEED_ADMIN_PASSWORD`; со значением по
умолчанию seed в production-сборке падает намеренно.

## 5. Демонстрационные цены

```bash
# без Docker
APP_ENV=staging ALLOW_DEMO_PRICING=true npm run seed:calculator-demo

# в Docker
docker compose exec -e APP_ENV=staging -e ALLOW_DEMO_PRICING=true   backend node dist/prisma/seed-calculator-demo.js
```

Скрипт:
- отказывается работать при `APP_ENV=production` и в staging без флага;
- печатает предупреждение `DEMO PRICING ENABLED`;
- публикует определения и прайсы штатным `PublishService` — ручной SQL для
  активации не нужен;
- идемпотентен: прежние демо-версии архивируются, ACTIVE-прайсов остаётся
  ровно по одному на калькулятор;
- не трогает LIVE-прайсы (`isDemo=false`).

Проверка:

```sql
SELECT status, "isDemo", count(*) FROM price_lists GROUP BY 1,2;
-- ожидается: ACTIVE | t | 4
```

## 6. Запуск

### Вариант А — Docker (рекомендуется)

Фронтенд вынесен в профиль `frontend`, поэтому поднимается явным флагом:

```bash
docker compose --profile frontend up -d --build
```

Обновление после `git pull`:

```bash
docker compose up -d --build backend                    # только API
docker compose --profile frontend up -d --build frontend   # только сайт
docker compose --profile frontend up -d --build          # всё сразу
```

Пересобирать фронт обязательно при изменении `FRONTEND_API_URL` или
`FRONTEND_DEMO_PRICING` — они попадают в бандл на этапе сборки. Миграции и
сиды при этом запускаются отдельно (разделы 3–5), внутри контейнера:

```bash
docker compose exec backend npx prisma migrate deploy

# Сиды запускаются скомпилированными: в рантайм-образе стоит только
# production-зависимости, ts-node там нет, а dist/prisma/*.js есть.
docker compose exec backend node dist/prisma/seed.js
docker compose exec -e APP_ENV=staging -e ALLOW_DEMO_PRICING=true \
  backend node dist/prisma/seed-calculator-demo.js
```

### Вариант Б — без Docker

```bash
# backend
NODE_ENV=production APP_ENV=staging ALLOW_DEMO_PRICING=true node dist/src/main.js

# frontend
cd frontend && npm run start -- --port 3001
```

Для автозапуска — systemd. В логе backend при старте обязана быть строка
`DEMO PRICING ENABLED (APP_ENV=staging)`:

```bash
docker compose logs backend | grep "DEMO PRICING ENABLED"
```

## 7. Nginx и HTTPS

Сертификаты: `certbot --nginx -d staging.kids-print.ru -d api-staging.kids-print.ru`.

```nginx
server {
    listen 443 ssl http2;
    server_name staging.kids-print.ru;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name api-staging.kids-print.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name staging.kids-print.ru api-staging.kids-print.ru;
    return 301 https://$host$request_uri;
}
```

Добавьте `X-Robots-Tag: noindex` на оба сервера — демо-стенд не должен
попадать в поиск.

### Cookie и CORS

Анонимная корзина живёт в cookie `kp_cart_sid`: `httpOnly`, `Secure`
(в production-сборке), `SameSite=Lax`, срок 1 год.

- `staging.<domain>` и `api-staging.<domain>` — поддомены одного site, поэтому
  `SameSite=Lax` работает: браузер отправляет cookie на api-поддомен.
- Frontend шлёт запросы с `credentials: 'include'`, backend отвечает
  `Access-Control-Allow-Credentials: true` и точным `CORS_ORIGIN`.
- HTTPS обязателен: без него `Secure`-cookie не сохранится и корзина не
  заработает.
- Если frontend и API окажутся на **разных** сайтах (например,
  `kids-print.ru` и `api.other-host.net`), `SameSite=Lax` перестанет
  работать — потребуется `SameSite=None; Secure`. Менять без такой
  необходимости не нужно: `None` ослабляет защиту от CSRF.

## 8. Проверка после развёртывания

```bash
API=https://api-staging.kids-print.ru/api/v1

curl -s $API/health                                   # состояние сервиса
curl -s $API/services/listovki/calculator | head -c 200   # определение отдаётся

# расчёт: ожидается "pricingMode":"DEMO"
curl -s -X POST $API/services/listovki/calculate \
  -H 'content-type: application/json' \
  -d '{"parameters":{"qty":500}}' | grep -o '"pricingMode":"[A-Z]*"'

# анонимная корзина: cookie выставляется и переживает повторный запрос
curl -s -c /tmp/c.txt -o /dev/null $API/cart && grep kp_cart_sid /tmp/c.txt
```

Если определение возвращает 404, а расчёт — «калькулятор не настроен»,
значит демо-цены не разрешены: проверьте `APP_ENV`/`ALLOW_DEMO_PRICING` и
что демо-seed отработал.

## 9. Демонстрация

Полный сценарий показа — `DEMO_CART_CHECKLIST.md` (расчёт → корзина →
перезагрузка → вторая позиция → удаление → вход → merge).

## 10. Откат

**Приложение.** Держите предыдущий релиз рядом и переключайтесь симлинком
либо тегом образа:

```bash
git checkout <предыдущий-tag>
npm ci && npm run build && systemctl restart kidsprint-api
```

**Миграции.** Автоматического отката нет: Prisma не генерирует down-скрипты.
Порядок действий:

1. Снимите дамп до развёртывания: `pg_dump "$DATABASE_URL" -Fc -f backup.dump`.
2. При проблеме восстановите: `pg_restore -d "$DATABASE_URL" --clean backup.dump`.
3. Если нужен точечный откат — новая миграция «вперёд», отменяющая изменение;
   уже применённые миграции не редактируются.

Проверить, что миграции применяются на копии боевых данных, можно командой
`npm run test:migrations:calculator` — она поднимает одноразовую БД, гоняет
полную цепочку и удаляет её.

**Демо-данные.** Демо-прайсы отключаются без выката: поставьте
`ALLOW_DEMO_PRICING=false` и перезапустите backend — калькуляторы перестанут
отдавать демо-цены, данные в БД останутся нетронутыми.
