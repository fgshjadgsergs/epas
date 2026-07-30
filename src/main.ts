import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  const apiPrefix = configService.get('apiPrefix', { infer: true });
  app.setGlobalPrefix(apiPrefix);

  // За доверенным reverse-proxy (nginx на сервере) — иначе throttler и любой
  // код, читающий req.ip, видит адрес proxy вместо клиента (ТЗ §15.3, блок 11).
  if (configService.get('trustProxy', { infer: true })) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(helmet());
  // credentials: true нужен серверной корзине: анонимная сессия живёт в
  // httpOnly-cookie (kp_cart_sid), без credentials браузер её не отправит.
  // CORS_ORIGIN при этом не может быть "*" в production — fail-fast в
  // env.validation.ts (иначе браузер заблокирует credentialed-запросы).
  app.enableCors({
    origin: configService.get('corsOrigin', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Photo Print Backend API')
    .setDescription('Backend для сайта типографии: инфраструктура, авторизация, файлы, каталог услуг')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
