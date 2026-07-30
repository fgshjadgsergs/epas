import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

class MoneyDto {
  @ApiProperty({ example: 231000, description: 'Сумма в копейках (целое)' })
  amountMinor!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

class AdminOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'vizitki' })
  serviceSlug!: string;

  @ApiProperty({ description: 'Название на момент оформления (immutable snapshot)' })
  title!: string;

  @ApiProperty({ description: 'Нормализованная конфигурация расчёта' })
  configuration!: unknown;

  @ApiProperty({ description: 'Снимок производства' })
  production!: { workingDays: number };

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ type: MoneyDto })
  unitPrice!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  lineTotal!: MoneyDto;
}

class AdminOrderActorDto {
  @ApiProperty({ example: 'Иван Петров', description: 'Имя сотрудника (без id/email/иных PII)' })
  displayName!: string;
}

class AdminOrderStatusEntryDto {
  @ApiProperty({ enum: OrderStatus, nullable: true })
  fromStatus!: string | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus!: string;

  @ApiProperty({ type: AdminOrderActorDto, nullable: true, description: 'Кто сменил статус (NULL — системное)' })
  changedBy!: AdminOrderActorDto | null;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class AdminOrderTotalsDto {
  @ApiProperty({ type: MoneyDto })
  itemsSubtotal!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  discounts!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;
}

/**
 * Полный заказ для админки. Осознанно НЕ содержит idempotencyKey,
 * snapshot-токенов, hash/секретов и внутренних pricing-правил.
 */
export class AdminOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KP-20260723-004217' })
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: string;

  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({ enum: ['DEMO', 'LIVE'] })
  pricingMode!: string;

  @ApiProperty()
  contactName!: string;

  @ApiProperty()
  contactPhone!: string;

  @ApiProperty()
  contactEmail!: string;

  @ApiProperty({ nullable: true })
  customerComment!: string | null;

  @ApiProperty({ type: [AdminOrderItemDto] })
  items!: AdminOrderItemDto[];

  @ApiProperty({ type: AdminOrderTotalsDto })
  totals!: AdminOrderTotalsDto;

  @ApiProperty({ type: [AdminOrderStatusEntryDto] })
  statusHistory!: AdminOrderStatusEntryDto[];

  @ApiProperty({ enum: OrderStatus, isArray: true, description: 'Разрешённые переходы из текущего статуса' })
  allowedTransitions!: string[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Краткий заказ для admin-списка. */
export class AdminOrderSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KP-20260723-004217' })
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: string;

  @ApiProperty({ enum: ['DEMO', 'LIVE'] })
  pricingMode!: string;

  @ApiProperty({ description: 'Имя клиента (для распознавания в списке)' })
  contactName!: string;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;

  @ApiProperty({ description: 'Число позиций' })
  itemCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** Страница admin-списка заказов. */
export class AdminOrderListResponseDto {
  @ApiProperty({ type: [AdminOrderSummaryDto] })
  items!: AdminOrderSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
