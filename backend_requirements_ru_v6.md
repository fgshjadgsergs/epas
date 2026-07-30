# Backend-требования к сайту типографии

Версия 2. Добавлены общие технические требования из ТЗ.

---

# 1. Роль backend-разработчика

Backend отвечает за:

- структуру данных сайта;
- API для frontend;
- калькуляторы стоимости;
- заказы;
- загрузку файлов;
- оплату;
- доставку;
- личный кабинет;
- B2B-заявки;
- SEO-данные;
- sitemap.xml;
- robots.txt;
- Schema.org;
- интеграции;
- админскую часть;
- безопасность;
- логи и мониторинг.

Frontend отвечает за внешний вид, адаптивность, анимации, формы и пользовательские сценарии.

---

# 2. Рекомендуемый стек под проект

С учётом твоего опыта и того, что проект лучше делать современно:

```text
Node.js
TypeScript
NestJS
PostgreSQL
Prisma ORM
Redis
Docker
Nginx
S3 / MinIO
Swagger / OpenAPI
JWT + refresh tokens или cookie-session
```

Дополнительно по мере необходимости:

```text
BullMQ + Redis — фоновые задачи
YooKassa — онлайн-оплата
CDEK API — доставка
Почта России API — доставка
DaData — проверка ИНН и реквизитов
SendPulse / SMTP — e-mail
SMS.ru — SMS
Яндекс.Метрика — аналитика событий
Диадок / СБИС — ЭДО для B2B
Sentry — ошибки
UptimeRobot — доступность
```

---

# 3. Главная архитектурная связка

Основа проекта:

```text
Категория
  → Услуга
    → Параметры услуги
      → Калькулятор
        → Заказ
          → Файл
          → Оплата
          → Доставка
```

И отдельно:

```text
SEO-страница
FAQ
Отзывы
Портфолио
Блог
Sitemap
Schema.org
```

---

# 4. Основные сущности БД

## 4.1 Пользователи и роли

```text
User
Role
RefreshToken
CustomerProfile
CorporateProfile
```

Нужно для:

- личного кабинета;
- истории заказов;
- повторного заказа;
- корпоративных клиентов;
- админки.

---

## 4.2 Категории и услуги

```text
Category
Service
ServiceImage
ServiceGallery
RelatedService
ServicePreset
```

Категория:

```text
id
slug
title
description
parentId
isActive
sortOrder
seoPageId
```

Услуга:

```text
id
categoryId
slug
title
shortDescription
description
priceFrom
productionTimeFrom
isActive
sortOrder
seoPageId
```

---

## 4.3 Параметры калькулятора

```text
ServiceParameter
ServiceParameterOption
PricingRule
PricingFormula
CalculatorPreset
```

Пример:

```text
Услуга: Визитки

Параметры:
- размер
- бумага
- цветность
- ламинация
- тираж
- срочность
```

Backend должен:

- отдавать список параметров для услуги;
- принимать выбранные параметры;
- считать итоговую цену;
- считать цену за единицу;
- считать дату готовности;
- учитывать НДС;
- учитывать скидки;
- учитывать срочность;
- учитывать нерабочие дни;
- учитывать выбранную доставку.

---

## 4.4 Заказы

```text
Order
OrderItem
OrderStatusHistory
OrderFile
OrderPayment
OrderDelivery
```

Заказ хранит:

```text
клиент
тип клиента: физлицо / юрлицо
услуга
параметры
стоимость
НДС
скидка
срок готовности
файлы
оплата
доставка
статус
комментарий
```

---

## 4.5 Файлы

```text
UploadedFile
FileValidationResult
FileStorageProvider
```

Файлы:

- макеты клиентов;
- ТЗ;
- фотографии для фотокниг;
- шаблоны;
- портфолио;
- SEO-изображения.

Файлы не хранить в PostgreSQL. В базе хранить только:

```text
id
originalName
mimeType
size
storageKey
url
ownerId
orderId
status
createdAt
```

Хранилище:

```text
S3 / MinIO
```

---

## 4.6 SEO и контент

```text
SeoPage
FaqItem
StaticBlock
BlogArticle
Review
PortfolioItem
SitemapEntry
RedirectRule
RobotsRule
```

Нужно хранить:

- H1;
- Title;
- Meta Description;
- canonical;
- robots meta;
- SEO-текст;
- FAQ;
- Schema.org;
- Open Graph;
- Twitter Cards;
- изображения;
- sitemap-приоритет;
- sitemap-changefreq;
- sitemap-lastmod.

---

## 4.7 B2B

```text
CorporateClient
CommercialRequest
DiscountTier
CompanyContact
Invoice
```

Нужно для:

- формы КП;
- юрлиц;
- НДС;
- отсрочки платежа;
- скидок по обороту;
- персонального менеджера;
- ЭДО.

---

## 4.8 Фотокниги

```text
PhotobookProject
PhotobookPage
PhotobookPhoto
PhotobookTemplate
PhotobookLayout
```

Это отдельный крупный модуль.

Минимум:

- создать проект;
- загрузить фото;
- выбрать шаблон;
- сохранить страницы;
- пересчитать стоимость;
- оформить заказ.

---

# 5. API первого уровня

## Категории

```http
GET /api/categories
GET /api/categories/:slug
GET /api/categories/:slug/services
```

## Услуги

```http
GET /api/services
GET /api/services/:slug
GET /api/services/:slug/parameters
GET /api/services/:slug/related
```

## Калькулятор

```http
POST /api/calculator/calculate
```

Пример запроса:

```json
{
  "serviceSlug": "vizitki",
  "customerType": "individual",
  "parameters": {
    "size": "90x50",
    "paper": "coated",
    "lamination": "matte",
    "quantity": 500
  }
}
```

Пример ответа:

```json
{
  "totalPrice": 3790,
  "unitPrice": 7.58,
  "currency": "RUB",
  "vatIncluded": false,
  "readyDate": "2026-07-01",
  "productionDays": 2
}
```

## Заказы

```http
POST /api/orders
GET /api/orders/:id
GET /api/users/me/orders
PATCH /api/orders/:id/status
```

## Файлы

```http
POST /api/files/upload
GET /api/files/:id
DELETE /api/files/:id
```

## SEO / FAQ / контент

```http
GET /api/pages/:slug/seo
GET /api/pages/:slug/faq
GET /api/pages/:slug/content-blocks
```

## B2B

```http
POST /api/b2b/commercial-request
GET /api/b2b/discount-tiers
```

## Фотокниги

```http
POST /api/photobooks/projects
GET /api/photobooks/projects/:id
PATCH /api/photobooks/projects/:id
POST /api/photobooks/projects/:id/photos
POST /api/photobooks/projects/:id/calculate
POST /api/photobooks/projects/:id/order
```

---

# 6. NestJS-модули

```text
AuthModule
UsersModule
CategoriesModule
ServicesModule
CalculatorModule
OrdersModule
FilesModule
SeoModule
FaqModule
ReviewsModule
PortfolioModule
BlogModule
B2BModule
PhotobooksModule
SitemapModule
RobotsModule
RedirectsModule
AnalyticsModule
AdminModule
```

---

# 7. Общие технические требования из ТЗ

## 7.1 Производительность

Цель:

```text
Google PageSpeed Insights: 90+ для mobile и desktop
```

Core Web Vitals:

```text
DOM elements: не более 2000
TTFB: меньше 200 ms
FCP: меньше 1.8 s
LCP: меньше 2.5 s
CLS: меньше 0.1
INP/FID: меньше 100 ms
```

Что касается backend:

- быстрый TTFB;
- кеширование частых запросов;
- оптимизация SQL-запросов;
- пагинация там, где нужны большие списки;
- CDN для статических файлов;
- отдача корректных cache headers;
- минимизация тяжёлых вычислений в request-response цикле.

---

## 7.2 Изображения

Backend должен поддерживать:

- хранение оригиналов;
- генерацию webp/avif;
- генерацию разных размеров;
- хранение width/height для предотвращения CLS;
- выдачу URL для `srcset`;
- lazy-loading на стороне frontend;
- CDN или S3-хранилище.

---

## 7.3 Кеширование

Нужно предусмотреть:

- серверное кеширование;
- Redis для частых данных;
- HTTP cache headers;
- CDN cache;
- сброс кеша при изменении контента в админке.

Кешировать можно:

- категории;
- услуги;
- SEO-данные;
- FAQ;
- отзывы;
- портфолио;
- sitemap;
- популярные расчёты калькулятора.

---

## 7.4 Canonical

Для каждой индексируемой страницы должен быть canonical.

Backend должен хранить или генерировать:

```html
<link rel="canonical" href="https://site.ru/page-url/">
```

Правила:

- категории и сортировки — canonical на основную страницу категории;
- пагинация — canonical на первую страницу без параметров;
- фильтры — canonical на фильтрованную страницу только если она должна индексироваться;
- карточка услуги — canonical на текущую страницу;
- UTM и служебные параметры в canonical не включаются.

---

## 7.5 Last-Modified / If-Modified-Since

Backend должен уметь отдавать:

```http
Last-Modified: <date>
```

И обрабатывать:

```http
If-Modified-Since
```

Если данные не изменились — возвращать:

```http
304 Not Modified
```

Особенно для:

- страниц;
- sitemap;
- статического контента;
- статей;
- категорий;
- услуг.

---

## 7.6 Редиректы

Нужно поддерживать 301-редиректы.

Обязательные правила:

```text
HTTP → HTTPS
www → без www
дубли с расширениями → нормальный URL
дубли по регистру → нижний регистр
дубли с index.html → нормальный URL
страницы с дочерними страницами → URL заканчивается на /
страницы без дочерних страниц → без / на конце
```

Примеры:

```text
http://site.ru/* → https://site.ru/*
https://www.site.ru/* → https://site.ru/*
/vizitki.html → /vizitki
/vizitki/index.html → /vizitki/
/VIZITKI → /vizitki
```

Backend/Admin должен иметь таблицу ручных редиректов:

```text
RedirectRule
fromUrl
toUrl
statusCode
isActive
```

---

## 7.7 404

Все несуществующие страницы должны отдавать:

```http
404
```

404-страница должна быть кастомной, с навигацией и поиском.

Важно:

```text
404-страница не должна индексироваться.
```

---

## 7.8 URL-адреса

Правила URL:

- только строчные буквы;
- слова через дефис;
- транслитерация кириллицы в латиницу;
- без расширений файлов;
- без лишних уровней вложенности;
- GET-параметры не используются для индексируемых URL.

Примеры:

```text
/vizitki
/listovki
/fotoknigi
/operativnaya-poligrafiya/
```

---

## 7.9 Sitemap.xml

Backend должен генерировать sitemap.

Требования:

- каскадные sitemap-файлы;
- каждый sitemap до 5 MB;
- gzip-сжатие;
- index sitemap со ссылками на архивы;
- XML-схема sitemap.org;
- обновление раз в 2–4 дня или при изменении контента.

В sitemap включать:

- категории;
- подкатегории;
- страницы услуг;
- страницы фильтров только если они реальные и индексируемые;
- статьи блога.

Не включать:

- `/admin`;
- `/api`;
- `/checkout`;
- `/cart`;
- `/account`;
- `/search`;
- страницы с `noindex`;
- страницы пагинации и сортировки.

---

## 7.10 Robots.txt

Нужно иметь возможность редактировать robots.txt из админки или загружать файл.

Базовые правила:

```text
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /cart/
Disallow: /account/
Disallow: /search/

Sitemap: https://site.ru/sitemap.xml
```

---

## 7.11 Schema.org

Backend должен отдавать данные для JSON-LD разметки.

Нужны типы:

```text
Organization
WebSite
BreadcrumbList
LocalBusiness
Product
Offer
AggregateRating
ItemList
Article
FAQPage
ContactPage
AboutPage
OpeningHoursSpecification
```

Разметку можно генерировать на frontend, но данные должен отдавать backend.

---

## 7.12 Open Graph и Twitter Cards

Для каждой страницы нужны:

```html
<meta property="og:title">
<meta property="og:type">
<meta property="og:url">
<meta property="og:image">
<meta property="og:description">
<meta property="og:locale" content="ru_RU">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title">
<meta name="twitter:description">
<meta name="twitter:image">
```

Backend хранит:

```text
ogTitle
ogDescription
ogImage
twitterTitle
twitterDescription
twitterImage
```

---

## 7.13 HTML-карта сайта

Нужно генерировать HTML-карту сайта.

Пример URL:

```text
/html-map-lvl-1
/html-map-lvl-2
/html-map-lvl-3
```

Требования:

- ссылки строятся из актуальной структуры сайта;
- не показывать пустые листинги;
- отображать только реальные страницы;
- обновлять автоматически при изменении структуры.

---

## 7.14 Meta-теги страниц

На каждой странице:

```html
<title>{title} — КИДС-ПРИНТ</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical_url}">
<meta name="robots" content="index, follow">
```

Ограничения:

```text
title: 50–60 символов
description: 120–155 символов
```

Title и description должны управляться через CMS.

---

## 7.15 Поддерживаемые браузеры и протокол

Требования:

```text
Chrome, Firefox, Safari, Edge — последние 2 версии
iOS Safari 15+
Chrome Android
HTTPS обязателен
HTTP → 301 redirect
```

Хостинг:

```text
Yandex Cloud / VK Cloud / Selectel / другой облачный VPS
```

CDN обязателен для статики и изображений.

---

## 7.16 Безопасность

Обязательно:

- HTTPS;
- HSTS;
- CSP;
- X-Frame-Options;
- SAMEORIGIN;
- X-Content-Type-Options;
- nosniff;
- CSRF-защита на формах;
- rate limiting не более 5 отправок формы в минуту с одного IP;
- валидация данных на сервере;
- пароли хранить только в hash;
- загруженные файлы хранить не в папке backend;
- доступ к файлам через signed/presigned URL;
- проверка MIME-type;
- не расширять и не исполнять загруженные файлы;
- логи без персональных данных.

---

## 7.17 Интеграции

Вероятные интеграции:

| Сервис | Назначение |
|---|---|
| YooKassa | онлайн-оплата картой и СБП |
| CDEK API v2 | расчёт стоимости доставки, накладные, трекинг |
| Почта России API | расчёт тарифов |
| Яндекс.Карты | страница контактов / отзывы |
| SendPulse / SMTP | транзакционные e-mail |
| SMS.ru | SMS-уведомления |
| Диадок / СБИС | ЭДО для B2B |
| DaData | проверка ИНН и реквизитов |
| Яндекс.Метрика | цели и e-commerce события |

---

## 7.18 Аналитика Яндекс.Метрики

Backend должен помогать frontend передавать события:

```text
calc_open
calc_param_change
calc_to_checkout
add_to_cart
begin_checkout
purchase
b2b_form_submit
phone_click
whatsapp_click
```

Для события `purchase` нужно передавать состав заказа:

```text
товар
цена
количество
итоговая сумма
```

---

## 7.19 CMS / админка

Через CMS должны редактироваться:

| Что | Редактируется |
|---|---|
| Прайс-листы и параметры услуг | Да, обязательно |
| SEO-поля title, description, H1 | Да |
| Тексты страниц | Да |
| FAQ | Да |
| Блог и статьи | Да |
| Галерея / портфолио | Да |
| Отзывы | Да |
| Промо-блоки и акции | Да |
| Промокоды | Да |
| Нерабочие дни для расчёта дат | Да |
| Robots.txt | Да |
| Настройки доставки | Да |

---

## 7.20 Инфраструктура

Требования:

```text
Резервное копирование БД каждые 6 часов
Хранение бэкапов 30 дней
Uptime SLA: 99.9%
Мониторинг ошибок: Sentry
Мониторинг доступности: UptimeRobot
Алерт при недоступности больше 1 минуты: Telegram бизнесу
Логи в JSON
Хранение логов 30 дней
Без персональных данных в логах
```

---

## 7.21 Доступность

Цель:

```text
WCAG 2.1 AA
```

Backend-часть:

- отдавать alt-тексты для изображений;
- помогать с aria-данными там, где они зависят от контента;
- возвращать понятные ошибки валидации форм;
- поддерживать inline-ошибки;
- для динамических элементов калькулятора отдавать данные, которые frontend сможет озвучить через aria-live.

---

# 8. MVP backend

Первая версия без лишней сложности:

```text
1. Категории
2. Услуги
3. Параметры услуг
4. Калькулятор
5. Создание заказа
6. Загрузка файла
7. SEO/FAQ
8. Sitemap.xml
9. Robots.txt
10. Schema.org данные
11. Простая админка
```

Во второй этап можно вынести:

```text
1. Фотокнижный конструктор
2. Полноценную оплату
3. Интеграцию CDEK
4. Интеграцию ЭДО
5. Автоматический импорт отзывов
6. Сложные промокоды
7. Полноценную CRM
```

---

# 9. Что делать первым

## Шаг 1. Разобрать структуру сайта

Из файла `структура.txt` нужно получить:

```text
PageType
Page
Category
Service
```

Понять:

- какие страницы существуют;
- какие индексируются;
- какие не индексируются;
- какие URL должны попадать в sitemap;
- какие страницы имеют canonical;
- какие страницы являются техническими.

---

## Шаг 2. Нарисовать ERD

До кода нарисовать связи:

```text
Category → Service → Parameter → Option → PricingRule
Service → SeoPage
Service → FAQ
Service → Portfolio
Service → Reviews
Order → OrderItem → UploadedFile
```

---

## Шаг 3. Написать Prisma schema

Первая schema должна покрывать:

```text
Category
Service
ServiceParameter
ServiceParameterOption
PricingRule
Order
OrderItem
UploadedFile
SeoPage
FaqItem
RedirectRule
SitemapEntry
RobotsRule
```

---

## Шаг 4. Поднять NestJS

Сразу создать модули:

```text
CategoriesModule
ServicesModule
CalculatorModule
OrdersModule
FilesModule
SeoModule
SitemapModule
RobotsModule
AdminModule
```

---

## Шаг 5. Сделать калькулятор

Сначала простой:

```text
basePrice + modifiers + quantityMultiplier
```

Потом добавить:

```text
скидки
НДС
срочность
нерабочие дни
доставку
готовые конфигурации
промокоды
```

---

# 10. Главные риски

1. Захардкодить цены в коде.
2. Сделать калькулятор под одну услугу, а не универсальным.
3. Не дать менеджеру менять параметры и цены.
4. Не заложить SEO-структуру с самого начала.
5. Не сделать sitemap/robots управляемыми.
6. Не продумать 301-редиректы.
7. Не продумать загрузку файлов.
8. Начать с конструктора фотокниг слишком рано.
9. Не разделить физлиц и юрлиц.
10. Не учесть нерабочие дни при расчёте сроков.


---

# 11. Требования фронта, которые backend обязан учитывать

Хотя это ТЗ формально для frontend-разработчика, backend должен заранее отдавать данные так, чтобы frontend мог выполнить требования по SEO, доступности, навигации и производительности.

---

## 11.1 Навигация сайта

Frontend должен реализовать:

- хедер с тремя слоями:
  - утилитарная полоска;
  - главная шапка;
  - навбар;
- мегаменю;
- футер с 5 колонками;
- мобильное меню;
- мобильный оверлей;
- аккордеоны;
- sticky-header.

Backend для этого должен отдавать структуру навигации.

### Нужные сущности

```text
NavigationMenu
NavigationGroup
NavigationItem
FooterColumn
FooterLink
```

### Что хранить

```text
label
url
type
parentId
sortOrder
isActive
isExternal
target
rel
ariaLabel
children
```

### API

```http
GET /api/navigation/header
GET /api/navigation/footer
GET /api/navigation/mobile
GET /api/navigation/mega-menu
```

Важно: ссылки должны быть обычными HTML-ссылками на frontend, но backend обязан отдать готовые URL, названия и вложенность.

---

## 11.2 Мегаменю

Мегаменю должно присутствовать в HTML при серверном рендере для SEO.

Backend должен отдавать:

- группы ссылок;
- заголовки групп;
- ссылки на услуги;
- ссылки на категории;
- промо-блок;
- B2B-пункт;
- нижнюю строку меню;
- контакты;
- CTA.

Пример структуры ответа:

```json
{
  "groups": [
    {
      "title": "Визитки",
      "items": [
        {
          "label": "Стандартные визитки",
          "url": "/vizitki"
        }
      ]
    }
  ],
  "promo": {
    "title": "Визитки от 990 ₽",
    "url": "/vizitki"
  }
}
```

---

## 11.3 Footer

Футер содержит несколько колонок:

- о компании;
- услуги;
- клиентам;
- документы / информация;
- контакты.

Backend должен отдавать:

```http
GET /api/navigation/footer
```

Пример данных:

```json
{
  "columns": [
    {
      "title": "Услуги",
      "items": [
        {
          "label": "Фото на документы",
          "url": "/foto-na-dokumenty"
        }
      ]
    }
  ],
  "contacts": {
    "phone": "+7 495 000-00-00",
    "email": "info@site.ru",
    "address": "Москва"
  },
  "socialLinks": []
}
```

---

## 11.4 Поиск в шапке

В хедере есть форма поиска.

Backend должен реализовать поиск по:

- услугам;
- категориям;
- статьям;
- SEO-страницам, если они индексируемые.

API:

```http
GET /api/search?q=визитки
```

Ответ:

```json
{
  "items": [
    {
      "type": "service",
      "title": "Визитки",
      "url": "/vizitki",
      "description": "Печать визиток в Москве"
    }
  ]
}
```

Требования:

- поиск не должен индексироваться;
- `/search/` закрыть в robots.txt;
- результаты поиска не включать в sitemap.

---

## 11.5 ARIA и доступность

Frontend обязан соблюдать WCAG 2.1 AA.

Backend должен помогать данными:

- отдавать `alt` для изображений;
- отдавать `ariaLabel` для ссылок, кнопок и соцсетей, если текст недостаточно понятный;
- отдавать понятные тексты ошибок валидации;
- отдавать labels для полей форм;
- отдавать описания параметров калькулятора;
- отдавать readable-названия значений параметров, а не только технические ключи.

### Для изображений

```text
imageUrl
alt
width
height
```

### Для формы

```text
label
placeholder
helpText
errorMessage
required
```

---

## 11.6 Sticky-header и якорные ссылки

Во frontend-ТЗ есть sticky-header и якорная навигация.

Backend должен отдавать якоря для страниц услуг:

```json
[
  {
    "label": "Калькулятор",
    "anchor": "calculator"
  },
  {
    "label": "Описание",
    "anchor": "description"
  },
  {
    "label": "Примеры работ",
    "anchor": "portfolio"
  },
  {
    "label": "Отзывы",
    "anchor": "reviews"
  },
  {
    "label": "FAQ",
    "anchor": "faq"
  }
]
```

API:

```http
GET /api/services/:slug/anchors
```

---

## 11.7 Мобильное меню

Для мобильного меню backend должен отдавать ту же структуру, но в виде, удобном для аккордеона.

```http
GET /api/navigation/mobile
```

Требования:

- вложенность;
- группы;
- порядок;
- B2B-пункт;
- CTA;
- контакты;
- быстрые ссылки.

---

## 11.8 Производительность навигации

Так как хедер и футер есть на каждой странице, backend должен:

- кешировать навигацию;
- не собирать меню тяжёлыми запросами каждый раз;
- сбрасывать кеш при изменении меню в админке;
- отдавать компактный JSON;
- не отдавать лишние поля.

Redis-кеш:

```text
navigation:header
navigation:footer
navigation:mobile
navigation:mega-menu
```

---

## 11.9 SEO-требования навигации

Backend должен помнить:

- ссылки в меню должны быть реальными URL;
- скрытое мегаменю нельзя убирать из HTML полностью;
- все ссылки в меню должны вести на индексируемые страницы, кроме служебных;
- технические страницы не должны попадать в мегаменю;
- каждая ссылка должна иметь человекочитаемый anchor text;
- заголовки групп в мегаменю должны быть семантически понятными.

---

## 11.10 Что добавить в БД из-за фронтового ТЗ

Добавить сущности:

```text
NavigationMenu
NavigationGroup
NavigationItem
FooterColumn
FooterLink
SiteContact
SocialLink
```

Пример моделей:

```text
NavigationMenu
id
code
title
isActive

NavigationGroup
id
menuId
title
description
sortOrder
isActive

NavigationItem
id
menuId
groupId
parentId
label
url
entityType
entityId
ariaLabel
isExternal
target
rel
sortOrder
isActive
```

---

# 12. Обновлённый порядок разработки с учётом frontend-ТЗ

Теперь порядок лучше такой:

```text
1. Разобрать структуру сайта
2. Выписать все типы страниц
3. Спроектировать Category / Service
4. Спроектировать SEO-слой
5. Спроектировать Navigation / Footer / Menu
6. Спроектировать калькулятор
7. Спроектировать заказы
8. Спроектировать файлы
9. Написать Prisma schema
10. Поднять NestJS
11. Сделать API категорий и услуг
12. Сделать API навигации
13. Сделать SEO API
14. Сделать CalculatorModule
15. Сделать OrdersModule
16. Сделать FilesModule
17. Сделать Admin API
18. Потом фотокниги
```

---

# 13. Что backend должен согласовать с frontend до старта

Перед кодом нужно договориться:

1. Формат URL.
2. Формат slug.
3. Формат ответа для меню.
4. Формат ответа для карточки услуги.
5. Формат ответа калькулятора.
6. Формат ошибок валидации.
7. Формат SEO-данных.
8. Формат BreadcrumbList.
9. Формат FAQPage.
10. Какие поля нужны для изображений.
11. Какие данные frontend ждёт для mobile-menu.
12. Какие блоки страниц будут управляться через CMS.
13. Какие блоки будут статичными в коде frontend.
14. Кто отвечает за генерацию JSON-LD — frontend или backend.
15. Как frontend получает sitemap/robots/canonical/meta.


# Дополнение к backend_requirements_ru_v3

## 14. Архитектурные выводы после изучения всех макетов страниц

После изучения макетов (Главная, Категория, Услуга, Фотокниги, B2B) можно сделать несколько важных выводов, которые должны повлиять на архитектуру backend.

---

## 14.1 Проект должен строиться вокруг доменной модели

Главное ядро проекта:

```
Категория
    ↓
Услуга
    ↓
Калькулятор
    ↓
Заказ
    ↓
Файл
    ↓
Оплата
    ↓
Доставка
```

Страницы являются лишь представлением этих данных.

---

## 14.2 Типов страниц немного

Всего пять основных шаблонов:

- Главная
- Категория
- Услуга
- Фотокниги
- B2B

Это означает, что backend должен отдавать универсальные данные, а frontend отображать их нужным шаблоном.

---

## 14.3 Практически весь контент переиспользуется

Повторяются одинаковые сущности:

- FAQ
- Отзывы
- Портфолио
- CTA
- SEO
- Хлебные крошки
- Галереи
- Блоки преимуществ

Поэтому каждая сущность должна иметь возможность привязки к разным типам страниц.

Пример:

```
FaqItem
entityType
entityId
sortOrder
```

где entityType может быть:

- homepage
- category
- service
- photobook
- b2b

---

## 14.4 Универсальная CMS

Через админку должны редактироваться:

- FAQ
- CTA
- Преимущества
- SEO
- Галереи
- Статьи
- Отзывы
- Популярные конфигурации
- Баннеры
- Контакты
- Рабочие дни
- Стоимость доставки

Ничего из этого не должно быть захардкожено.

---

## 14.5 Универсальный Page Builder

Для каждой страницы backend должен отдавать не только данные, но и список блоков.

Пример:

```json
{
  "pageType": "service",
  "blocks": [
    "hero",
    "calculator",
    "portfolio",
    "reviews",
    "faq",
    "seoText",
    "cta"
  ]
}
```

Это позволит менять состав страниц без изменения кода.

---

## 14.6 Новые сущности

Добавить в модель данных:

```
Advantage
CTA
Banner
PageBlock
PageBlockRelation
PopularConfiguration
WorkingCalendar
Holiday
DeliveryMethod
PaymentMethod
PromoCode
```

---

## 14.7 Универсальная привязка контента

Практически любой контент должен иметь возможность привязки к странице.

Например:

```
Review
entityType
entityId

PortfolioItem
entityType
entityId

Article
entityType
entityId
```

---

## 14.8 API страниц

Стоит предусмотреть единый endpoint:

GET /api/pages/:slug

Ответ должен содержать:

- тип страницы;
- SEO;
- хлебные крошки;
- список блоков;
- необходимые данные для каждого блока.

---

## 14.9 Архитектура документации

До начала разработки рекомендуется подготовить:

1. architecture.md
2. database_entities.md
3. prisma_erd.drawio
4. modules.md
5. api_contract.md
6. calculator.md
7. admin_panel.md
8. uploads.md
9. orders.md
10. seo.md
11. photobooks.md

---

## 14.10 Обновлённый порядок разработки

1. Архитектура
2. ER-диаграмма
3. Prisma Schema
4. NestJS Modules
5. API Contract
6. Категории
7. Услуги
8. Навигация
9. SEO
10. Калькулятор
11. Заказы
12. Файлы
13. Админка
14. Интеграции
15. Конструктор фотокниг


---

# 15. Архитектура универсального движка калькуляторов

Этот раздел добавлен на основе файлов:

- `ТЗ на калькуляторы для разработчиков.docx`
- `ТЗ URL-адреса в калькуляторах для разработчиков.docx`

Цель раздела — дать Codex / Claude / разработчику чёткую опору для проектирования backend-части калькуляторов.

---

## 15.1 Главный принцип

Все калькуляторы должны работать через единый backend-движок.

Не нужно писать отдельную бизнес-логику для каждой услуги в frontend.

Правильная архитектура:

```text
Service
  ↓
CalculatorDefinition
  ↓
CalculatorParameter
  ↓
CalculatorOption
  ↓
ValidationRule
  ↓
CompatibilityRule
  ↓
PricingRule
  ↓
ProductionRule
  ↓
CalculationResult
```

Все цены, коэффициенты, ограничения, сроки и совместимости должны храниться на backend / в БД / CMS.

Frontend только:

- показывает параметры;
- отправляет выбранные значения;
- отображает результат;
- обновляет URL;
- отправляет события аналитики.

---

## 15.2 Единый API калькулятора

Все услуги используют один endpoint:

```http
POST /api/v1/calculate
Content-Type: application/json
```

Пример запроса:

```json
{
  "service_id": "business-cards",
  "params": {
    "format": "90x50",
    "paper": "coated-350",
    "coating": "matte-lam",
    "sides": "double",
    "qty": 100
  },
  "b2b": false,
  "promo_code": null
}
```

Пример успешного ответа:

```json
{
  "ok": true,
  "price": 1200,
  "price_per_unit": 12,
  "price_with_vat": 1440,
  "currency": "RUB",
  "ready_date": "2026-06-24",
  "ready_date_label": "вт, 24 июня",
  "cutoff_today": "14:00",
  "express": {
    "available": true,
    "price": 1800,
    "ready_date_label": "сегодня до 18:00"
  },
  "upsells": [
    {
      "id": "rounded-corners",
      "label": "Скруглённые углы",
      "price_delta": 120
    },
    {
      "id": "design",
      "label": "Разработка дизайна",
      "price_delta": 500
    }
  ],
  "warnings": [],
  "errors": []
}
```

Пример ошибки:

```json
{
  "ok": false,
  "errors": [
    {
      "param": "quantity",
      "message": "Минимальный тираж для пластиковых визиток — 100 шт."
    }
  ]
}
```

HTTP-коды:

```text
200 — успешный расчёт
422 — неверные параметры
429 — превышен rate limit
500 — внутренняя ошибка
```

---

## 15.3 Rate limit

Для endpoint калькулятора:

```text
60 запросов в минуту с одного IP
```

Для форм:

```text
не более 5 отправок формы в минуту с одного IP
```

---

## 15.4 Debounce и поведение frontend

Frontend должен вызывать API калькулятора:

```text
через 300 мс после последнего изменения параметра
```

URL калькулятора обновляется отдельно:

```text
через 1000 мс после последнего изменения параметра
```

При ошибке сети frontend показывает последнюю известную цену и делает retry через 5 секунд.

Backend должен возвращать такие ошибки, чтобы frontend мог показать их inline возле конкретного параметра.

---

## 15.5 Расчёт даты готовности

Дата готовности считается только на backend.

Учитывать:

1. Текущее время.
2. Часовой пояс: UTC+3.
3. Время отсечки:
   - стандарт: 14:00;
   - экспресс: 12:00.
4. Рабочие дни.
5. Выходные.
6. Праздники РФ.
7. Нерабочие дни, заданные через CMS.
8. Срок изготовления конкретной услуги.
9. Срочность.
10. Доставку, если она влияет на итоговую дату.

Нужные сущности:

```text
WorkingCalendar
Holiday
NonWorkingDay
ProductionRule
CutoffRule
```

Пример ответа:

```json
{
  "ready_date": "2026-06-24",
  "ready_date_label": "вт, 24 июня",
  "cutoff_today": "14:00"
}
```

---

## 15.6 B2B-режим

Во всех калькуляторах есть переключатель:

```text
Физлицо / Юридическое лицо
```

При выборе юрлица:

```text
price_with_vat = price * 1.20
```

Отображение:

```text
X ₽ с НДС
```

Важно:

- режим B2B не включается в URL;
- режим B2B может влиять на оплату;
- режим B2B может влиять на доступные способы оплаты;
- режим B2B может учитывать скидки корпоративного клиента.

---

## 15.7 Недоступные комбинации параметров

Backend должен возвращать информацию о недоступных вариантах.

Пример:

```text
plastic + coated-350 = недоступно
foil + holographic = доступно, но +20%
express + quantity > 1000 = недоступно
```

Нужные сущности:

```text
CompatibilityRule
AvailabilityRule
ValidationRule
```

Пример ответа:

```json
{
  "param": "paper",
  "option": "coated-350",
  "available": false,
  "reason": "Недоступно для пластиковых визиток"
}
```

---

## 15.8 Upsell-опции

Upsell должен быть отдельной сущностью, а не захардкоженным массивом.

```text
UpsellOption
id
serviceId
code
label
priceType
priceValue
isActive
sortOrder
conditions
```

Типы цены:

```text
fixed
percent
per_unit
per_square_meter
```

Примеры upsell:

```text
rounded-corners — Скруглённые углы
plastic-case — Кейс для визиток
design — Разработка дизайна
hole — Отверстие под люверс
gift-box — Подарочная коробка
```

---

## 15.9 Pricing Engine

Pricing Engine должен уметь:

1. Получить услугу по `service_id`.
2. Получить определение калькулятора.
3. Получить параметры и выбранные значения.
4. Применить значения по умолчанию.
5. Проверить обязательные параметры.
6. Проверить диапазоны.
7. Проверить совместимость.
8. Проверить ограничения срочности.
9. Рассчитать базовую цену.
10. Применить коэффициенты.
11. Применить скидки по тиражу.
12. Применить upsell.
13. Применить промокод, если он есть.
14. Рассчитать НДС для B2B.
15. Рассчитать дату готовности.
16. Вернуть единый DTO результата.

---

## 15.10 Validation Engine

Validation Engine проверяет:

- обязательные параметры;
- минимальные значения;
- максимальные значения;
- шаг значений;
- диапазон размеров;
- минимальный тираж;
- максимальный тираж;
- ограничения для express;
- совместимость параметров;
- допустимость промокода;
- формат пользовательских размеров.

Пример:

```text
custom width: 30–100 мм
custom height: 30–100 мм
quantity: min 50, step 50
plastic quantity: min 100, step 100
```

---

## 15.11 Compatibility Engine

Compatibility Engine отвечает за совместимость параметров.

Пример для визиток:

```text
standard + matte-lam = доступно
lacquer + matte-lam = недоступно
foil + holographic = доступно
plastic + design paper = недоступно
```

Нужная модель:

```text
CompatibilityRule
id
serviceId
sourceParamCode
sourceOptionCode
targetParamCode
targetOptionCode
isAvailable
reason
priceModifierType
priceModifierValue
```

---

## 15.12 PricingRule

Правила цены должны быть в БД.

Возможные типы правил:

```text
base_price
unit_price
quantity_discount
coefficient
percent_markup
fixed_markup
per_unit_markup
per_square_meter
area_formula
threshold_price
```

Пример:

```text
base = price_per_unit(format, paper, subtype) × quantity
total = base × sides_coeff × cover_coeff × express_coeff + upsells_sum
```

Пример для баннера:

```text
area = width × height
price = area × price_per_sqm(material)
lug_count = ceil((width * 2 + height * 2) / 0.5)
lugs_price = lug_count × 15
hem_price = perimeter × hem_rate
total = (price + lugs_price + hem_price) × quantity × express_coeff
```

---

## 15.13 Типы калькуляторов

Нужно поддержать несколько типов калькуляторов:

```text
standard_options
area_based
threshold_based
multi_format
fixed_selector
constructor_based
```

### standard_options

Обычный калькулятор с параметрами:

```text
формат
бумага
покрытие
тираж
срочность
```

Примеры:

- визитки;
- листовки;
- буклеты;
- открытки.

### area_based

Цена считается по площади.

Примеры:

- баннеры;
- press wall;
- интерьерная печать;
- постеры;
- холст.

### threshold_based

Цена зависит от порогов количества.

Примеры:

- печать документов;
- ламинирование.

### multi_format

В одном заказе несколько форматов.

Пример:

- фотопечать.

### fixed_selector

Селектор фиксированной услуги из БД.

Пример:

- фото на документы.

### constructor_based

Калькулятор связан с проектом конструктора.

Пример:

- фотокниги.

---

## 15.14 Группы услуг из ТЗ калькуляторов

Backend должен поддержать калькуляторы для следующих групп.

### Группа 1 — Оперативная полиграфия

```text
business-cards
leaflets
booklets
postcards
certificates
badges-blanks
menu
```

### Группа 2 — Документы и офисная печать

```text
document-print
document-copy
binding-staple
hard-cover-binding
lamination
```

### Группа 3 — Фотопечать и фотокниги

```text
photo-print
photobook
id-photo
canvas-print
poster-print
foam-board
```

### Группа 4 — Широкоформатная печать

```text
banner-print
rollup
presswall
interior-print
```

### Группа 5 — Наклейки и этикетки

```text
stickers
labels
```

### Группа 6 — Календари

```text
calendar-wall
calendar-desk
calendar-pocket
```

### Группа 7 — Печати и штампы

```text
stamp-auto
stamp-pocket
facsimile
```

### Группа 8 — Сувениры и текстиль

```text
tshirt-print
mug-print
shopper-print
```

---

## 15.15 URL калькулятора

При изменении параметров калькулятора URL страницы должен обновляться.

Пример:

```text
/vizitki/
/vizitki/?format=90x50&qty=100
/vizitki/?format=90x50&qty=100&paper=coated-350
/vizitki/?format=90x50&qty=100&paper=coated-350&lam=matte&sides=double
```

Назначение:

- пользователь может поделиться готовым расчётом;
- менеджер может отправить клиенту ссылку;
- frontend может восстановить состояние калькулятора из URL;
- Яндекс.Метрика может фиксировать смены URL как виртуальные просмотры.

---

## 15.16 Правила URL параметров

Правила:

- параметры передаются через GET-параметры;
- параметры в нижнем регистре;
- слова разделяются дефисом;
- имена параметров совпадают с кодами параметров в калькуляторе;
- порядок параметров фиксированный;
- значения по умолчанию в URL не включаются;
- промокод в URL не включается;
- B2B/B2C режим в URL не включается;
- upsell-чекбоксы в URL не включаются.

Фиксированный порядок:

```text
subtype
format
paper
coating
sides
qty
express
upsells
```

Примеры:

```text
/vizitki/?format=90x50&paper=coated-350&lam=matte&sides=double&qty=100
/listovki/?format=A5&paper=coated-150&color=4%2B4&qty=500
/bannery/?w=2&h=1&material=banner-440&lugs=with&qty=1
/fotoknigi/?type=layflat&format=30x20&pages=40&qty=1
/pechat-dokumentov/?format=A4&color=bw&sides=double&qty=50
/shtampy/?model=trodat-4912&ink=blue&qty=1
/futbolki/?color=white&size=M&method=dtg&zone=front&qty=5
```

---

## 15.17 Backend и URL калькулятора

Backend должен уметь:

- принять query-параметры;
- провалидировать их;
- восстановить состояние калькулятора;
- отдать frontend дефолтные параметры;
- отдать frontend параметры из URL;
- вернуть canonical на базовый URL;
- не включать параметризованные URL в sitemap;
- не индексировать параметризованные URL.

Для SSR-страниц:

```text
/vizitki/?format=90x50&qty=100
```

должна открыться та же страница услуги, но калькулятор должен быть предзаполнен.

---

## 15.18 SEO для URL калькуляторов

Параметризованные URL не индексируются.

На страницах с GET-параметрами калькулятора canonical должен указывать на базовую страницу:

```html
<link rel="canonical" href="https://site.ru/vizitki/">
```

В sitemap добавляется только базовая страница:

```text
/vizitki/
```

Не добавлять:

```text
/vizitki/?format=90x50&qty=100
```

---

## 15.19 Яндекс.Метрика

Frontend отправляет виртуальный просмотр при обновлении URL:

```js
ym(COUNTER_ID, 'hit', window.location.pathname + window.location.search, {
  title: document.title,
  referer: previousUrl
});
```

Также отправляются цели:

```text
calc_param_change
calc_open
calc_to_checkout
add_to_cart
begin_checkout
purchase
```

Backend должен для события `purchase` отдавать данные состава заказа:

```text
service
name
price
quantity
total
currency
```

---

## 15.20 Сохранение расчёта

Опционально:

```http
POST /api/users/me/saved-calculations
```

Сохраняет текущий URL расчёта в личном кабинете.

Нужная сущность:

```text
SavedCalculation
id
userId
serviceId
url
params
priceSnapshot
createdAt
```

---

## 15.21 Новые модели БД для калькуляторов

```text
CalculatorDefinition
CalculatorParameter
CalculatorOption
CalculatorDefaultValue
CalculatorPreset
PricingRule
PricingTier
CompatibilityRule
ValidationRule
ProductionRule
CutoffRule
WorkingCalendar
Holiday
NonWorkingDay
UpsellOption
PromoCode
SavedCalculation
```

---

## 15.22 Рекомендуемые NestJS-модули для калькуляторов

```text
CalculatorModule
PricingEngineModule
ValidationEngineModule
CompatibilityEngineModule
ProductionCalendarModule
PromoCodesModule
SavedCalculationsModule
```

---

## 15.23 Что нельзя делать

Нельзя:

- хранить цены в frontend;
- хардкодить расчёты в React;
- делать отдельный endpoint под каждую услугу;
- включать промокод в URL;
- включать B2B-режим в URL;
- индексировать URL с параметрами калькулятора;
- добавлять URL с параметрами в sitemap;
- писать 30 полностью разных калькуляторов руками.

---

## 15.24 Что можно вынести на второй этап

Можно отложить:

- сохранение расчётов в личном кабинете;
- сложные промокоды;
- автоматический импорт всех прайсов;
- сложный конструктор фотокниг;
- полную интеграцию аналитики;
- все калькуляторы сразу.

Но нельзя откладывать:

- универсальную модель калькулятора;
- единый endpoint;
- хранение цен и правил в БД;
- расчёт даты готовности;
- базовую совместимость параметров;
- canonical для параметризованных URL.


---

# 16. Структура сайта из XLSX как обязательный источник истины

Этот раздел добавлен на основе файла структуры сайта `a6e9a342-d968-49f5-bbfe-d67c00d18640.xlsx`.

Файл структуры обязательно использовать при проектировании backend.  
Он задаёт дерево страниц, URL, типы страниц и хлебные крошки.

---

## 16.1 Главный вывод

Все URL, вложенность и хлебные крошки должны браться не из догадок и не из кода, а из структуры сайта.

Файл структуры содержит колонки:

```text
0
1
2
3
4
5
6
7
Тип
Хлебные крошки
Url-адрес
```

Колонки `0–7` — уровни вложенности страницы.  
Колонка `Тип` — тип страницы.  
Колонка `Хлебные крошки` — готовая иерархия для breadcrumbs.  
Колонка `Url-адрес` — canonical/base URL страницы.

---

## 16.2 Что это меняет в backend-документе

Ранее в примерах URL могли использоваться короткие варианты:

```text
/vizitki/
/listovki/
/fotoknigi/
```

Но после появления файла структуры точным источником URL становится XLSX.

Например, если в структуре указано:

```text
/operativnaya-poligrafiya/vizitki/
```

то именно этот URL считается правильным.

Примеры в разделе калькуляторов остаются демонстрационными, но в реальной реализации backend должен брать `baseUrl` из таблицы страниц.

---

## 16.3 Новая обязательная сущность SitePage

Нужно добавить сущность:

```text
SitePage
```

Она должна хранить все страницы сайта из структуры.

Пример полей:

```text
id
parentId
level
title
slug
path
fullUrl
pageType
templateType
breadcrumbText
isIndexable
isInSitemap
isTechnical
isSystem
sortOrder
status
createdAt
updatedAt
```

---

## 16.4 Типы страниц

На основе файла структуры нужно поддержать минимум такие типы:

```text
Главная
Раздел
Категория
Подкатегория
Служебная
Системная
Техническая
```

В backend лучше хранить enum:

```text
HOME
SECTION
CATEGORY
SUBCATEGORY
SERVICE
BLOG_ARTICLE
ACCOUNT
CHECKOUT
SYSTEM
TECHNICAL
LEGAL
SEARCH
```

Важно: тип из XLSX может быть бизнес-типом, а `templateType` — техническим шаблоном frontend.

Например:

```text
pageType = CATEGORY
templateType = CATEGORY_PAGE
```

или

```text
pageType = CATEGORY
templateType = SERVICE_PAGE_WITH_CALCULATOR
```

---

## 16.5 Связь SitePage с Category и Service

Не каждая страница является услугой.

Например:

```text
/operativnaya-poligrafiya/
```

это раздел/категория верхнего уровня.

А:

```text
/operativnaya-poligrafiya/vizitki/
```

может быть страницей услуги или категории с дочерними подтипами.

Поэтому нужны связи:

```text
SitePage → Category
SitePage → Service
SitePage → SeoPage
```

Возможные поля:

```text
categoryId nullable
serviceId nullable
seoPageId nullable
```

---

## 16.6 Импорт структуры из XLSX

Нужно сделать импортёр структуры.

Пример команды:

```bash
npm run import:structure
```

Что делает импортёр:

1. Читает XLSX.
2. Игнорирует строки-разделители с `--`.
3. Определяет уровень вложенности по последней заполненной колонке из `0–7`.
4. Создаёт или обновляет `SitePage`.
5. Проставляет `parentId`.
6. Сохраняет `title`.
7. Сохраняет `fullUrl`.
8. Сохраняет `breadcrumbText`.
9. Сохраняет `pageType`.
10. Создаёт связи с Category/Service, если возможно.
11. Помечает служебные и технические страницы.
12. Обновляет sitemap-флаги.

---

## 16.7 Правила parentId

Уровень страницы определяется по последней заполненной колонке `0–7`.

Пример:

```text
0: Главная
1: Оперативная полиграфия
2: Визитки
3: Стандартные визитки
```

Тогда дерево:

```text
Главная
  └── Оперативная полиграфия
      └── Визитки
          └── Стандартные визитки
```

---

## 16.8 Хлебные крошки

В файле есть колонка `Хлебные крошки`.

Backend должен уметь отдавать breadcrumbs для каждой страницы.

API:

```http
GET /api/pages/:slug/breadcrumbs
```

Или в составе:

```http
GET /api/pages/:slug
```

Пример ответа:

```json
{
  "breadcrumbs": [
    {
      "label": "Главная",
      "url": "/"
    },
    {
      "label": "Оперативная полиграфия",
      "url": "/operativnaya-poligrafiya/"
    },
    {
      "label": "Визитки",
      "url": "/operativnaya-poligrafiya/vizitki/"
    }
  ]
}
```

---

## 16.9 BreadcrumbList Schema.org

На основе SitePage backend должен отдавать данные для `BreadcrumbList`.

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Главная",
      "item": "https://site.ru/"
    }
  ]
}
```

---

## 16.10 Sitemap.xml из структуры

Sitemap должен строиться из `SitePage`, а не вручную.

В sitemap включать:

```text
Главная
Разделы
Категории
Подкатегории
Страницы услуг
Статьи блога
Юридические страницы, если они должны индексироваться
```

Не включать:

```text
Личный кабинет
Корзина
Оформление заказа
Оплата заказа
Заказ оформлен
Результаты поиска
404
500
robots.txt
sitemap.xml
/api
/admin
```

Для каждой страницы в `SitePage` нужны поля:

```text
isIndexable
isInSitemap
robotsMeta
priority
changefreq
lastmod
```

---

## 16.11 Robots и noindex

Страницы из структуры должны автоматически получать флаги.

Пример:

```text
/lichnyy-kabinet/             noindex
/korzina/                     noindex
/oformlenie-zakaza/           noindex
/rezultaty-poiska/            noindex
/stranica-404/                noindex
/stranica-500/                noindex
```

Индексируемые:

```text
главная
разделы
категории
подкатегории
услуги
портфолио
блог
статьи
контакты
о компании
оплата
доставка
юридические страницы — по решению SEO
```

---

## 16.12 Canonical

Canonical для страницы должен строиться из `SitePage.fullUrl`.

Пример:

```html
<link rel="canonical" href="https://site.ru/operativnaya-poligrafiya/vizitki/">
```

Для URL калькулятора с query-параметрами canonical остаётся на базовую страницу:

```text
/operativnaya-poligrafiya/vizitki/?format=90x50&qty=100
```

canonical:

```text
https://site.ru/operativnaya-poligrafiya/vizitki/
```

---

## 16.13 Структура и калькуляторы

Калькулятор должен быть привязан не только к `Service`, но и к `SitePage`.

Почему:

- одна и та же услуга может иметь несколько посадочных страниц;
- подтипы визиток могут иметь предвыбранные параметры;
- URL подкатегории может открывать тот же калькулятор, но с `subtype` по умолчанию.

Пример:

```text
/operativnaya-poligrafiya/vizitki/
  service_id = business-cards

/operativnaya-poligrafiya/vizitki/standartnye-vizitki/
  service_id = business-cards
  defaultParams.subtype = standard

/operativnaya-poligrafiya/vizitki/vizitki-s-lakirovkoy/
  service_id = business-cards
  defaultParams.subtype = lacquer
```

Нужная сущность:

```text
PageCalculatorBinding
id
pageId
serviceId
calculatorDefinitionId
defaultParams
isActive
```

---

## 16.14 Структура и навигация

Навигация, мегаменю, футер и HTML-карта сайта должны строиться из `SitePage`.

Но не все страницы из структуры должны попадать в меню.

Нужны поля:

```text
showInHeader
showInMegaMenu
showInFooter
showInMobileMenu
showInHtmlMap
navigationLabel
navigationGroup
sortOrder
```

---

## 16.15 Структура и поиск

Поиск должен искать только по разрешённым страницам.

Исключить:

```text
Личный кабинет
Корзина
Оформление заказа
Оплата
Заказ оформлен
404
500
robots.txt
sitemap.xml
```

Индексировать в поиске:

```text
разделы
категории
подкатегории
услуги
статьи
портфолио
контакты
доставка
оплата
```

---

## 16.16 Структура и шаблоны frontend

Backend должен отдавать `templateType`.

Пример:

```text
HOME_PAGE
CATEGORY_PAGE
SERVICE_PAGE
B2B_PAGE
PHOTOBOOK_PAGE
BLOG_LIST_PAGE
BLOG_ARTICLE_PAGE
PORTFOLIO_PAGE
CONTACTS_PAGE
ACCOUNT_PAGE
CHECKOUT_PAGE
LEGAL_PAGE
SYSTEM_PAGE
```

Это позволит frontend понять, каким компонентом рисовать страницу.

---

## 16.17 Обновлённая модель Page

Рекомендуемая модель:

```text
SitePage
id
parentId
title
slug
path
fullUrl
level
pageType
templateType
breadcrumbText
seoPageId
categoryId
serviceId
calculatorDefinitionId
defaultCalculatorParams
isIndexable
isInSitemap
isTechnical
isSystem
showInHeader
showInMegaMenu
showInFooter
showInMobileMenu
showInHtmlMap
sortOrder
status
createdAt
updatedAt
```

---

## 16.18 Обновлённый API страниц

```http
GET /api/pages/by-path?path=/operativnaya-poligrafiya/vizitki/
GET /api/pages/:id
GET /api/pages/:id/breadcrumbs
GET /api/pages/:id/children
GET /api/pages/:id/seo
GET /api/pages/:id/blocks
```

Для frontend удобнее основной endpoint:

```http
GET /api/pages/resolve?path=/operativnaya-poligrafiya/vizitki/
```

Ответ:

```json
{
  "page": {
    "id": "page_123",
    "title": "Визитки",
    "path": "/operativnaya-poligrafiya/vizitki/",
    "pageType": "CATEGORY",
    "templateType": "SERVICE_PAGE",
    "isIndexable": true
  },
  "seo": {},
  "breadcrumbs": [],
  "blocks": [],
  "calculator": {
    "service_id": "business-cards",
    "defaultParams": {}
  }
}
```

---

## 16.19 Обновлённая последовательность проектирования

С учётом XLSX структуры порядок становится таким:

```text
1. Импорт структуры сайта
2. Модель SitePage
3. Связь SitePage с Category / Service / SeoPage
4. Breadcrumbs
5. Sitemap flags
6. Robots/noindex flags
7. Navigation flags
8. Page → Calculator binding
9. Page API
10. Потом Category / Service / Calculator / Order
```

То есть сначала нужно стабилизировать карту сайта, а уже потом навешивать на страницы бизнес-сущности.

---

## 16.20 Что нужно уточнить по XLSX

Перед финальным проектированием нужно уточнить:

1. Все ли строки из XLSX должны стать страницами.
2. Какие строки являются услугами, а какие только категориями.
3. Какие страницы должны индексироваться.
4. Какие страницы должны быть в sitemap.
5. Какие страницы должны быть в меню.
6. Какие страницы имеют калькулятор.
7. Какие подкатегории являются преднастроенными вариантами одной услуги.
8. Какие URL должны быть со slash на конце.
9. Нужно ли заменить `example.com` на реальный домен при импорте.
10. Нужно ли хранить хлебные крошки как текст или генерировать из дерева.
11. Будет ли структура редактироваться в админке после импорта.
12. Кто отвечает за slug и транслитерацию при создании новых страниц.
