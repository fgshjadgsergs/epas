import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Единый calculation input для /calculate и /calculate/confirm (Codex review
 * v2, блок 1): preview и подтверждение принимают ОДИН и тот же строго
 * валидируемый вход { parameters, upsells } — расхождение DTO ранее приводило
 * к потере upsells при подтверждении.
 *
 * Намеренно НЕ содержит b2b/customerType/promoCode — коммерческий контекст
 * определяется сервером (авторизация + профиль), а не присланным JSON.
 */
export class CalculationInputDto {
  @ApiProperty({
    description:
      'Выбранные машинные значения параметров (url-ключи из definition) + qty. ' +
      'Отсутствующие необязательные параметры получают значения по умолчанию; ' +
      'обязательный параметр без значения и без default — ошибка 422.',
    example: { format: '90x50', paper: 'coated-350', sides: 'double', qty: 100 },
  })
  @IsObject()
  parameters!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Коды upsell-опций (в shareable URL не попадают — только тело запроса). ' +
      'Дубликаты и коды, недоступные для текущих параметров, отклоняются с 422.',
    example: ['rounded-corners'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  upsells?: string[];
}
