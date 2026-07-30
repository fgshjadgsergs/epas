import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PriceRuleKind } from '@prisma/client';

/** Верхняя граница денег — safe integer (двойная защита к service-проверке). */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

/**
 * Поля ценового правила DRAFT. Меняются только данные существующей
 * pricing-модели (kind/priority/деньги/условия/диапазоны/config); структуру
 * калькулятора (параметры/опции) через этот API менять нельзя.
 */
class DraftRuleFields {
  @ApiProperty({ enum: PriceRuleKind })
  @IsEnum(PriceRuleKind)
  kind!: PriceRuleKind;

  @ApiPropertyOptional({ description: 'Порядок применения (sortOrder)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Условие-сужение {"param":"value"|["v1","v2"]}; null = всегда' })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Начало диапазона тиража' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qtyFrom?: number | null;

  @ApiPropertyOptional({ description: 'Конец диапазона тиража (null = открытый)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  qtyTo?: number | null;

  @ApiPropertyOptional({ description: 'Деньги в копейках (safe integer)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE)
  amountMinor?: number | null;

  @ApiPropertyOptional({ description: 'Множитель (MULTIPLIER/QTY_DISCOUNT)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  multiplier?: number | null;

  @ApiPropertyOptional({ description: 'Типизированная config метрических/построчных правил' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}

/** Ожидаемый revision DRAFT — оптимистичная блокировка. */
class WithExpectedRevision {
  @ApiProperty({ description: 'Ожидаемый revision DRAFT (оптимистичная блокировка)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class CreateDraftRuleDto extends DraftRuleFields {
  @ApiProperty({ description: 'Ожидаемый revision DRAFT' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class UpdateDraftRuleDto extends DraftRuleFields {
  @ApiProperty({ description: 'Ожидаемый revision DRAFT' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

/** Тело для операций, требующих только revision (delete/publish). */
export class RevisionOnlyDto extends WithExpectedRevision {}
