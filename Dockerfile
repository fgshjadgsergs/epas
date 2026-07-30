FROM node:20-alpine AS build
WORKDIR /app
# Prisma engine на musl-Alpine требует libssl на этапе generate — без него
# "prisma generate" молча соберёт engine под несуществующую версию OpenSSL,
# и приложение упадёт в рантайме с "Error loading shared library libssl.so.1.1".
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
