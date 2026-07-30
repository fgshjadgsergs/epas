# Demo checklist — Этапы 1–2

Чек-лист для запуска и показа клиенту текущего состояния проекта.

Состояние на момент написания: backend-инфраструктура, auth/RBAC, S3/MinIO storage и
базовый каталог (Categories/Services) реализованы и протестированы. Основной сайт
(`frontend/src/data/catalog.ts`, роут `[...slug]`) **остаётся статическим** — подключение
к backend запланировано отдельным этапом и сегодня не трогалось.

---

## Backend

```bash
cd D:\photo-print
docker compose up -d
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```

Проверить в браузере:

```text
http://localhost:3000/api/v1/health
http://localhost:3000/api/v1/docs
```

> ⚠️ Важно: health-эндпоинт живёт **под глобальным префиксом API** —
> `http://localhost:3000/api/v1/health`, а не `http://localhost:3000/health`
> (без префикса backend отдаст 404). Префикс задаётся в `.env` (`API_PREFIX=api/v1`)
> и применяется в `src/main.ts` ко всем роутам.

Сидовый пользователь (создаётся командой `npm run seed`):

```text
email:    admin@photo-print.local
password: ChangeMe123!
роль:     SUPER_ADMIN
```

---

## Frontend

```bash
cd D:\photo-print\frontend
npm install
npm run dev -- -p 3001
```

> Backend и frontend оба по умолчанию просятся на порт 3000 — **frontend всегда
> запускать с `-p 3001`** во время совместной работы с backend.

Проверить в браузере:

```text
http://localhost:3001
http://localhost:3001/lichnyy-kabinet/vhod-registraciya
http://localhost:3001/backend-demo
```

Переменная `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Backend `CORS_ORIGIN` (`.env`) выставлен на `http://localhost:3001` — без этого браузер
заблокирует запросы со страницы входа и `/backend-demo` по CORS.

---

## Сценарий показа клиенту

1. Открыть Swagger — `http://localhost:3000/api/v1/docs`.
2. Показать разделы документации: **auth**, **users**, **files**, **categories**,
   **admin/categories**, **services**, **admin/services**.
3. Открыть frontend — `http://localhost:3001`.
4. Показать обычный сайт: главная, переход в каталог/услугу — работает как обычный
   готовый сайт (статика, без подключения к backend).
5. Открыть страницу входа — `http://localhost:3001/lichnyy-kabinet/vhod-registraciya`.
6. Войти сидовым пользователем (`admin@photo-print.local` / `ChangeMe123!`).
7. Показать карточку «Вы вошли как…» — email и **реальные роли** (`SUPER_ADMIN`),
   полученные живым запросом к `GET /api/v1/users/me` с JWT.
8. Открыть `http://localhost:3001/backend-demo`.
9. Показать список категорий и услуг — это **реальные данные из PostgreSQL**,
   полученные через `GET /api/v1/categories` и `GET /api/v1/services`, а не из кода
   фронтенда.
10. Объяснить клиенту: основной каталог сайта (`/poligrafiya/`, `/vizitki/` и т.д.)
    сейчас статический (управляется файлом `catalog.ts` во фронтенде); подключение
    его к backend-каталогу — следующий этап, требующий решения по slug-формату и
    стратегии генерации страниц (SSG/ISR), это сознательно не делалось сегодня.

---

## Финальная проверка (выполнена перед demo)

```bash
# backend
npm run build                 # ✅ без ошибок

# frontend
cd frontend
npm run typecheck             # ✅ без ошибок
npm run build                 # ✅ 114 страниц, без ошибок
npm run test                  # ✅ 3 файла / 11 тестов
```

Curl-проверка (backend поднят, БД засеяна):

```text
GET /api/v1/health                  → {"status":"ok","database":"up",...}
GET /api/v1/categories?limit=5      → {"items":[...2 категории...],"meta":{...}}
GET /api/v1/services?limit=5        → {"items":[...3 услуги...],"meta":{...}}
POST /api/v1/auth/login             → access/refresh токены
GET /api/v1/users/me (с токеном)    → профиль + роли
```

---

## Известные ограничения (честно говорим клиенту)

- Основной каталог сайта **не подключён** к backend — это намеренно, чтобы не
  рисковать стабильностью перед демо. `/backend-demo` существует отдельно именно
  для безопасной демонстрации живых данных.
- Калькуляторы, заказы, оплата, доставка, SEO/CMS-модуль, портфолио/отзывы/блог —
  не реализованы на backend (по плану — следующие этапы).
- JWT access/refresh токены на frontend хранятся в `localStorage` — приемлемо для
  demo, для продакшена нужен BFF или httpOnly-cookie (зафиксировано как TODO в
  `frontend/src/lib/api/auth.ts`).
- `/backend-demo` — техническая страница без `noindex` и вне навигации; перед
  публичным релизом её нужно убрать или защитить.
- `health`-эндпоинт находится под префиксом `/api/v1/health`, а не `/health` —
  при настройке внешних healthcheck/мониторинга это нужно учитывать.
