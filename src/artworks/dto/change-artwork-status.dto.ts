import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ArtworkStatus } from '@prisma/client';
import { ADMIN_REVIEW_TARGETS } from '../artwork-status';

/**
 * Смена статуса макета проверяющим. Принимаются только целевые статусы review
 * (IN_REVIEW/APPROVED/REJECTED) — SUPERSEDED/WITHDRAWN через этот endpoint
 * недоступны. При REJECTED комментарий обязателен (проверяется в сервисе).
 */
export class ChangeArtworkStatusDto {
  @ApiProperty({ enum: ADMIN_REVIEW_TARGETS })
  @IsIn(ADMIN_REVIEW_TARGETS)
  status!: ArtworkStatus;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Комментарий проверки (обязателен при отклонении)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
