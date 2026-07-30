import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

/**
 * Безопасные фильтры admin-списка заказов — передаются через query string
 * GET /admin/orders. Здесь НЕТ персональных данных: телефон/email в query не
 * принимаются, чтобы не осесть в access/proxy/APM-логах (для них — POST search).
 * Сортировка всегда createdAt desc.
 */
export class ListAdminOrdersDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Заказы с createdAt >= from (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Заказы с createdAt <= to (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Точный номер заказа (KP-…)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  orderNumber?: string;
}

/**
 * Поиск заказов по персональным данным клиента — только POST /admin/orders/search
 * с JSON body. Телефон/email никогда не идут через query string. Наследует
 * безопасные фильтры, чтобы поиск можно было комбинировать (например, статус +
 * телефон), и переиспользует ту же сервис-логику, пагинацию, сортировку и DTO.
 */
export class SearchAdminOrdersDto extends ListAdminOrdersDto {
  @ApiPropertyOptional({ description: 'Поиск по телефону (нормализуется по цифрам)', maxLength: 32 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Поиск по email (частичное совпадение)', maxLength: 254 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(254)
  email?: string;
}
