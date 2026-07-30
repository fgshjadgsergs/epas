import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

/** Нормализация пробелов: обрезка краёв + схлопывание внутренних пробелов. */
const collapse = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * Тело оформления заказа. Осознанно содержит ТОЛЬКО контактные данные и ключ
 * идемпотентности — состав, цены, суммы, снимки и скидки backend берёт из
 * серверной корзины, от клиента они не принимаются.
 */
export class CreateOrderDto {
  @ApiProperty({ example: 'Иван Петров', maxLength: 120 })
  @Transform(collapse)
  @IsString()
  @Length(2, 120)
  contactName!: string;

  @ApiProperty({ example: '+7 900 123-45-67', maxLength: 32 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 32)
  @Matches(/^[+()\-\s\d]+$/, { message: 'Телефон содержит недопустимые символы' })
  contactPhone!: string;

  @ApiProperty({ example: 'ivan@example.com', maxLength: 254 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Некорректный email' })
  @Length(3, 254)
  contactEmail!: string;

  @ApiPropertyOptional({ example: 'Позвоните за час до готовности', maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  customerComment?: string;

  @ApiProperty({ description: 'Ключ идемпотентности (uuid): повтор возвращает тот же заказ', format: 'uuid' })
  @IsUUID()
  idempotencyKey!: string;
}
