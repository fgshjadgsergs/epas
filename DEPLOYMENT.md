# Production deployment (KidsPrint)

Боевой контур. Демонстрационные цены запрещены (`APP_ENV=production`,
`ALLOW_DEMO_PRICING=false`). Для публичного демо-стенда см. `STAGING_DEPLOY.md`.

Сервисы `docker-compose.yml`: `postgres`, `redis`, `minio`, `backend`,
`frontend` (профиль `frontend`). Данные — в именованных volume’ах
(`postgres_data`, `redis_data`, `minio_data`), переживают пересборку.

## 0. Требования окружения (fail-fast)

Приложение НЕ стартует при нарушении (проверка `src/config/env.validation.ts`):

```env
NODE_ENV=production
APP_ENV=production
ALLOW_DEMO_PRICING=false          # true при APP_ENV=production роняет старт
TRUST_PROXY=true                  # за nginx (иначе Secure-cookie/rate-limit по IP прокси)

DATABASE_URL=postgresql://<user>:<pass>@postgres:5432/<db>?schema=public
REDIS_HOST=redis
REDIS_PORT=6379

JWT_ACCESS_SECRET=<случайная строка ≥32 симв.>   # openssl rand -base64 48
JWT_REFRESH_SECRET=<другая ≥32 симв.>            # ДОЛЖНА отличаться
CORS_ORIGIN=https://<домен>                       # точный origin, wildcard/пусто запрещено

S3_ENDPOINT=<endpoint>            # НЕ дефолтные minioadmin/minioadmin в production
S3_BUCKET=<bucket>
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>

SEED_ADMIN_EMAIL=<email админа>
SEED_ADMIN_PASSWORD=<надёжный пароль>            # дефолт ChangeMe123! в production роняет seed
```

Секреты в репозиторий не коммитятся.

## 1. Порядок релиза (production-safe)

```bash
cd /srv/photo-print

# 1) БЭКАП ДО выката (см. §Backup) — проверить, что файл ненулевой.
pg_dump "$DATABASE_URL" -Fc -f "backup-$(date +%F-%H%M).dump" && ls -lh backup-*.dump

# 2) Код
git fetch --all --prune
git pull --ff-only                # только fast-forward; при divergence остановиться

# 3) Сборка образов
docker compose up -d --build backend
docker compose --profile frontend up -d --build frontend

# 4) Миграции (forward-only; reset/db push НЕ применять)
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma migrate status    # «up to date»

# 5) Идемпотентный сид каталога (роли/права/33 услуги; НЕ трогает users/orders/cart/цены)
docker compose exec -e SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  backend node dist/prisma/seed.js

# 6) Провижн боевых калькуляторов (33 определения isDemo=false, БЕЗ цен; идемпотентно)
docker compose exec backend node dist/prisma/seed-calculator-live.js

# 7) Health/readiness (см. §Health)
curl -fsS https://<домен>/api/v1/health && echo OK

# 8) Smoke (см. §Smoke) → решение о релизе
```

`prisma db seed` НИКОГДА не создаёт демо-цены в production; `seed-calculator-live.js`
цен не выдумывает. `migrate reset`, `db push`, `drop database` — запрещены.

## 2. Health / readiness

`GET /api/v1/health` → **200** только если БД доступна; **503** при недоступной БД
(тело: `{status,database,timestamp}`, без internal-деталей). Docker healthcheck
(`wget` на `/health`) помечает backend **unhealthy** при 503 — оркестратор не шлёт
трафик. «`docker ps` = up» не является критерием успешного релиза — проверяйте
`curl /health` = 200 и `docker compose ps` (backend `healthy`).

## 3. LIVE-цены (handoff оператору)

После §1 все 33 калькулятора существуют, но **цен нет** → на сайте «расчёт
недоступен». Оператор заводит боевые цены через админку (без разработчика/SQL/seed):

1. Войти под администратором → `/admin/pricing`.
2. Открыть калькулятор → **«Создать прайс»** (пустой DRAFT, `isDemo=false`).
3. Добавить правила: `BASE_TIER` (цена за штуку/лист/экземпляр по диапазонам),
   при необходимости `MULTIPLIER`, `SURCHARGE_FLAT/PER_UNIT`, `QTY_DISCOUNT` — все
   с человекочитаемыми подписями, без raw JSON.
4. **Проверить** → **Пробный расчёт** → **Опубликовать**. Публичная цена меняется сразу.

Гарантии: `PricingEnvironmentService` не даёт активировать `isDemo=true` в
production; клонирование прайса наследует `isDemo` источника (боевой остаётся
боевым). Публикуйте по мере готовности цен — не обязательно все 33 сразу.

## 4. Nginx / HTTPS

Пример конфигурации — в `STAGING_DEPLOY.md §7` (заменить домены). Прокси на backend
обязан передавать `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
(вместе с `TRUST_PROXY=true` — для Secure refresh-cookie и корректного rate-limit
по IP клиента). Наружу открывать только 443; порты postgres/redis/minio-консоли —
только localhost (уже так в compose). `client_max_body_size` — под лимиты загрузки
(артворк до ~50 МБ, изображения услуг до 20 МБ); timeouts конечные, не бесконечные.

## 5. Rate limits (F-2/F-3)

Глобальный лимит 1200/мин (catalog-friendly). Отдельные лимиты (per-IP): загрузка
файла 20/мин, presign/скачивание/preview 60/мин, привязка макета 30/мин, загрузка
изображения услуги 20/мин, публичный confirm 12/мин. **Топология — один backend-
инстанс**, throttler хранит состояние in-memory (корректно для одного инстанса).
Горизонтальное масштабирование (>1 реплики) потребует общего хранилища на Redis —
до этого лимиты действуют per-instance (см. RELEASE_CHECKLIST «Accepted residuals»).

## 6. Backup

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump      # снимать ДО каждого выката
ls -lh backup.dump                               # убедиться, что файл ненулевой
```

Хранить вне сервера приложения (или в отдельном volume/бакете). S3/MinIO:
артворк — PRIVATE, изображения каталога — PUBLIC; при self-hosted MinIO бэкапить
`minio_data` (или использовать external S3). В deploy-командах бакет НЕ удалять,
`docker compose down -v` НЕ использовать (сотрёт volume’ы БД/файлов).

## 7. Rollback

- **Приложение:** предыдущий tag/commit → `git checkout <tag>` → пересобрать образы.
  Прежний образ совместим с БД, только если новая миграция не ломает контракт;
  иначе — forward-fix (новая миграция «вперёд»).
- **БД:** миграции forward-only, авто-down нет. Полное восстановление из дампа
  (`pg_restore -d "$DATABASE_URL" --clean backup.dump`) — только incident-процедура,
  не обычный откат.

## 8. Smoke после релиза

```bash
API=https://<домен>/api/v1
curl -fsS $API/health                                   # 200
curl -fsS $API/services/vizitki/calculator | head -c 120 # определение отдаётся
# анонимная корзина: cookie выставляется
curl -s -c /tmp/c.txt -o /dev/null $API/cart && grep kp_cart_sid /tmp/c.txt
```

UI: главная, каталог, страница услуги, вход/регистрация → refresh → перезагрузка,
калькулятор (после ввода цены) → корзина → checkout, `/admin` (заказы/прайсы/макеты).

## 9. Известные блокеры и остаточные риски

См. `RELEASE_CHECKLIST.md` — бизнес-блокеры (LIVE-цены, id-photo контент, 4 услуги
вне ТЗ) и принятые остаточные риски (single-instance throttler, dep-advisories).
