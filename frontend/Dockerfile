# NEXT_PUBLIC_API_URL зашивается в бандл на этапе `next build` (это публичная
# переменная, в браузере она всё равно видна). Поэтому передаём её build-аргом,
# а не env в рантайме — значение из docker-compose (FRONTEND_API_URL в .env).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY next.config.mjs tsconfig.json postcss.config.mjs tailwind.config.ts .eslintrc.json ./
COPY src ./src
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Fallback-пометка «демонстрационный прайс» до первого ответа API. Источник
# истины — pricingMode из ответа backend; флаг лишь закрывает момент, когда
# расчёта ещё не было. Как и API_URL, зашивается на этапе build.
ARG NEXT_PUBLIC_DEMO_PRICING=false
ENV NEXT_PUBLIC_DEMO_PRICING=$NEXT_PUBLIC_DEMO_PRICING
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
# output: 'standalone' в next.config.mjs кладёт в .next/standalone минимальный
# server.js + только реально используемые node_modules — npm install тут не нужен.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3001
CMD ["node", "server.js"]
