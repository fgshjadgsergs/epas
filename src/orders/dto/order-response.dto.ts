import { ApiProperty } from '@nestjs/swagger';

class MoneyDto {
  @ApiProperty({ example: 231000, description: 'Сумма в копейках (целое)' })
  amountMinor!: number;

  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'listovki' })
  serviceSlug!: string;

  @ApiProperty({ description: 'Название на момент оформления (immutable snapshot)' })
  title!: string;

  @ApiProperty({ description: 'Нормализованная конфигурация расчёта' })
  configuration!: unknown;

  @ApiProperty({ description: 'Снимок производства (срок изготовления)' })
  production!: { workingDays: number };

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ type: MoneyDto })
  unitPrice!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  lineTotal!: MoneyDto;
}

class OrderStatusEntryDto {
  @ApiProperty({ enum: ['NEW', 'CANCELLED'], nullable: true })
  fromStatus!: string | null;

  @ApiProperty({ enum: ['NEW', 'CANCELLED'] })
  toStatus!: string;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class OrderTotalsDto {
  @ApiProperty({ type: MoneyDto })
  itemsSubtotal!: MoneyDto;

  @ApiProperty({ type: MoneyDto, description: 'Скидки (этап без промокодов — 0)' })
  discounts!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;
}

/** Полный заказ (detail). Внутренние pricing-правила снимков не раскрываются. */
export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KP-20260723-004217' })
  orderNumber!: string;

  @ApiProperty({ enum: ['NEW', 'CANCELLED'] })
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

  @ApiProperty({ type: [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty({ type: OrderTotalsDto })
  totals!: OrderTotalsDto;

  @ApiProperty({ type: [OrderStatusEntryDto] })
  statusHistory!: OrderStatusEntryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Краткий заказ для списка. */
export class OrderSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KP-20260723-004217' })
  orderNumber!: string;

  @ApiProperty({ enum: ['NEW', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ enum: ['DEMO', 'LIVE'] })
  pricingMode!: string;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;

  @ApiProperty({ description: 'Число позиций' })
  itemCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** Страница списка заказов. */
export class OrderListResponseDto {
  @ApiProperty({ type: [OrderSummaryDto] })
  items!: OrderSummaryDto[];

  @ApiProperty({ description: 'Всего заказов у пользователя' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
