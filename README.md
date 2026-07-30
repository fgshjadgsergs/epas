# Photo Print — Backend

Backend для сайта типографии. Реализован **Этап 1** (инфраструктура, авторизация/роли, файловое хранилище S3/MinIO)
и задел под **Этап 2** (каталог: категории и услуги печати).

## Стек

Node.js, TypeScript, NestJS, PostgreSQL + Prisma, Redis, MinIO/S3, Swagger.

## Структура модулей

```
AppModule
├── ConfigModule        — конфигурация из .env (src/config)
├── DatabaseModule       — PrismaService (глобальный)
├── HealthModule         — GET /health
├── RolesModule          — RBAC: Role/Permission/UserRole/RolePermission
├── AuthModule           — регистрация/логин/refresh/logout, JWT, guards
├── UsersModule          — профиль текущего пользователя
├── StorageModule        — клиент S3/MinIO
├── FilesModule          — загрузка/получение/удаление файлов
└── CatalogModule
    ├── CategoriesModule — категории (публичные + admin)
    └── ServicesModule   — услуги печати (публичные + admin)
```

RBAC реализован как полноценная модель в БД (`Role`, `Permission`, `UserRole`, `RolePermission`),
но на этом этапе guard'ы проверяют только роли пользователя (`RolesGuard`), а таблица `Permission`
заполняется сидом и подготовлена для будущего `PermissionsGuard`.

## Запуск локально

1. Скопировать `.env.example` в `.env` и при необходимости поправить значения.
2. Поднять инфраструктуру (PostgreSQL, Redis, MinIO):

   ```bash
   docker compose up -d postgres redis minio
   ```

3. Установить зависимости и сгенерировать Prisma Client:

   ```bash
   npm install
   npx prisma generate
   ```

4. Применить миграции и засеять базовые роли/категории/услуги:

   ```bash
   npx prisma migrate dev
   npm run seed
   ```

5. Запустить backend в режиме разработки:

   ```bash
   npm run start:dev
   ```

Приложение поднимется на `http://localhost:3000/api/v1`, Swagger — на `http://localhost:3000/api/v1/docs`.

### Запуск всего стека в Docker

```bash
docker compose up -d
```

Backend дождётся готовности Postgres/Redis/MinIO благодаря healthcheck-зависимостям. Миграции и сид нужно
выполнить отдельно (например, `docker compose exec backend npx prisma migrate deploy`).

## Тестовый администратор

После `npm run seed` создаётся пользователь:

- email: `admin@photo-print.local`
- пароль: `ChangeMe123!`
- роль: `SUPER_ADMIN`

**Сменить пароль перед использованием за пределами локальной разработки.**

## Основные эндпоинты

```
GET    /api/v1/health
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/users/me

POST   /api/v1/files/upload
GET    /api/v1/files/:id
GET    /api/v1/files/:id/presigned-url
DELETE /api/v1/files/:id

GET    /api/v1/categories
GET    /api/v1/categories/:slug
GET    /api/v1/categories/:slug/services

GET    /api/v1/services
GET    /api/v1/services/:slug

# admin (требуют JWT + роль ADMIN/SUPER_ADMIN/MANAGER/CONTENT_MANAGER)
POST   /api/v1/admin/categories
PATCH  /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id
POST   /api/v1/admin/services
PATCH  /api/v1/admin/services/:id
DELETE /api/v1/admin/services/:id
```

## Что сознательно не реализовано на этом этапе

Калькулятор цен, заказы, оплата, доставка, фотокниги, SEO-модуль, sitemap/robots, сложная CMS,
импорт структуры из XLSX, промокоды — согласно `backend_requirements_ru_v6.md`, это задачи следующих этапов.
Архитектура (отдельные `UploadedFile.entityType/entityId`, таблица `Permission`, модульная структура каталога)
сделана так, чтобы не блокировать их добавление позже.
