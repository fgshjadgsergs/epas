import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/**
 * Тело добавления позиции. Намеренно содержит ТОЛЬКО идентификатор
 * подтверждённого расчёта: цена, скидки, priceListId, customerContext и
 * срок производства читаются backend'ом из snapshot. Любое лишнее поле
 * отклоняется глобальным ValidationPipe (forbidNonWhitelisted).
 */
export class AddCartItemDto {
  @ApiProperty({ description: 'Id подтверждённого CalculationSnapshot', format: 'uuid' })
  @IsUUID()
  calculationSnapshotId!: string;

  @ApiPropertyOptional({
    description:
      'Необязательный ключ идемпотентности клиента (retry/двойной клик). ' +
      'Основная идемпотентность обеспечивается парой (корзина, расчёт).',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  idempotencyKey?: string;
}

class MoneyDto {
  @ApiProperty({ example: 320000, description: 'Сумма в копейках (целое)' })
  amountMinor!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

class CartItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'fotopechat-na-bumage' })
  serviceSlug!: string;

  @ApiProperty({ description: 'Название на момент добавления (immutable display snapshot)' })
  title!: string;

  @ApiProperty({ description: 'Нормализованная конфигурация расчёта' })
  configuration!: unknown;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ type: MoneyDto })
  unitPrice!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  lineTotal!: MoneyDto;

  @ApiProperty({ description: 'Срок изготовления из подтверждённого расчёта' })
  production!: { workingDays: number };

  @ApiProperty({
    enum: ['VALID', 'STALE', 'UNAVAILABLE', 'REQUIRES_RECALCULATION'],
    description: 'Свежесть позиции относительно активного прайса',
  })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  calculationSnapshotId!: string;

  @ApiProperty({ format: 'date-time' })
  addedAt!: string;
}

class CartTotalsDto {
  @ApiProperty({ type: MoneyDto })
  itemsSubtotal!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Скидки (этап без промокодов — всегда 0)' })
  discounts!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Итог без доставки (доставка вне этого этапа)' })
  total!: MoneyDto;
}

/** Публичное представление корзины: суммы посчитаны backend. */
export class CartResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['ACTIVE', 'MERGED', 'ORDERED'] })
  status!: string;

  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({ description: 'Версия корзины, растёт на каждой мутации' })
  cartVersion!: number;

  @ApiProperty({ type: [CartItemDto] })
  items!: CartItemDto[];

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ type: CartTotalsDto })
  totals!: CartTotalsDto;

  @ApiProperty({ description: 'true только если все позиции VALID и корзина не пуста' })
  canCheckout!: boolean;
}

/** Формат ошибки корзины. */
export class CartErrorResponseDto {
  @ApiProperty({ example: 'Этот расчёт принадлежит другой сессии' })
  message!: string;

  @ApiProperty({ example: 403 })
  statusCode!: number;
}
