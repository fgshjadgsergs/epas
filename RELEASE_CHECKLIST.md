# Release checklist (PRINTERA Core MVP)

Технические release-fixes стадии 9/9 выполнены. Оставшиеся блокеры —
**бизнес-данные**, не код. Подробный деплой — `DEPLOYMENT.md`.

## Технический статус

| Пункт | Статус |
|---|---|
| Калькуляторы (TECH) | 33/33 TECH_READY (регресс-смоук 33/33 calculate/confirm/cart/invalid) |
| F-1 health readiness | FIXED — БД down → 503, up → 200 (docker healthcheck ловит) |
| F-2 file rate limits | FIXED — upload 20/мин, presign/download/preview 60/мин, image 20/мин (per-IP) |
| F-3 throttler topology | ACCEPTED RESIDUAL — один backend-инстанс, in-memory throttler корректен |
| F-9 inactive fallback | FIXED — деактивированная услуга → 410 Gone → 404 (не воскрешает статику); network/404 → статик-фолбэк |
| F-C6-5 admin monetary edit | VERIFIED — MULTIPLIER/SURCHARGE_FLAT/PER_UNIT/QTY_DISCOUNT редактируются в UI (человекочитаемо, без raw JSON/SQL) |
| Backend gates | build ✓ · prisma validate ✓ · npm test ✓ · migrations ✓ |
| Frontend gates | typecheck ✓ · lint ✓ · test ✓ · build ✓ |

**Технических release-блокеров: 0.**

## Pre-deploy (каждый выкат)

- [ ] `pg_dump` бэкап снят и ненулевой (хранить вне сервера приложения).
- [ ] `.env`: `NODE_ENV=production`, `APP_ENV=production`, `ALLOW_DEMO_PRICING=false`,
      `TRUST_PROXY=true`, `CORS_ORIGIN` = точный origin, JWT-секреты ≥32 и различны,
      S3 не дефолтные, `SEED_ADMIN_PASSWORD` задан. (Fail-fast проверит на старте.)
- [ ] `git pull --ff-only` (без reset/rebase/force).
- [ ] `docker compose up -d --build backend` + `--profile frontend … frontend`.
- [ ] `prisma migrate deploy` → `migrate status` = up to date (forward-only).
- [ ] `seed.js` (роли/права/каталог, идемпотентно) → `seed-calculator-live.js` (33 боевых определения).
- [ ] `GET /health` = 200, backend контейнер `healthy`.
- [ ] Smoke (DEPLOYMENT §8) пройден → решение о релизе.

## Бизнес-блокеры (НЕ код; блокируют коммерческий запуск, не техготовность)

1. **LIVE-цены 33/33 отсутствуют.** Все определения `isDemo=false`, но прайсов нет →
   калькуляторы «недоступны» до ввода цен. Оператор вводит цены через
   `/admin/pricing` → «Создать прайс» → правила → Опубликовать (DEPLOYMENT §3).
   Пока LIVE-цен нет — сайт не готов принимать реальные заказы.
2. **Фото на документы — производственный контент.** Тип документа управляется
   CMS/БД (ТЗ 3.3, «30+ вариантов»); сейчас 35 демо-типов + демо-цены. Нужен
   реальный список + цены (вводятся тем же admin-workflow; архитектура готова).
3. **4 услуги вне ТЗ** — `/kalendari/foto/`, `/kalendari/planingi/`,
   `/pechati-shtampy/plombiratory/`, `/suveniry/lanyardy-bejdzi/`. В ТЗ калькуляторов
   их нет. В production безопасны (нет backend-услуги → «недоступно», без фейк-цены
   и корзины). Требуется **решение заказчика**: A) скрыть; B) «цена по запросу»;
   C) отдельное ТЗ на калькулятор. Реализация — вне текущего scope, не выбираем сами.

## Accepted residual risks (не блокеры)

- **F-3 single-instance throttler.** Лимиты действуют per-instance (in-memory).
  Корректно для одного backend (текущая топология compose). При масштабировании
  >1 реплики — подключить Redis (уже в compose) как shared throttler storage.
- **Dependency advisories** (`npm audit`, prod-зависимости):
  - Next.js SSRF via `rewrites` — **не достижимо**: приложение использует только
    статические `redirects()`, dynamic `rewrites` с внешним хостом нет.
  - postcss (high) — build-time инструмент, не runtime-путь production.
  - express/qs (moderate, транзитивно), uuid (moderate; уязвим только при передаче
    `buf`, приложение так не использует) — не достижимо в проде.
  - Фиксы требуют мажорных апгрейдов (Next 16 / Express 5 / uuid 14) — **не делать
    вслепую на релизе**. Бэклог: плановый апгрейд Next и транзитивных зависимостей
    после релиза, с прогоном полного gate.
- **CSP unsafe-inline (styles)** — известный остаточный, не решается архитектурным
  переписыванием в 9/9 (backlog).

## Core-findings 8/9 — итог

F-1 FIXED · F-2 FIXED · F-3 ACCEPTED RESIDUAL (single instance) · F-9 FIXED ·
F-C6-5 VERIFIED. Прочие findings статуса не меняли между C2–C6.
