import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';

/**
 * Смена статуса заказа. Принимается только значение из enum OrderStatus —
 * произвольная строка отклоняется (400). actorId клиент не передаёт: он берётся
 * из проверенной backend-сессии.
 */
export class ChangeOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, description: 'Целевой статус (переход проверяется по карте)' })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Комментарий к смене статуса' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
